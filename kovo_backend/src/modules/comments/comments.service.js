'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { moderateText } = require('../../config/openai');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../../utils/errors');
const logger = require('../../utils/logger');

async function createComment(userId, postId, body) {
  // Step 1: Concurrently run post check, content moderation, and fetch commenter profile
  const [postRes, mod, commenterRes] = await Promise.all([
    supabaseAdmin
      .from('posts')
      .select('id, user_id, is_hidden')
      .eq('id', postId)
      .maybeSingle(),
    moderateText(body),
    supabaseAdmin
      .from('user_profiles')
      .select('id, first_name, last_name, avatar_url')
      .eq('id', userId)
      .single()
  ]);

  const post = postRes.data;
  if (!post || post.is_hidden) throw new NotFoundError('Post not found');
  if (mod.flagged) throw new BadRequestError('Comment violates community guidelines', 'CONTENT_BLOCKED');

  const commenter = commenterRes.data;

  // Step 2: Insert comment record
  const { data: comment, error } = await supabaseAdmin
    .from('comments')
    .insert({ post_id: postId, user_id: userId, body })
    .select('id, body, created_at')
    .single();

  if (error) throw new BadRequestError('Failed to create comment');

  // Step 3: Send notifications asynchronously in the background
  if (post.user_id !== userId) {
    supabaseAdmin.from('notifications').insert({
      user_id: post.user_id,
      type: 'new_comment',
      title: 'New comment on your post',
      body: 'Someone commented on your post.',
      reference_type: 'post',
      reference_id: postId,
    }).catch((err) => {
      logger.error('Failed to insert comment notification', { postId, error: err.message });
    });
  }

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

  // Batch fetch commenter profiles, helpful marks, and reactions concurrently
  const commenterIds = [...new Set(items.map((c) => c.user_id))];
  const commentIds = items.map((c) => c.id);

  const [commentersRes, helpfulMarksRes, reactionsMap] = await Promise.all([
    commenterIds.length > 0
      ? supabaseAdmin
          .from('user_profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', commenterIds)
      : Promise.resolve({ data: [] }),
    commentIds.length > 0
      ? supabaseAdmin
          .from('ledger_transactions')
          .select('comment_id')
          .in('comment_id', commentIds)
          .eq('source_user_id', userId)
          .eq('action_type', 'helpful_comment')
      : Promise.resolve({ data: [] }),
    (async () => {
      try {
        const { getReactionsForTargets } = require('../reactions/reactions.service');
        return await getReactionsForTargets('comment', commentIds);
      } catch (err) {
        logger.error('Failed to get reactions for comments', { error: err.message });
        return {};
      }
    })()
  ]);

  const commenterMap = new Map((commentersRes.data || []).map((c) => [c.id, c]));

  const helpfulMap = new Map();
  (helpfulMarksRes.data || []).forEach((m) => {
    helpfulMap.set(m.comment_id, true);
  });

  const itemsWithDetails = items.map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    is_marked_helpful: helpfulMap.has(c.id),
    commenter: commenterMap.get(c.user_id) || null,
    reactions: reactionsMap[c.id] || []
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

  // PERF: Run post ownership check and point reclamation concurrently
  const [postRes] = await Promise.all([
    supabaseAdmin
      .from('posts')
      .select('user_id')
      .eq('id', comment.post_id)
      .single(),
  ]);

  const post = postRes.data;
  if (comment.user_id !== userId && (!post || post.user_id !== userId)) {
    throw new ForbiddenError('You can only delete your own comments or comments on your posts');
  }

  // PERF: Run point reclamation and comment deletion concurrently
  const { reclaimPointsForComment } = require('../ledger/ledger.service');
  await Promise.all([
    reclaimPointsForComment(commentId),
    supabaseAdmin.from('comments').delete().eq('id', commentId),
  ]);

  logger.info('Comment deleted', { commentId, userId });
  return { deleted: true };
}

module.exports = { createComment, getComments, deleteComment };
