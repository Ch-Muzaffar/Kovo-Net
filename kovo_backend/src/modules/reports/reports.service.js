'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { NotFoundError, ConflictError, BadRequestError } = require('../../utils/errors');
const env = require('../../config/env');
const logger = require('../../utils/logger');

async function createReport(reporterId, data) {
  const tableMap = { post: 'posts', comment: 'comments', dm: 'direct_messages' };
  const table = tableMap[data.target_type];
  if (!table) throw new BadRequestError('Invalid target type');

  const { data: target } = await supabaseAdmin
    .from(table)
    .select('id, is_hidden, report_count')
    .eq('id', data.target_id)
    .maybeSingle();

  if (!target) throw new NotFoundError('Target content not found');

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .insert({ reporter_id: reporterId, target_type: data.target_type, target_id: data.target_id, reason: data.reason })
    .select('id, target_type, target_id, reason, status, created_at')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') throw new ConflictError('You have already reported this content');
    throw new BadRequestError('Failed to submit report');
  }

  // Increment report count and check threshold
  const newCount = target.report_count + 1;
  const shouldHide = newCount >= env.REPORT_HIDE_THRESHOLD;

  const updateData = { report_count: newCount };
  if (shouldHide) updateData.is_hidden = true;

  await supabaseAdmin.from(table).update(updateData).eq('id', data.target_id);

  if (shouldHide) {
    logger.warn('Content auto-hidden due to reports', { type: data.target_type, id: data.target_id, reportCount: newCount });

    const authorField = data.target_type === 'dm' ? 'sender_id' : 'user_id';
    const { data: content } = await supabaseAdmin.from(table).select(authorField).eq('id', data.target_id).single();
    if (content) {
      await supabaseAdmin.from('notifications').insert({
        user_id: content[authorField],
        type: 'content_hidden',
        title: 'Your content was hidden',
        body: 'Your content received multiple reports and has been temporarily hidden pending review.',
        reference_type: data.target_type,
        reference_id: data.target_id,
      });
    }
  }

  logger.info('Report created', { reportId: report.id, reporter: reporterId, target: data.target_type, targetId: data.target_id, reason: data.reason });
  return report;
}

module.exports = { createReport };
