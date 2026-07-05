'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const logger = require('../../utils/logger');
const { resolveUserId } = require('../users/users.service');
const cache = require('../../utils/cache');

// PERF: Helper to invalidate all connection caches for a user
function invalidateConnectionCaches(userId) {
  cache.invalidate(`connections:list:${userId}`);
  cache.invalidate(`connections:pending:${userId}`);
  cache.invalidate(`connections:count:${userId}`);
}

/**
 * Send a connection request
 */
async function sendRequest(senderId, receiverIdOrUsername) {
  const receiverId = await resolveUserId(receiverIdOrUsername);
  if (!receiverId) {
    throw new NotFoundError('Target user not found');
  }

  if (senderId === receiverId) {
    throw new BadRequestError('You cannot connect with yourself');
  }

  // PERF: Parallelize receiver profile check, existing connection checks, and sender profile fetch
  const [receiverRes, conn1, conn2, senderRes] = await Promise.all([
    supabaseAdmin
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', receiverId)
      .maybeSingle(),
    supabaseAdmin
      .from('connections')
      .select('*')
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId)
      .maybeSingle(),
    supabaseAdmin
      .from('connections')
      .select('*')
      .eq('sender_id', receiverId)
      .eq('receiver_id', senderId)
      .maybeSingle(),
    supabaseAdmin
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', senderId)
      .single()
  ]);

  const receiverProfile = receiverRes.data;
  if (receiverRes.error || !receiverProfile) {
    throw new NotFoundError('Target user not found');
  }

  if (conn1.error || conn2.error) {
    throw new BadRequestError('Failed to query existing connections');
  }

  const existing = [conn1.data, conn2.data].filter(Boolean);

  const senderProfile = senderRes.data;
  const senderName = senderProfile ? `${senderProfile.first_name} ${senderProfile.last_name}` : 'Someone';

  if (existing && existing.length > 0) {
    const conn = existing[0];
    if (conn.status === 'accepted') {
      throw new BadRequestError('You are already connected');
    }
    if (conn.status === 'pending') {
      if (conn.sender_id === senderId) {
        throw new BadRequestError('Connection request already sent');
      } else {
        // The other user had already sent a request, so accept it mutually!
        const { data: updated, error: uErr } = await supabaseAdmin
          .from('connections')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', conn.id)
          .select('*')
          .single();

        if (uErr) throw new BadRequestError('Failed to accept connection');

        // PERF: Fire-and-forget notification + wave message concurrently in background
        Promise.all([
          supabaseAdmin.from('notifications').insert({
            user_id: receiverId,
            type: 'connection_accepted',
            title: 'Connection request accepted',
            body: `You are now connected with ${senderName}.`,
            reference_type: 'connection',
            reference_id: conn.id,
            is_read: false
          }),
          supabaseAdmin.from('direct_messages').insert({
            sender_id: senderId,
            receiver_id: receiverId,
            body: '👋 Let\'s connect!'
          }).then(() =>
            supabaseAdmin.from('notifications').insert({
              user_id: receiverId,
              type: 'new_dm',
              title: 'New message',
              body: 'You received a new direct message.',
            })
          )
        ]).catch(err => logger.error('Failed background tasks in sendRequest:', err));

        invalidateConnectionCaches(senderId);
        invalidateConnectionCaches(receiverId);
        return updated;
      }
    }
    if (conn.status === 'rejected') {
      // Re-send connection request (reset status to pending)
      const { data: updated, error: uErr } = await supabaseAdmin
        .from('connections')
        .update({
          sender_id: senderId,
          receiver_id: receiverId,
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', conn.id)
        .select('*')
        .single();

      if (uErr) throw new BadRequestError('Failed to send connection request');

      // Create notification
      await supabaseAdmin.from('notifications').insert({
        user_id: receiverId,
        type: 'connection_request',
        title: 'Connection Request',
        body: `${senderName} wants to connect with you.`,
        reference_type: 'connection',
        reference_id: conn.id,
        is_read: false
      });

      return updated;
    }
  }

  // Create new connection
  const { data: newConn, error: cErr } = await supabaseAdmin
    .from('connections')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending'
    })
    .select('*')
    .single();

  if (cErr) {
    logger.error('Failed to insert connection', cErr);
    throw new BadRequestError('Failed to send connection request');
  }

  // Create notification
  await supabaseAdmin.from('notifications').insert({
    user_id: receiverId,
    type: 'connection_request',
    title: 'Connection Request',
    body: `${senderName} wants to connect with you.`,
    reference_type: 'connection',
    reference_id: newConn.id,
    is_read: false
  });

  invalidateConnectionCaches(senderId);
  invalidateConnectionCaches(receiverId);
  return newConn;
}

