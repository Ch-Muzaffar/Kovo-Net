'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { parseCursor, encodeCursor } = require('../../utils/pagination');
const cache = require('../../utils/cache');

/**
 * The 70/30 Feed Engine.
 *
 * 1. Retrieve user's skills, departments, hobbies from profile.
 * 2. Execute Query A (70% targeted) and Query B (30% discovery) in parallel.
 * 3. If Query A is insufficient, backfill from Query B.
 * 4. Interleave, sort deterministically, paginate via cursor.
 */
async function getFeed(userId, { cursor, pageSize }) {
  const cacheKey = `feed:${userId}:${cursor || 'start'}:${pageSize}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // ─── Step 1: Context Retrieval ───
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('departments, hobbies, master_skills')
    .eq('id', userId)
    .single();

  if (!profile) return getDiscoveryFeed(userId, { cursor, pageSize });

  const userTags = [
    ...(profile.departments || []),
    ...(profile.hobbies || []),
    ...(profile.master_skills || []),
    // Also use profession from mock DB as a tag
    ...(profile.profession ? [profile.profession] : []),
  ].filter(Boolean);

  // ─── Step 2: Parallel Execution ───
  const targetCount = Math.ceil(pageSize * 0.7);
  const discoveryCount = Math.ceil(pageSize * 0.3);

  const [targetResults, discoveryResults] = await Promise.all([
    userTags.length > 0
      ? queryTargetPosts(userId, userTags, targetCount + 2, cursor)
      : Promise.resolve([]),
    queryDiscoveryPosts(userId, discoveryCount + 2, cursor),
  ]);

  // ─── Step 3: Fallback Protocol ───
  let targetPosts = targetResults;
  if (targetPosts.length < targetCount) {
    const shortfall = targetCount - targetPosts.length;
    const backfill = discoveryResults
      .filter((d) => !targetPosts.some((t) => t.id === d.id))
      .slice(0, shortfall);
    targetPosts = [...targetPosts, ...backfill];
  }

  const targetIds = new Set(targetPosts.map((p) => p.id));
  const uniqueDiscovery = discoveryResults.filter((d) => !targetIds.has(d.id));

  // ─── Step 4: Interleaving ───
  const merged = [...targetPosts, ...uniqueDiscovery.slice(0, discoveryCount)];
  merged.sort((a, b) => {
    const dateDiff = new Date(b.created_at) - new Date(a.created_at);
    if (dateDiff !== 0) return dateDiff;
    return b.id.localeCompare(a.id);
  });

  const hasMore = merged.length > pageSize;
  const items = merged.slice(0, pageSize);
  const lastItem = items[items.length - 1];

  // Batch fetch creators (no N+1)
  const creatorIds = [...new Set(items.map((p) => p.user_id))];
  const { data: creators } = await supabaseAdmin
    .from('user_profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', creatorIds);
  const creatorMap = new Map((creators || []).map((c) => [c.id, c]));

  // Batch fetch comment counts for all posts
  const postIds = items.map((p) => p.id);
  const commentCountMap = new Map();
  if (postIds.length > 0) {
    const { data: commentRows } = await supabaseAdmin
      .from('comments')
      .select('post_id', { count: 'exact' })
      .in('post_id', postIds)
      .eq('is_hidden', false);
    // Count comments per post
    (commentRows || []).forEach((c) => {
      commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) || 0) + 1);
    });
  }

  const itemsWithCreators = items.map((post) => ({
    ...post,
    creator: creatorMap.get(post.user_id) || null,
    comments_count: commentCountMap.get(post.id) || 0,
  }));

  const result = {
    data: itemsWithCreators,
    pagination: {
      hasMore,
      pageSize: itemsWithCreators.length,
      ...(hasMore && lastItem ? { nextCursor: encodeCursor(lastItem.created_at, lastItem.id) } : {}),
    },
  };

  cache.set(cacheKey, result);
  return result;
}

async function queryTargetPosts(userId, userTags, limit, cursor) {
  let query = supabaseAdmin
    .from('posts')
    .select('id, user_id, title, body, attachments, is_hidden, created_at')
    .eq('is_hidden', false)
    .neq('user_id', userId)
    .in('id', supabaseAdmin
      .from('post_tags')
      .select('post_id')
      .in('tag_value', userTags))
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    const decoded = parseCursor(cursor);
    if (decoded) {
      query = query.lt('created_at', decoded.created_at);
    }
  }

  const { data } = await query;
  return data || [];
}

async function queryDiscoveryPosts(userId, limit, cursor) {
  let query = supabaseAdmin
    .from('posts')
    .select('id, user_id, title, body, attachments, is_hidden, created_at')
    .eq('is_hidden', false)
    .neq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit * 3);

  if (cursor) {
    const decoded = parseCursor(cursor);
    if (decoded) query = query.lt('created_at', decoded.created_at);
  }

  const { data } = await query;
  if (!data || data.length === 0) return [];

  // Fisher-Yates shuffle
  const shuffled = [...data];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, limit);
}

async function getDiscoveryFeed(userId, { cursor, pageSize }) {
  let query = supabaseAdmin
    .from('posts')
    .select('id, user_id, title, body, attachments, is_hidden, created_at', { count: 'exact' })
    .eq('is_hidden', false)
    .neq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (cursor) {
    const decoded = parseCursor(cursor);
    if (decoded) query = query.lt('created_at', decoded.created_at);
  }

  const { data = [], count = 0 } = await query || {};
  const hasMore = data.length > pageSize;
  const items = hasMore ? data.slice(0, pageSize) : data;

  const creatorIds = [...new Set(items.map((p) => p.user_id))];
  const { data: creators } = await supabaseAdmin
    .from('user_profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', creatorIds);
  const creatorMap = new Map((creators || []).map((c) => [c.id, c]));

  // Batch fetch comment counts
  const postIds = items.map((p) => p.id);
  const commentCountMap = new Map();
  if (postIds.length > 0) {
    const { data: commentRows } = await supabaseAdmin
      .from('comments')
      .select('post_id')
      .in('post_id', postIds)
      .eq('is_hidden', false);
    (commentRows || []).forEach((c) => {
      commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) || 0) + 1);
    });
  }

  return {
    data: items.map((post) => ({ ...post, creator: creatorMap.get(post.user_id) || null, comments_count: commentCountMap.get(post.id) || 0 })),
    pagination: { hasMore, pageSize: items.length, total: count },
  };
}

module.exports = { getFeed };
