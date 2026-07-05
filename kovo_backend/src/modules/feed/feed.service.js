'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { parseCursor, encodeCursor } = require('../../utils/pagination');
const cache = require('../../utils/cache');

// PERF: In-memory profile cache for feed context (avoids repeated lookups)
const profileCache = new Map();
const PROFILE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getCachedProfile(userId) {
  const entry = profileCache.get(userId);
  if (entry && Date.now() < entry.exp) return entry.value;
  profileCache.delete(userId);
  return null;
}

function setCachedProfile(userId, value) {
  profileCache.set(userId, { value, exp: Date.now() + PROFILE_CACHE_TTL });
  if (profileCache.size > 200) {
    const firstKey = profileCache.keys().next().value;
    profileCache.delete(firstKey);
  }
}

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
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // ─── Step 1: Context Retrieval (with local cache) ───
  let profile = getCachedProfile(userId);
  if (!profile) {
    const { data: profileData } = await supabaseAdmin
      .from('user_profiles')
      .select('departments, hobbies, master_skills')
      .eq('id', userId)
      .single();
    profile = profileData;
    if (profile) setCachedProfile(userId, profile);
  }

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

  // ─── Step 4: Interleaving & Reputation-Weighted Ranking ───
  const merged = [...targetPosts, ...uniqueDiscovery.slice(0, discoveryCount)];

  // PERF: Batch fetch all supplementary data in a single parallel pass
  const mergedPostIds = merged.map((p) => p.id);
  const allCreatorIds = [...new Set(merged.map((p) => p.user_id))];

  const [commentRowsRes, pointsDataRes, creatorsRes] = await Promise.all([
    mergedPostIds.length > 0
      ? supabaseAdmin
          .from('comments')
          .select('post_id')
          .in('post_id', mergedPostIds)
          .eq('is_hidden', false)
      : Promise.resolve({ data: [] }),
    allCreatorIds.length > 0
      ? supabaseAdmin
          .from('user_points')
          .select('user_id, total_points')
          .in('user_id', allCreatorIds)
      : Promise.resolve({ data: [] }),
    allCreatorIds.length > 0
      ? supabaseAdmin
          .from('user_profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', allCreatorIds)
      : Promise.resolve({ data: [] })
  ]);

  const commentCountMap = new Map();
  (commentRowsRes.data || []).forEach((c) => {
    commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) || 0) + 1);
  });

  // Filter own posts: keep others' posts, keep own only if comments > 0 OR age < 24 hours
  const filteredMerged = merged.filter((post) => {
    if (post.user_id !== userId) return true;
    const commentsCount = commentCountMap.get(post.id) || 0;
    const ageInHours = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 3600);
    return commentsCount > 0 || ageInHours < 24;
  });

  const pointsMap = new Map((pointsDataRes.data || []).map((p) => [p.user_id, p.total_points]));

  filteredMerged.sort((a, b) => {
    const ageA = (Date.now() - new Date(a.created_at).getTime()) / (1000 * 3600);
    const ageB = (Date.now() - new Date(b.created_at).getTime()) / (1000 * 3600);
    
    const freshnessA = 1 / Math.pow(ageA + 2, 1.5);
    const freshnessB = 1 / Math.pow(ageB + 2, 1.5);
    
    const pointsA = pointsMap.get(a.user_id) || 0;
    const pointsB = pointsMap.get(b.user_id) || 0;
    
    const scoreA = freshnessA * (1 + Math.log10(pointsA + 1));
    const scoreB = freshnessB * (1 + Math.log10(pointsB + 1));
    
    return scoreB - scoreA;
  });

  const hasMore = filteredMerged.length > pageSize;
  const items = filteredMerged.slice(0, pageSize);
  const lastItem = items[items.length - 1];

  const creatorMap = new Map((creatorsRes.data || []).map((c) => [c.id, c]));

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

  await cache.set(cacheKey, result);
  return result;
}

async function queryTargetPosts(userId, userTags, limit, cursor) {
  // Step 1: Fetch post IDs matching the user's tags
  const { data: postTags, error: tagError } = await supabaseAdmin
    .from('post_tags')
    .select('post_id')
    .in('tag_value', userTags);

  if (tagError || !postTags || postTags.length === 0) return [];

  const postIds = [...new Set(postTags.map(pt => pt.post_id))];

  // Step 2: Fetch corresponding posts
  let query = supabaseAdmin
    .from('posts')
    .select('id, user_id, title, body, attachments, is_hidden, created_at')
    .eq('is_hidden', false)
    .in('id', postIds)
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
  // PERF: Removed { count: 'exact' } — forces full table scan
  let query = supabaseAdmin
    .from('posts')
    .select('id, user_id, title, body, attachments, is_hidden, created_at')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (cursor) {
    const decoded = parseCursor(cursor);
    if (decoded) query = query.lt('created_at', decoded.created_at);
  }

  const { data = [] } = await query || {};

  const postIds = data.map((p) => p.id);
  const allCreatorIds = [...new Set(data.map((p) => p.user_id))];

  // Batch fetch comment counts and creator profiles concurrently
  const [commentRowsRes, creatorsRes] = await Promise.all([
    postIds.length > 0
      ? supabaseAdmin
          .from('comments')
          .select('post_id')
          .in('post_id', postIds)
          .eq('is_hidden', false)
      : Promise.resolve({ data: [] }),
    allCreatorIds.length > 0
      ? supabaseAdmin
          .from('user_profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', allCreatorIds)
      : Promise.resolve({ data: [] })
  ]);

  const commentCountMap = new Map();
  (commentRowsRes.data || []).forEach((c) => {
    commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) || 0) + 1);
  });

  const filteredData = data.filter((post) => {
    if (post.user_id !== userId) return true;
    const commentsCount = commentCountMap.get(post.id) || 0;
    const ageInHours = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 3600);
    return commentsCount > 0 || ageInHours < 24;
  });

  const hasMore = filteredData.length > pageSize;
  const items = hasMore ? filteredData.slice(0, pageSize) : filteredData;

  const creatorMap = new Map((creatorsRes.data || []).map((c) => [c.id, c]));

  return {
    data: items.map((post) => ({ ...post, creator: creatorMap.get(post.user_id) || null, comments_count: commentCountMap.get(post.id) || 0 })),
    pagination: { hasMore, pageSize: items.length },
  };
}

module.exports = { getFeed };