/**
 * Accept or reject request
 */
async function respondRequest(userIdOrUsername, connectionId, action) {
  const userId = await resolveUserId(userIdOrUsername);
  if (!userId) throw new NotFoundError('User not found');

  if (!['accept', 'reject'].includes(action)) {
    throw new BadRequestError('Invalid action. Must be accept or reject');
  }

  const { data: conn, error: fError } = await supabaseAdmin
    .from('connections')
    .select('*')
    .eq('id', connectionId)
    .maybeSingle();

  if (fError || !conn) {
    throw new NotFoundError('Connection request not found');
  }

  if (conn.receiver_id !== userId) {
    throw new BadRequestError('You cannot respond to this connection request');
  }

  if (conn.status !== 'pending') {
    throw new BadRequestError(`Request is already ${conn.status}`);
  }

  if (action === 'reject') {
    // Automatically withdraw: delete the connection request from the database
    const { error: dErr } = await supabaseAdmin
      .from('connections')
      .delete()
      .eq('id', connectionId);

    if (dErr) throw new BadRequestError('Failed to withdraw/decline connection request');

    // Also delete any notifications associated with this connection request to clean up the notification panel
    await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('reference_type', 'connection')
      .eq('reference_id', connectionId);

    return { success: true, status: 'withdrawn' };
  }

  const { data: updated, error: uError } = await supabaseAdmin
    .from('connections')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', connectionId)
    .select('*')
    .single();

  if (uError) throw new BadRequestError('Failed to update connection response');

  // Get receiver name for notification
  const { data: receiverProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .single();

  const responderName = receiverProfile ? `${receiverProfile.first_name} ${receiverProfile.last_name}` : 'Someone';

  // PERF: Fire-and-forget notification + wave message concurrently in background
  Promise.all([
    supabaseAdmin.from('notifications').insert({
      user_id: conn.sender_id,
      type: 'connection_accepted',
      title: 'Connection Request Accepted',
      body: `${responderName} accepted your connection request.`,
      reference_type: 'connection',
      reference_id: connectionId,
      is_read: false
    }),
    supabaseAdmin.from('direct_messages').insert({
      sender_id: userId,
      receiver_id: conn.sender_id,
      body: '👋 Let\'s connect!'
    }).then(() =>
      supabaseAdmin.from('notifications').insert({
        user_id: conn.sender_id,
        type: 'new_dm',
        title: 'New message',
        body: 'You received a new direct message.',
      })
    )
  ]).catch(err => logger.error('Failed background tasks in respondRequest:', err));

  invalidateConnectionCaches(userId);
  invalidateConnectionCaches(conn.sender_id);
  return updated;
}

async function getPendingRequests(userIdOrUsername) {
  const userId = await resolveUserId(userIdOrUsername);
  if (!userId) return [];

  // PERF: Check cache first
  const pendingCacheKey = `connections:pending:${userId}`;
  const cachedPending = cache.get(pendingCacheKey);
  if (cachedPending) return cachedPending;

  const { data: connections, error } = await supabaseAdmin
    .from('connections')
    .select('id, created_at, sender_id')
    .eq('receiver_id', userId)
    .eq('status', 'pending');

  if (error) throw new BadRequestError('Failed to get pending requests');
  if (!connections || connections.length === 0) return [];

  const senderIds = [...new Set(connections.map(r => r.sender_id))].filter(Boolean);
  if (senderIds.length === 0) return [];

  const { data: profiles, error: pErr } = await supabaseAdmin
    .from('user_profiles')
    .select('id, username, first_name, last_name, avatar_url, profession, user_type, bio')
    .in('id', senderIds);

  if (pErr) throw new BadRequestError('Failed to load sender profiles');

  const result = connections.map(item => {
    const profile = (profiles || []).find(p => p.id === item.sender_id);
    return {
      id: item.id,
      sender: profile || { id: item.sender_id, first_name: 'User', last_name: '', profession: 'Network Member', avatar_url: null, user_type: 'student', bio: '' },
      created_at: item.created_at
    };
  });
  cache.set(pendingCacheKey, result);
  return result;
}

/**
 * Get pending outgoing (sent) requests
 */
async function getSentPendingRequests(userIdOrUsername) {
  const userId = await resolveUserId(userIdOrUsername);
  if (!userId) return [];

  const { data: connections, error } = await supabaseAdmin
    .from('connections')
    .select('id, created_at, receiver_id')
    .eq('sender_id', userId)
    .eq('status', 'pending');

  if (error) throw new BadRequestError('Failed to get sent pending requests');
  if (!connections || connections.length === 0) return [];

  const receiverIds = [...new Set(connections.map(r => r.receiver_id))].filter(Boolean);
  if (receiverIds.length === 0) return [];

  const { data: profiles, error: pErr } = await supabaseAdmin
    .from('user_profiles')
    .select('id, username, first_name, last_name, avatar_url, profession, user_type, bio')
    .in('id', receiverIds);

  if (pErr) throw new BadRequestError('Failed to load receiver profiles');

  return connections.map(item => {
    const profile = (profiles || []).find(p => p.id === item.receiver_id);
    return {
      id: item.id,
      receiver: profile || { id: item.receiver_id, first_name: 'User', last_name: '', profession: 'Network Member', avatar_url: null, user_type: 'student', bio: '' },
      created_at: item.created_at
    };
  });
}

/**
 * Get list of mutually connected friends
 */
async function getConnectionsList(userIdOrUsername) {
  const userId = await resolveUserId(userIdOrUsername);
  if (!userId) return [];

  // PERF: Check cache first
  const listCacheKey = `connections:list:${userId}`;
  const cachedList = cache.get(listCacheKey);
  if (cachedList) return cachedList;

  const { data, error } = await supabaseAdmin
    .from('connections')
    .select('*')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error) throw new BadRequestError('Failed to retrieve connection list');

  const partnerIds = data.map(c => c.sender_id === userId ? c.receiver_id : c.sender_id);
  if (partnerIds.length === 0) return [];

  const { data: profiles, error: pErr } = await supabaseAdmin
    .from('user_profiles')
    .select('id, first_name, last_name, avatar_url, profession, user_type')
    .in('id', partnerIds);

  if (pErr) throw new BadRequestError('Failed to retrieve profiles');

  const result = profiles.map(p => {
    const conn = data.find(c => c.sender_id === p.id || c.receiver_id === p.id);
    return {
      ...p,
      connectionId: conn ? conn.id : null
    };
  });
  cache.set(listCacheKey, result);
  return result;
}

