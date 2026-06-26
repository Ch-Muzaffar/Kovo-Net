'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { moderateText } = require('../../config/openai');
const { NotFoundError, BadRequestError } = require('../../utils/errors');
const logger = require('../../utils/logger');

async function sendMessage(senderId, data) {
  if (senderId === data.receiver_id) throw new BadRequestError('Cannot send a message to yourself');

  const { data: receiver } = await supabaseAdmin
    .from('user_profiles')
    .select('id, banned')
    .eq('id', data.receiver_id)
    .maybeSingle();

  if (!receiver) throw new NotFoundError('Recipient not found');
  if (receiver.banned) throw new BadRequestError('Cannot message this user');

  if (data.post_id) {
    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', data.post_id)
      .maybeSingle();
    if (!post) throw new NotFoundError('Linked post not found');
  }

  const mod = await moderateText(data.body);
  if (mod.flagged) throw new BadRequestError('Message violates community guidelines', 'CONTENT_BLOCKED');

  const { data: message, error } = await supabaseAdmin
    .from('direct_messages')
    .insert({ sender_id: senderId, receiver_id: data.receiver_id, post_id: data.post_id || null, body: data.body })
    .select('id, body, post_id, created_at')
    .single();

  if (error) throw new BadRequestError('Failed to send message');

  await supabaseAdmin.from('notifications').insert({
    user_id: data.receiver_id,
    type: 'new_dm',
    title: 'New message',
    body: 'You received a new direct message.',
    reference_type: data.post_id ? 'post' : null,
    reference_id: data.post_id || null,
  });

  logger.info('DM sent', { messageId: message.id, sender: senderId, receiver: data.receiver_id });
  return message;
}

async function getConversations(userId) {
  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .select('id, sender_id, receiver_id, body, created_at')
    .eq('is_hidden', false)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw new BadRequestError('Failed to fetch conversations');

  const conversationMap = new Map();
  for (const msg of data) {
    const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    if (!conversationMap.has(partnerId)) conversationMap.set(partnerId, msg);
  }

  const partnerIds = [...conversationMap.keys()];
  const { data: partners } = await supabaseAdmin
    .from('user_profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', partnerIds);
  const partnerMap = new Map((partners || []).map((p) => [p.id, p]));

  const conversations = [...conversationMap.entries()].map(([partnerId, lastMsg]) => ({
    partner: partnerMap.get(partnerId) || { id: partnerId, first_name: 'Unknown', last_name: '' },
    lastMessage: { body: lastMsg.body, created_at: lastMsg.created_at, isMine: lastMsg.sender_id === userId },
  }));

  return { data: conversations };
}

async function getConversationMessages(userId, otherUserId, { cursor, pageSize }) {
  let query = supabaseAdmin
    .from('direct_messages')
    .select('id, sender_id, receiver_id, body, post_id, created_at', { count: 'exact' })
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

  const { data, count, error } = await query;
  if (error) throw new BadRequestError('Failed to fetch messages');

  const hasMore = data.length > pageSize;
  const items = (hasMore ? data.slice(0, pageSize) : data).reverse();
  const lastItem = data[0];

  return {
    data: items,
    pagination: {
      hasMore, total: count, pageSize: items.length,
      ...(hasMore && lastItem
        ? { nextCursor: Buffer.from(JSON.stringify({ created_at: lastItem.created_at, id: lastItem.id })).toString('base64') }
        : {}),
    },
  };
}

module.exports = { sendMessage, getConversations, getConversationMessages };
