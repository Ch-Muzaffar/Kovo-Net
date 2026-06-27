'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const logger = require('../../utils/logger');
const { resolveUserId } = require('../users/users.service');

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

  // Get receiver profile to verify existence
  const { data: receiverProfile, error: rError } = await supabaseAdmin
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('id', receiverId)
    .maybeSingle();

  if (rError || !receiverProfile) {
    throw new NotFoundError('Target user not found');
  }

  // Check if a connection already exists
  const { data: existing, error: eError } = await supabaseAdmin
    .from('connections')
    .select('*')
    .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`);

  if (eError) {
    throw new BadRequestError('Failed to query existing connections');
  }

  // Get sender name for notification
  const { data: senderProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('id', senderId)
    .single();

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

        // Create mutual notification
        await supabaseAdmin.from('notifications').insert({
          user_id: receiverId,
          type: 'connection_accepted',
          title: 'Connection request accepted',
          body: `You are now connected with ${senderName}.`,
          reference_type: 'connection',
          reference_id: conn.id,
          is_read: false
        });

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

  const newStatus = action === 'accept' ? 'accepted' : 'rejected';

  const { data: updated, error: uError } = await supabaseAdmin
    .from('connections')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
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

  // Send notification to sender
  await supabaseAdmin.from('notifications').insert({
    user_id: conn.sender_id,
    type: newStatus === 'accepted' ? 'connection_accepted' : 'connection_rejected',
    title: newStatus === 'accepted' ? 'Connection Request Accepted' : 'Connection Request Declined',
    body: newStatus === 'accepted' 
      ? `${responderName} accepted your connection request.`
      : `${responderName} declined your connection request.`,
    reference_type: 'connection',
    reference_id: connectionId,
    is_read: false
  });

  return updated;
}

/**
 * Get pending incoming requests
 */
async function getPendingRequests(userIdOrUsername) {
  const userId = await resolveUserId(userIdOrUsername);
  if (!userId) return [];

  const { data, error } = await supabaseAdmin
    .from('connections')
    .select('id, sender_id, created_at')
    .eq('receiver_id', userId)
    .eq('status', 'pending');

  if (error) throw new BadRequestError('Failed to get pending requests');

  // Fetch sender profile details
  const senderIds = data.map(r => r.sender_id);
  if (senderIds.length === 0) return [];

  const { data: profiles, error: pErr } = await supabaseAdmin
    .from('user_profiles')
    .select('id, first_name, last_name, avatar_url, profession, user_type')
    .in('id', senderIds);

  if (pErr) throw new BadRequestError('Failed to load sender profiles');

  return data.map(item => {
    const profile = profiles.find(p => p.id === item.sender_id);
    return {
      id: item.id,
      sender: profile || { id: item.sender_id, first_name: 'User', last_name: '' },
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

  return profiles;
}

/**
 * Get connection status
 */
async function getConnectionStatus(userId, otherUserIdOrUsername) {
  const otherUserId = await resolveUserId(otherUserIdOrUsername);
  if (!otherUserId) throw new NotFoundError('Target user not found');
  if (userId === otherUserId) return { status: 'self' };

  const { data, error } = await supabaseAdmin
    .from('connections')
    .select('*')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
    .maybeSingle();

  if (error) throw new BadRequestError('Failed to load connection status');
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

  const { count, error } = await supabaseAdmin
    .from('connections')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error) throw new BadRequestError('Failed to count connections');
  return count || 0;
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
  return { success: true };
}

module.exports = {
  sendRequest,
  respondRequest,
  getPendingRequests,
  getConnectionsList,
  getConnectionStatus,
  getConnectionCount,
  withdrawRequest
};