/**
 * Get connection status
 */
async function getConnectionStatus(userId, otherUserIdOrUsername) {
  const otherUserId = await resolveUserId(otherUserIdOrUsername);
  if (!otherUserId) throw new NotFoundError('Target user not found');
  if (userId === otherUserId) return { status: 'self' };

  const [conn1, conn2] = await Promise.all([
    supabaseAdmin
      .from('connections')
      .select('*')
      .eq('sender_id', userId)
      .eq('receiver_id', otherUserId)
      .maybeSingle(),
    supabaseAdmin
      .from('connections')
      .select('*')
      .eq('sender_id', otherUserId)
      .eq('receiver_id', userId)
      .maybeSingle()
  ]);

  if (conn1.error || conn2.error) throw new BadRequestError('Failed to load connection status');
  const data = conn1.data || conn2.data;
  if (!data) return { status: 'none' };

  if (data.status === 'accepted') return { status: 'connected', connectionId: data.id };
  if (data.status === 'rejected') return { status: 'rejected', connectionId: data.id };

  // Pending: check who sent it
  if (data.sender_id === userId) {
    return { status: 'pending_sent', connectionId: data.id };
  } else {
    return { status: 'pending_received', connectionId: data.id };
  }
}

/**
 * Get count of connections
 */
async function getConnectionCount(userIdOrUsername) {
  const userId = await resolveUserId(userIdOrUsername);
  if (!userId) return 0;

  // PERF: Check cache first
  const countCacheKey = `connections:count:${userId}`;
  const cachedCount = cache.get(countCacheKey);
  if (cachedCount !== null && cachedCount !== undefined) return cachedCount;

  const { data, error } = await supabaseAdmin
    .from('connections')
    .select('id')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error) {
    logger.error('Failed to get connection count', error);
    return 0;
  }

  const total = data ? data.length : 0;
  cache.set(countCacheKey, total);
  return total;
}

