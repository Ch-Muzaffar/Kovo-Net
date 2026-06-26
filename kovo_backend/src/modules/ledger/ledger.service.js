'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { NotFoundError, BadRequestError, ConflictError } = require('../../utils/errors');
const env = require('../../config/env');
const cache = require('../../utils/cache');
const logger = require('../../utils/logger');

/**
 * Awards points for marking a comment as helpful.
 *
 * Penalty engine:
 *   IF target_user.is_profile_complete == false
 *   THEN pointsAwarded = BasePoints * (1 - 0.2) = 8 out of 10
 *
 * Records as an immutable ledger transaction (not a simple integer update).
 */
async function awardHelpfulPoints(sourceUserId, commentId) {
  const { data: comment } = await supabaseAdmin
    .from('comments')
    .select('id, user_id, post_id, is_hidden')
    .eq('id', commentId)
    .maybeSingle();

  if (!comment || comment.is_hidden) throw new NotFoundError('Comment not found');
  if (comment.user_id === sourceUserId) {
    throw new BadRequestError('You cannot mark your own comment as helpful');
  }

  // Duplicate check (friendly error; unique index is the real guard)
  const { data: existing } = await supabaseAdmin
    .from('ledger_transactions')
    .select('id')
    .eq('comment_id', commentId)
    .eq('source_user_id', sourceUserId)
    .eq('action_type', 'helpful_comment')
    .maybeSingle();

  if (existing) throw new ConflictError('You have already marked this comment as helpful');

  // Penalty calculation
  const { data: targetProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('is_profile_complete')
    .eq('id', comment.user_id)
    .single();

  const penaltyRate = targetProfile?.is_profile_complete ? 0 : env.PROFILE_PENALTY_RATE;
  const basePoints = env.BASE_HELPFUL_POINTS;
  const pointsAwarded = Math.round(basePoints * (1 - penaltyRate));

  // Insert immutable ledger transaction
  const { data: transaction, error: txError } = await supabaseAdmin
    .from('ledger_transactions')
    .insert({
      target_user_id: comment.user_id,
      source_user_id: sourceUserId,
      post_id: comment.post_id,
      comment_id: commentId,
      action_type: 'helpful_comment',
      base_points: basePoints,
      penalty_rate: penaltyRate,
      points_awarded: pointsAwarded,
    })
    .select('id, action_type, points_awarded, penalty_rate, created_at')
    .single();

  if (txError) {
    if (txError.code === '23505') throw new ConflictError('You have already marked this comment as helpful');
    logger.error('Failed to award points', { error: txError.message });
    throw new BadRequestError('Failed to award points');
  }

  // Atomic points increment
  const { error: rpcError } = await supabaseAdmin.rpc('increment_points', {
    p_user_id: comment.user_id,
    p_points: pointsAwarded,
  });

  if (rpcError) {
    // Fallback: manual update if RPC not available
    const { data: current } = await supabaseAdmin
      .from('user_points')
      .select('total_points')
      .eq('user_id', comment.user_id)
      .single();
    if (current) {
      const newTotal = current.total_points + pointsAwarded;
      await supabaseAdmin
        .from('user_points')
        .update({ total_points: newTotal, level: Math.max(1, Math.floor(newTotal / 100) + 1), updated_at: new Date().toISOString() })
        .eq('user_id', comment.user_id);
    }
  }

  cache.invalidate(`points:${comment.user_id}`);

  // Notify target
  await supabaseAdmin.from('notifications').insert({
    user_id: comment.user_id,
    type: 'helpful_mark',
    title: 'Your comment was marked as helpful!',
    body: penaltyRate > 0
      ? `You earned ${pointsAwarded} points (80% penalty — complete your profile for full points!)`
      : `You earned ${pointsAwarded} points!`,
    reference_type: 'comment',
    reference_id: commentId,
  });

  logger.info('Points awarded', { transactionId: transaction.id, target: comment.user_id, source: sourceUserId, pointsAwarded, penaltyRate });
  return transaction;
}

module.exports = { awardHelpfulPoints };
