'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { moderateText } = require('../../config/openai');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../../utils/errors');
const logger = require('../../utils/logger');

async function createComment(userId, postId, body) {
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('id, user_id, is_hidden')
    .eq('id', postId)
    .maybeSingle();

  if (!post || post.is_hidden) throw new NotFoundError('Post not found');

  const mod = await moderateText(body);
  if (mod.flagged) throw new BadRequestError('Comment violates community guidelines', 'CONTENT_BLOCKED');

  const { data: comment, error } = await supabaseAdmin
    .from('comments')
    .insert({ post_id: postId, user_id: userId, body })
    .select('id, body, created_at')
    .single();

  if (error) throw new BadRequestError('Failed to create comment');

  // Notify post author
  if (post.user_id !== userId) {
    await supabaseAdmin.from('notifications').insert({
      user_id: post.user_id,
      type: 'new_comment',
      title: 'New comment on your post',
      body: 'Someone commented on your post.',
      reference_type: 'post',
      reference_id: postId,
    });
  }

  const { data: commenter } = await supabaseAdmin
    .from('user_profiles')
    .select('id, first_name, last_name, avatar_url')
    .eq('id', userId)
    .single();

  logger.info('Comment created', { commentId: comment.id, postId, userId });
  return { ...comment, commenter };
}

async function getComments(postId, userId, { cursor, pageSize }) {
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('id, is_hidden, user_id')
    .eq('id', postId)
    .maybeSingle();

  if (!post || (post.is_hidden && post.user_id !== userId)) throw new NotFoundError('Post not found');

  let query = supabaseAdmin
    .from('comments')
    .select('id, body, is_hidden, created_at, user_id', { count: 'exact' })
    .eq('post_id', postId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })
    .limit(pageSize + 1);

  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query = query.gt('created_at', decoded.created_at);
  }

  const { data, count, error } = await query;
  if (error) throw new BadRequestError('Failed to fetch comments');

  const hasMore = data.length > pageSize;
  const items = hasMore ? data.slice(0, pageSize) : data;
  const lastItem = items[items.length - 1];

  // Batch fetch commenter profiles
  const commenterIds = [...new Set(items.map((c) => c.user_id))];
  const { data: commenters } = await supabaseAdmin
    .from('user_profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', commenterIds);
  const commenterMap = new Map((commenters || []).map((c) => [c.id, c]));

  // Check helpful status for each comment (gracefully degrade if ledger table doesn't exist)
  const helpfulChecks = await Promise.all(
    items.map(async (c) => {
      try {
        const { data: mark } = await supabaseAdmin
          .from('ledger_transactions')
          .select('id')
          .eq('comment_id', c.id)
          .eq('source_user_id', userId)
          .eq('action_type', 'helpful_comment')
          .maybeSingle();
        return { commentId: c.id, isMarkedHelpful: !!mark };
      } catch {
        return { commentId: c.id, isMarkedHelpful: false };
      }
    })
  );
  const helpfulMap = new Map(helpfulChecks.map((h) => [h.commentId, h.isMarkedHelpful]));

  const itemsWithDetails = items.map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    is_marked_helpful: helpfulMap.get(c.id) || false,
    commenter: commenterMap.get(c.user_id) || null,
  }));

  return {
    data: itemsWithDetails,
    pagination: {
      hasMore, total: count, pageSize: itemsWithDetails.length,
      ...(hasMore && lastItem
        ? { nextCursor: Buffer.from(JSON.stringify({ created_at: lastItem.created_at, id: lastItem.id })).toString('base64') }
        : {}),
    },
  };
}

async function deleteComment(commentId, userId) {
  const { data: comment } = await supabaseAdmin
    .from('comments')
    .select('id, user_id, post_id')
    .eq('id', commentId)
    .maybeSingle();

  if (!comment) throw new NotFoundError('Comment not found');

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('user_id')
    .eq('id', comment.post_id)
    .single();

  if (comment.user_id !== userId && (!post || post.user_id !== userId)) {
    throw new ForbiddenError('You can only delete your own comments or comments on your posts');
  }

  await supabaseAdmin.from('comments').delete().eq('id', commentId);
  logger.info('Comment deleted', { commentId, userId });
  return { deleted: true };
}

module.exports = { createComment, getComments, deleteComment };
