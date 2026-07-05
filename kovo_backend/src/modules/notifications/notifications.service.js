'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { BadRequestError } = require('../../utils/errors');
const cache = require('../../utils/cache');

async function invalidateNotificationCache(userId) {
  try {
    await cache.invalidatePattern(`notifications:list:${userId}`);
  } catch (err) {
    // ignore
  }
}

async function getNotifications(userId, { cursor, pageSize, unreadOnly }) {
  const cacheKey = `notifications:list:${userId}:${cursor || 'none'}:${unreadOnly || 'false'}:${pageSize}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (unreadOnly === 'true') query = query.eq('is_read', false);

  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query = query.lt('created_at', decoded.created_at);
  }

  const { data, error } = await query;
  if (error) throw new BadRequestError('Failed to fetch notifications');

  const hasMore = data.length > pageSize;
  const items = hasMore ? data.slice(0, pageSize) : data;
  const lastItem = items[items.length - 1];

  const result = {
    data: items,
    pagination: {
      hasMore, total: items.length, pageSize: items.length,
      unreadCount: items.filter((n) => !n.is_read).length,
      ...(hasMore && lastItem
        ? { nextCursor: Buffer.from(JSON.stringify({ created_at: lastItem.created_at, id: lastItem.id })).toString('base64') }
        : {}),
    },
  };

  // Cache for 10 seconds to reduce rapid consecutive fetches
  await cache.set(cacheKey, result);
  return result;
}

async function markRead(notificationId, userId) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .eq('is_read', false)
    .select('id')
    .maybeSingle();

  if (error || !data) throw new BadRequestError('Notification not found or already read');
  
  // Invalidate cache in the background
  invalidateNotificationCache(userId);

  return { markedRead: true };
}

async function markAllRead(userId) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw new BadRequestError('Failed to mark notifications as read');
  
  // Invalidate cache in the background
  invalidateNotificationCache(userId);

  return { markedAllRead: true };
}

module.exports = { getNotifications, markRead, markAllRead };
