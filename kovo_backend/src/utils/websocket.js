'use strict';

const ws = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const cache = require('./cache');
const { supabaseAdmin } = require('../config/supabase');

let wss = null;
const userConnections = new Map(); // userId -> Set of WS connections

// PERF: Receiver validation cache for WebSocket DM handler
const wsReceiverCache = new Map();
const WS_RECEIVER_CACHE_TTL = 5 * 60 * 1000;

function getWsCachedReceiver(id) {
  const entry = wsReceiverCache.get(id);
  if (entry && Date.now() < entry.exp) return entry.value;
  wsReceiverCache.delete(id);
  return null;
}

function setWsCachedReceiver(id, value) {
  wsReceiverCache.set(id, { value, exp: Date.now() + WS_RECEIVER_CACHE_TTL });
  if (wsReceiverCache.size > 500) {
    const firstKey = wsReceiverCache.keys().next().value;
    wsReceiverCache.delete(firstKey);
  }
}

function initWebSocket(server) {
  wss = new ws.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    // Only upgrade if it's a websocket connection
    const pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
    if (pathname.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (wsConnection) => {
        wss.emit('connection', wsConnection, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (wsConnection, request) => {
    let userId = null;

    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');

      if (token) {
        // PERF: Supabase uses ES256 JWTs — decode first, then validate via Supabase auth
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.sub) {
          logger.warn('WebSocket: invalid JWT payload');
          wsConnection.close(4001, 'Unauthorized');
          return;
        }
        
        // Check expiration locally
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
          logger.warn('WebSocket: token expired');
          wsConnection.close(4001, 'Token expired');
          return;
        }

        // PERF: Check if user was recently validated via HTTP auth (cache hit)
        const cachedAuth = cache.get(`auth-user:${decoded.sub}`);
        if (cachedAuth) {
          // User was recently validated — trust the cached auth
          userId = decoded.sub;
        } else {
          // Validate via Supabase auth.getUser (async but necessary for security)
          const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
          if (error || !user) {
            logger.warn('WebSocket: Supabase auth validation failed');
            wsConnection.close(4001, 'Unauthorized');
            return;
          }
          userId = user.id;
        }

        if (userId) {
          if (!userConnections.has(userId)) {
            userConnections.set(userId, new Set());
          }
          userConnections.get(userId).add(wsConnection);
          logger.info(`WebSocket connection authenticated for user: ${userId}`);
        }
      } else {
        logger.warn('WebSocket connection attempt without token');
        wsConnection.close(4001, 'Unauthorized');
        return;
      }
    } catch (err) {
      logger.warn('WebSocket authentication failed', { error: err.message });
      wsConnection.close(4001, 'Unauthorized');
      return;
    }

    wsConnection.on('message', (message) => {
      // Echo heartbeat or handle client-side socket messages if needed
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'ping') {
          wsConnection.send(JSON.stringify({ type: 'pong' }));
        } else if (parsed.type === 'message_delivered') {
          sendToUser(parsed.senderId, {
            type: 'message_delivered',
            messageId: parsed.messageId,
            receiverId: userId
          });
        } else if (parsed.type === 'send_dm') {
          // PERF: Handle DM sending directly via WebSocket for 0-latency delivery
          handleWebSocketDm(userId, parsed);
        }
      } catch (err) {
        // Not JSON or other message type, ignore
      }
    });

    wsConnection.on('close', () => {
      if (userId && userConnections.has(userId)) {
        const userConns = userConnections.get(userId);
        userConns.delete(wsConnection);
        if (userConns.size === 0) {
          userConnections.delete(userId);
        }
      }
      logger.info(`WebSocket connection closed for user: ${userId}`);
    });

    wsConnection.on('error', (err) => {
      logger.error('WebSocket connection error', { error: err.message });
    });
  });

  logger.info('WebSocket server initialized attached to HTTP server');
}

/**
 * PERF: Handle DM sending directly via WebSocket for near-zero latency.
 * Immediately relays the message to both sender and receiver via WebSocket,
 * then persists to DB asynchronously in the background.
 */
