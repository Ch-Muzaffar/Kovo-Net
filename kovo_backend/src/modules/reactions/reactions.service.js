'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { BadRequestError } = require('../../utils/errors');

async function toggleReaction(userId, { targetId, targetType, emoji }) {
  if (!['message', 'comment'].includes(targetType)) {
    throw new BadRequestError('Invalid target type for reaction');
  }

  // Check if reaction already exists for this user, target, and emoji
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('reactions')
    .select('id, emoji')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();

  if (fetchError) throw new BadRequestError('Failed to verify reaction status');

  if (existing) {
    if (existing.emoji === emoji) {
      // Remove reaction if clicking the same emoji
      const { error: deleteError } = await supabaseAdmin
        .from('reactions')
        .delete()
        .eq('id', existing.id);
      if (deleteError) throw new BadRequestError('Failed to remove reaction');
      return { action: 'removed', emoji };
    } else {
      // Update reaction if changing emoji
      const { error: updateError } = await supabaseAdmin
        .from('reactions')
        .update({ emoji })
        .eq('id', existing.id);
      if (updateError) throw new BadRequestError('Failed to change reaction');
      return { action: 'updated', emoji };
    }
  } else {
    // Add reaction
    const { error: insertError } = await supabaseAdmin
      .from('reactions')
      .insert({ user_id: userId, target_type: targetType, target_id: targetId, emoji })
      .select('*')
      .single();
    if (insertError) throw new BadRequestError('Failed to add reaction');
    return { action: 'added', emoji };
  }
}

async function getReactionsForTargets(targetType, targetIds) {
  if (targetIds.length === 0) return {};
  const { data, error } = await supabaseAdmin
    .from('reactions')
    .select('user_id, target_id, emoji')
    .eq('target_type', targetType)
    .in('target_id', targetIds);

  if (error) return {};

  const map = {};
  for (const r of data) {
    if (!map[r.target_id]) map[r.target_id] = [];
    map[r.target_id].push({ userId: r.user_id, emoji: r.emoji });
  }
  return map;
}

module.exports = { toggleReaction, getReactionsForTargets };
