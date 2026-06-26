'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { moderateText } = require('../../config/openai');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../../utils/errors');
const logger = require('../../utils/logger');
const cache = require('../../utils/cache');

async function createPost(userId, data) {
  const moderationResult = await moderateText(data.title + ' ' + data.body);
  if (moderationResult.flagged) {
    logger.warn('Post blocked by moderation', { userId, categories: moderationResult.categories });
    throw new BadRequestError('Content violates community guidelines', 'CONTENT_BLOCKED');
  }

  // Only allow Cloudinary URLs (prevent SSRF)
  const validAttachments = data.attachments.filter((a) =>
    a.url.startsWith('https://res.cloudinary.com/')
  );

  const { data: post, error: postError } = await supabaseAdmin
    .from('posts')
    .insert({ user_id: userId, title: data.title, body: data.body, attachments: validAttachments })
    .select('id, user_id, title, body, attachments, is_hidden, created_at')
    .single();

  if (postError) {
    logger.error('Failed to create post', { userId, error: postError.message });
    throw new BadRequestError('Failed to create post');
  }

  // Batch insert tags (avoids N+1)
  if (data.tags.length > 0) {
    await supabaseAdmin.from('post_tags').insert(
      data.tags.map((t) => ({ post_id: post.id, tag_type: t.type, tag_value: t.value }))
    );
  }

  cache.invalidatePattern('feed:');

  const { data: creator } = await supabaseAdmin
    .from('user_profiles')
    .select('id, first_name, last_name, avatar_url')
    .eq('id', userId)
    .single();

  logger.info('Post created', { postId: post.id, userId, tagCount: data.tags.length });
  return { ...post, tags: data.tags || [], creator };
}

async function getPost(postId, userId) {
  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .select('*, creator:user_profiles(id, first_name, last_name, avatar_url)')
    .eq('id', postId)
    .maybeSingle();

  if (error || !post) throw new NotFoundError('Post not found');
  if (post.is_hidden && post.user_id !== userId) throw new NotFoundError('Post not found');

  const { data: tags } = await supabaseAdmin
    .from('post_tags')
    .select('tag_type, tag_value')
    .eq('post_id', postId);

  return { ...post, tags: tags || [] };
}

async function updatePost(postId, userId, data) {
  const { data: existing } = await supabaseAdmin
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .single();

  if (!existing) throw new NotFoundError('Post not found');
  if (existing.user_id !== userId) throw new ForbiddenError('You can only edit your own posts');

  if (data.title || data.body) {
    const text = [data.title, data.body].filter(Boolean).join(' ');
    const mod = await moderateText(text);
    if (mod.flagged) throw new BadRequestError('Content violates community guidelines', 'CONTENT_BLOCKED');
  }

  const updateData = { updated_at: new Date().toISOString() };
  if (data.title) updateData.title = data.title;
  if (data.body) updateData.body = data.body;

  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .update(updateData)
    .eq('id', postId)
    .select('id, title, body, attachments, is_hidden, updated_at')
    .single();

  if (error) throw new BadRequestError('Failed to update post');

  if (data.tags) {
    await supabaseAdmin.from('post_tags').delete().eq('post_id', postId);
    if (data.tags.length > 0) {
      await supabaseAdmin.from('post_tags').insert(
        data.tags.map((t) => ({ post_id: postId, tag_type: t.type, tag_value: t.value }))
      );
    }
  }

  cache.invalidatePattern('feed:');
  return post;
}

async function deletePost(postId, userId) {
  const { data: existing } = await supabaseAdmin
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .single();

  if (!existing) throw new NotFoundError('Post not found');
  if (existing.user_id !== userId) throw new ForbiddenError('You can only delete your own posts');

  const { error } = await supabaseAdmin.from('posts').delete().eq('id', postId);
  if (error) throw new BadRequestError('Failed to delete post');

  cache.invalidatePattern('feed:');
  logger.info('Post deleted', { postId, userId });
  return { deleted: true };
}

async function getUserPosts(targetUserId, _requesterId, { cursor, pageSize }) {
  let query = supabaseAdmin
    .from('posts')
    .select('id, user_id, title, body, attachments, is_hidden, created_at', { count: 'exact' })
    .eq('user_id', targetUserId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query = query.lt('created_at', decoded.created_at);
  }

  const { data, count, error } = await query;
  if (error) throw new BadRequestError('Failed to fetch posts');

  const hasMore = data.length > pageSize;
  const items = hasMore ? data.slice(0, pageSize) : data;
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem
    ? Buffer.from(JSON.stringify({ created_at: lastItem.created_at, id: lastItem.id })).toString('base64')
    : null;

  return { data: items, pagination: { hasMore, total: count, nextCursor } };
}

module.exports = { createPost, getPost, updatePost, deletePost, getUserPosts };
