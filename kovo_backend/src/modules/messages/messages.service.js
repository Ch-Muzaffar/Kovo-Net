'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { moderateText } = require('../../config/openai');
const { NotFoundError, BadRequestError } = require('../../utils/errors');
const logger = require('../../utils/logger');
const cache = require('../../utils/cache');

// PERF: Cache validated receivers for 5 minutes to avoid repeated DB lookups
const receiverCache = new Map();
const RECEIVER_CACHE_TTL = 5 * 60 * 1000;

function getCachedReceiver(id) {
  const entry = receiverCache.get(id);
  if (entry && Date.now() < entry.exp) return entry.value;
  receiverCache.delete(id);
  return null;
}

function setCachedReceiver(id, value) {
  receiverCache.set(id, { value, exp: Date.now() + RECEIVER_CACHE_TTL });
  // Prevent memory leak — cap at 500 entries
  if (receiverCache.size > 500) {
    const firstKey = receiverCache.keys().next().value;
    receiverCache.delete(firstKey);
  }
}

async function sendMessage(senderId, data) {
  if (senderId === data.receiver_id) throw new BadRequestError('Cannot send a message to yourself');

  // PERF: Check receiver cache first
  let receiver = getCachedReceiver(data.receiver_id);
  
  // Step 1: Perform validation checks concurrently, skip receiver DB lookup if cached
  const promises = [];
  
  if (!receiver) {
    promises.push(
      supabaseAdmin
        .from('user_profiles')
        .select('id, banned')
        .eq('id', data.receiver_id)
        .maybeSingle()
    );
  } else {
    promises.push(Promise.resolve({ data: receiver }));
  }
  
  promises.push(
    data.post_id
      ? supabaseAdmin
          .from('posts')
          .select('id')
          .eq('id', data.post_id)
          .maybeSingle()
      : Promise.resolve({ data: { id: true } })
  );
  
  promises.push(moderateText(data.body));

  const [receiverRes, postRes, mod] = await Promise.all(promises);

  receiver = receiverRes.data;
  if (!receiver) throw new NotFoundError('Recipient not found');
  if (receiver.banned) throw new BadRequestError('Cannot message this user');
  
  // PERF: Cache the valid receiver
  setCachedReceiver(data.receiver_id, receiver);

  if (data.post_id && !postRes.data) {
    throw new NotFoundError('Linked post not found');
  }

  if (mod.flagged) throw new BadRequestError('Message violates community guidelines', 'CONTENT_BLOCKED');

  // Step 2: Insert direct message to the database
  const { data: message, error } = await supabaseAdmin
    .from('direct_messages')
    .insert({ sender_id: senderId, receiver_id: data.receiver_id, post_id: data.post_id || null, body: data.body })
    .select('id, body, post_id, created_at')
    .single();

  if (error) throw new BadRequestError('Failed to send message');

  // PERF: Update conversation caches in-place instead of invalidating (avoids full re-fetch)
  const senderCacheKey = `conversations:${senderId}`;
  const receiverCacheKey = `conversations:${data.receiver_id}`;
  
  const updateConversationCache = (cacheKey, userId, partnerId, msg) => {
    const cached = cache.get(cacheKey);
    if (cached && cached.data) {
      const existingIdx = cached.data.findIndex(c => c.partner?.id === partnerId);
      const newLastMessage = { body: msg.body, created_at: msg.created_at, isMine: msg.sender_id === userId };
      if (existingIdx >= 0) {
        cached.data[existingIdx].lastMessage = newLastMessage;
        // Move to top
        const [conv] = cached.data.splice(existingIdx, 1);
        cached.data.unshift(conv);
      }
      cache.set(cacheKey, cached);
    } else {
      // No cache entry — just invalidate so it gets re-fetched
      cache.invalidate(cacheKey);
    }
  };
  
  const fullMsg = { body: data.body, created_at: message.created_at, sender_id: senderId };
  updateConversationCache(senderCacheKey, senderId, data.receiver_id, fullMsg);
  updateConversationCache(receiverCacheKey, data.receiver_id, senderId, fullMsg);

  // Step 3: Run notification creation and real-time push concurrently in the background without blocking the HTTP response
  (async () => {
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: data.receiver_id,
        type: 'new_dm',
        title: 'New message',
        body: 'You received a new direct message.',
        reference_type: data.post_id ? 'post' : null,
        reference_id: data.post_id || null,
      });
    } catch (err) {
      logger.error('Failed to insert DM notification', { error: err.message });
    }

    try {
      const { sendToUser } = require('../../utils/websocket');
      const realTimeMessage = {
        id: message.id,
        senderId: senderId,
        text: message.body,
        postId: message.post_id || null,
        ts: new Date(message.created_at).getTime()
      };
      sendToUser(data.receiver_id, {
        type: 'new_message',
        message: realTimeMessage,
        partnerId: senderId
      });
      sendToUser(senderId, {
        type: 'new_message',
        message: { ...realTimeMessage, senderId: 'me' },
        partnerId: data.receiver_id
      });
    } catch (err) {
      logger.error('Failed to send real-time message via websocket', { error: err.message });
    }
  })();

  logger.info('DM sent', { messageId: message.id, sender: senderId, receiver: data.receiver_id });
  return message;
}