async function handleWebSocketDm(senderId, parsed) {
  const { receiverId, text, postId, tempId } = parsed;
  if (!receiverId || !text || !text.trim()) return;

  const ts = Date.now();

  // Step 1: Immediately relay the message to receiver via WebSocket (0-latency)
  const immediateMessage = {
    id: tempId,
    senderId: senderId,
    text: text.trim(),
    postId: postId || null,
    ts,
  };

  sendToUser(receiverId, {
    type: 'new_message',
    message: immediateMessage,
    partnerId: senderId,
  });

  // Also send confirmation back to sender
  sendToUser(senderId, {
    type: 'dm_sent_ack',
    tempId,
    partnerId: receiverId,
    ts,
  });

  // Step 2: Persist to database asynchronously (fire-and-forget)
  (async () => {
    try {
      const { moderateText } = require('../config/openai');

      // PERF: Use receiver cache to skip DB validation
      let receiver = getWsCachedReceiver(receiverId);
      
      const promises = [];
      if (!receiver) {
        promises.push(
          supabaseAdmin
            .from('user_profiles')
            .select('id, banned')
            .eq('id', receiverId)
            .maybeSingle()
        );
      } else {
        promises.push(Promise.resolve({ data: receiver }));
      }
      promises.push(moderateText(text.trim()));

      const [receiverRes, mod] = await Promise.all(promises);

      receiver = receiverRes.data;
      if (!receiver || receiver.banned) {
        sendToUser(senderId, { type: 'dm_error', tempId, error: 'Recipient not found or banned' });
        return;
      }
      
      // Cache the valid receiver
      setWsCachedReceiver(receiverId, receiver);

      if (mod.flagged) {
        sendToUser(senderId, { type: 'dm_error', tempId, error: 'Message violates community guidelines' });
        return;
      }

      const { data: message, error } = await supabaseAdmin
        .from('direct_messages')
        .insert({ sender_id: senderId, receiver_id: receiverId, post_id: postId || null, body: text.trim() })
        .select('id, body, post_id, created_at')
        .single();

      if (error) {
        sendToUser(senderId, { type: 'dm_error', tempId, error: 'Failed to save message' });
        return;
      }

      // PERF: Invalidate conversation caches
      cache.invalidate(`conversations:${senderId}`);
      cache.invalidate(`conversations:${receiverId}`);

      // Send the real message ID to both parties so they can update their local state
      const realMessage = {
        id: message.id,
        senderId: senderId,
        text: message.body,
        postId: message.post_id || null,
        ts: new Date(message.created_at).getTime(),
      };

      sendToUser(senderId, {
        type: 'dm_persisted',
        tempId,
        message: { ...realMessage, senderId: 'me' },
        partnerId: receiverId,
      });

      sendToUser(receiverId, {
        type: 'dm_persisted',
        tempId,
        message: realMessage,
        partnerId: senderId,
      });

      // Fire-and-forget notification
      supabaseAdmin.from('notifications').insert({
        user_id: receiverId,
        type: 'new_dm',
        title: 'New message',
        body: 'You received a new direct message.',
        reference_type: postId ? 'post' : null,
        reference_id: postId || null,
      }).catch(err => logger.error('Failed to insert DM notification', { error: err.message }));

    } catch (err) {
      logger.error('WebSocket DM persistence failed', { error: err.message, senderId, receiverId });
      sendToUser(senderId, { type: 'dm_error', tempId, error: 'Failed to send message' });
    }
  })();
}

function sendToUser(userId, data) {
  const connections = userConnections.get(userId);
  if (connections) {
    const payload = JSON.stringify(data);
    for (const wsConnection of connections) {
      if (wsConnection.readyState === ws.OPEN) {
        wsConnection.send(payload);
      }
    }
  }
}

function broadcast(data) {
  if (!wss) return;
  const payload = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === ws.OPEN) {
      client.send(payload);
    }
  }
}

module.exports = { initWebSocket, sendToUser, broadcast };
