'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { NotFoundError, BadRequestError, ValidationError } = require('../../utils/errors');
const cache = require('../../utils/cache');
const logger = require('../../utils/logger');

async function getPendingReports({ cursor, pageSize }) {
  let query = supabaseAdmin
    .from('reports')
    .select('id, target_type, target_id, reason, status, created_at', { count: 'exact' })
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query = query.lt('created_at', decoded.created_at);
  }

  const { data, count, error } = await query;
  if (error) throw new BadRequestError('Failed to fetch reports');

  const hasMore = data.length > pageSize;
  const items = hasMore ? data.slice(0, pageSize) : data;
  const lastItem = items[items.length - 1];

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

async function resolveReport(reportId, adminId, { status, unhideContent }) {
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .update({ status, resolved_at: new Date().toISOString(), resolved_by: adminId })
    .eq('id', reportId)
    .eq('status', 'pending')
    .select('id, target_type, target_id, status')
    .maybeSingle();

  if (error || !report) throw new NotFoundError('Report not found or already resolved');

  if (unhideContent && status === 'dismissed') {
    const tableMap = { post: 'posts', comment: 'comments', dm: 'direct_messages' };
    const table = tableMap[report.target_type];
    if (table) {
      await supabaseAdmin.from(table).update({ is_hidden: false, report_count: 0 }).eq('id', report.target_id);
    }
  }

  logger.info('Report resolved', { reportId, status, adminId, unhideContent });
  return report;
}

async function banUser(targetUserId, adminId, { banned, reason }) {
  if (banned && !reason) {
    throw new ValidationError('Reason is required when banning a user');
  }

  const updateData = {
    banned,
    banned_at: banned ? new Date().toISOString() : null,
    banned_reason: banned ? reason : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .update(updateData)
    .eq('id', targetUserId)
    .select('id, first_name, last_name, banned, banned_reason')
    .single();

  if (error || !data) throw new NotFoundError('User not found');

  await supabaseAdmin.from('notifications').insert({
    user_id: targetUserId,
    type: banned ? 'account_banned' : 'account_unbanned',
    title: banned ? 'Account Suspended' : 'Account Restored',
    body: banned ? `Your account has been suspended: ${reason}` : 'Your account has been restored.',
  });

  cache.invalidate(`profile:${targetUserId}`);
  cache.invalidatePattern('feed:');

  logger.warn('User ban status changed', { targetUserId, adminId, banned, reason });
  return data;
}

async function getAllUsers({ cursor, pageSize }) {
  let query = supabaseAdmin
    .from('user_profiles')
    .select('id, first_name, last_name, user_type, is_profile_complete, banned, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query = query.lt('created_at', decoded.created_at);
  }

  const { data, count, error } = await query;
  if (error) throw new BadRequestError('Failed to fetch users');

  const hasMore = data.length > pageSize;
  const items = hasMore ? data.slice(0, pageSize) : data;
  const lastItem = items[items.length - 1];

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

module.exports = { getPendingReports, resolveReport, banUser, getAllUsers };