async function getConversations(userId) {
  // PERF: Check cache first
  const cacheKey = `conversations:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // PERF: Use a smarter query — only fetch the LATEST message per conversation partner
  // Instead of fetching ALL messages and grouping in-memory, we use a limited approach:
  // Fetch only recent messages (limit 200) which covers most active conversations
  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .select('id, sender_id, receiver_id, body, created_at')
    .eq('is_hidden', false)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new BadRequestError('Failed to fetch conversations');

  const conversationMap = new Map();
  for (const msg of data) {
    const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    if (!conversationMap.has(partnerId)) conversationMap.set(partnerId, msg);
  }

  const partnerIds = [...conversationMap.keys()];
  
  // PERF: Only fetch profiles if we have partners
  let partnerMap = new Map();
  if (partnerIds.length > 0) {
    const { data: partners } = await supabaseAdmin
      .from('user_profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', partnerIds);
    partnerMap = new Map((partners || []).map((p) => [p.id, p]));
  }

  const conversations = [...conversationMap.entries()].map(([partnerId, lastMsg]) => ({
    partner: partnerMap.get(partnerId) || { id: partnerId, first_name: 'Unknown', last_name: '' },
    lastMessage: { body: lastMsg.body, created_at: lastMsg.created_at, isMine: lastMsg.sender_id === userId },
  }));

  const result = { data: conversations };
  
  // PERF: Cache for 15 seconds (shorter TTL for real-time data)
  cache.set(cacheKey, result);
  return result;
}

async function getConversationMessages(userId, otherUserId, { cursor, pageSize }) {
  // PERF: Removed { count: 'exact' } which forces a full table scan
  let query = supabaseAdmin
    .from('direct_messages')
    .select('id, sender_id, receiver_id, body, post_id, created_at')
    .eq('is_hidden', false)
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
    )
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query = query.lt('created_at', decoded.created_at);
  }

  const { data, error } = await query;
  if (error) throw new BadRequestError('Failed to fetch messages');

  const hasMore = data.length > pageSize;
  const items = (hasMore ? data.slice(0, pageSize) : data).reverse();
  const lastItem = data[0];

  // PERF: Fetch reactions in parallel (non-blocking) — skip entirely if no messages
  let reactionsMap = {};
  if (items.length > 0) {
    try {
      const { getReactionsForTargets } = require('../reactions/reactions.service');
      const messageIds = items.map(m => m.id);
      reactionsMap = await getReactionsForTargets('message', messageIds);
    } catch (err) {
      logger.error('Failed to get reactions for messages', { error: err.message });
    }
  }

  const itemsWithReactions = items.map(m => ({
    id: m.id,
    sender_id: m.sender_id,
    receiver_id: m.receiver_id,
    body: m.body,
    post_id: m.post_id,
    created_at: m.created_at,
    reactions: reactionsMap[m.id] || []
  }));

  return {
    data: itemsWithReactions,
    pagination: {
      hasMore, pageSize: itemsWithReactions.length,
      ...(hasMore && lastItem
        ? { nextCursor: Buffer.from(JSON.stringify({ created_at: lastItem.created_at, id: lastItem.id })).toString('base64') }
        : {}),
    },
  };
}

async function deleteMessage(userId, messageId) {
  const { data: msg, error: fetchErr } = await supabaseAdmin
    .from('direct_messages')
    .select('id, sender_id, created_at, is_hidden')
    .eq('id', messageId)
    .maybeSingle();

  if (fetchErr || !msg) throw new NotFoundError('Message not found');
  if (msg.sender_id !== userId) throw new BadRequestError('You can only unsend your own messages');
  if (msg.is_hidden) throw new BadRequestError('Message already deleted');

  // 15-minute unsend window
  const ageMs = Date.now() - new Date(msg.created_at).getTime();
  if (ageMs > 15 * 60 * 1000) throw new BadRequestError('Messages can only be unsent within 15 minutes of sending');

  const { error } = await supabaseAdmin
    .from('direct_messages')
    .update({ is_hidden: true })
    .eq('id', messageId);

  if (error) throw new BadRequestError('Failed to delete message');

  // Invalidate conversation caches
  cache.invalidate(`conversations:${userId}`);

  logger.info('DM deleted', { messageId, userId });
  return { success: true };
}

module.exports = { sendMessage, getConversations, getConversationMessages, deleteMessage };