/**
 * Withdraw a pending connection request (sender only)
 */
async function withdrawRequest(senderId, connectionId) {
  const { data: conn, error: fErr } = await supabaseAdmin
    .from('connections')
    .select('*')
    .eq('id', connectionId)
    .maybeSingle();

  if (fErr || !conn) throw new NotFoundError('Connection request not found');
  if (conn.sender_id !== senderId) throw new BadRequestError('You can only withdraw your own requests');
  if (conn.status !== 'pending') throw new BadRequestError('Only pending requests can be withdrawn');

  const { error: dErr } = await supabaseAdmin
    .from('connections')
    .delete()
    .eq('id', connectionId);

  if (dErr) throw new BadRequestError('Failed to withdraw connection request');
  invalidateConnectionCaches(senderId);
  invalidateConnectionCaches(conn.receiver_id);
  return { success: true };
}

/**
 * Remove/delete a connection (unfriend)
 */
async function removeConnection(userId, connectionId) {
  const { data: conn, error: fErr } = await supabaseAdmin
    .from('connections')
    .select('*')
    .eq('id', connectionId)
    .maybeSingle();

  if (fErr || !conn) throw new NotFoundError('Connection not found');
  if (conn.sender_id !== userId && conn.receiver_id !== userId) {
    throw new BadRequestError('You are not authorized to remove this connection');
  }

  const { error: dErr } = await supabaseAdmin
    .from('connections')
    .delete()
    .eq('id', connectionId);

  if (dErr) throw new BadRequestError('Failed to remove connection');
  invalidateConnectionCaches(conn.sender_id);
  invalidateConnectionCaches(conn.receiver_id);
  return { success: true };
}

/**
 * Delete/ignore a received request or withdraw a sent request based on relationship context
 */
async function deleteConnectionRequest(userId, connectionId) {
  const { data: conn, error: fError } = await supabaseAdmin
    .from('connections')
    .select('*')
    .eq('id', connectionId)
    .maybeSingle();

  if (fError || !conn) {
    throw new NotFoundError('Connection request not found');
  }

  if (conn.sender_id === userId) {
    return withdrawRequest(userId, connectionId);
  } else if (conn.receiver_id === userId) {
    return respondRequest(userId, connectionId, 'reject');
  } else {
    throw new BadRequestError('You are not authorized to delete this connection request');
  }
}

module.exports = {
  sendRequest,
  respondRequest,
  getPendingRequests,
  getSentPendingRequests,
  getConnectionsList,
  getConnectionStatus,
  getConnectionCount,
  withdrawRequest,
  removeConnection,
  deleteConnectionRequest
};

