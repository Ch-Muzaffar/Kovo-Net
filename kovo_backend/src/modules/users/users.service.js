'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const cache = require('../../utils/cache');
const { NotFoundError, BadRequestError } = require('../../utils/errors');
const logger = require('../../utils/logger');

const PROFILE_CACHE_PREFIX = 'profile:';
const POINTS_CACHE_PREFIX = 'points:';

async function getProfile(userIdOrUsername) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isNumeric = /^\d+$/.test(userIdOrUsername);
  const isSequential = /^user[\s-]?\d+$/i.test(userIdOrUsername);
  const isAresId = /^00000000-0000-0000-0000-00000000000[a-z0-9]$/i.test(userIdOrUsername);
  const isId = uuidRegex.test(userIdOrUsername) || isNumeric || isSequential || isAresId;

  if (!isId) {
    // Treat as username (e.g. bob.jones or @bob.jones)
    const cleanUsername = userIdOrUsername.replace(/^@/, '').toLowerCase().trim();
    const parts = cleanUsername.split('.');
    const firstNameQuery = parts[0];
    const lastNameQuery = parts.slice(1).join('.');

    let query = supabaseAdmin
      .from('user_profiles')
      .select('id, username, first_name, last_name, avatar_url, bio, departments, hobbies, master_skills, user_type, is_profile_complete, created_at');

    if (firstNameQuery && lastNameQuery) {
      query = query.ilike('first_name', firstNameQuery).ilike('last_name', lastNameQuery);
    } else {
      query = query.or(`first_name.ilike.${cleanUsername},last_name.ilike.${cleanUsername}`);
    }

    const { data: matchedProfiles, error: matchError } = await query;
    if (matchError || !matchedProfiles || matchedProfiles.length === 0) {
      throw new NotFoundError('User profile not found');
    }
    return matchedProfiles[0];
  }

  const cacheKey = `${PROFILE_CACHE_PREFIX}${userIdOrUsername}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    // Revalidate in the background asynchronously to keep cache warm and fresh
    supabaseAdmin
      .from('user_profiles')
      .select('id, username, first_name, last_name, avatar_url, bio, departments, hobbies, master_skills, user_type, is_profile_complete, created_at')
      .eq('id', userIdOrUsername)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!error && data) {
          await cache.set(cacheKey, data);
        }
      })
      .catch(() => {});
    return cached;
  }

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, username, first_name, last_name, avatar_url, bio, departments, hobbies, master_skills, user_type, is_profile_complete, created_at')
    .eq('id', userIdOrUsername)
    .maybeSingle();

  if (error || !data) throw new NotFoundError('User profile not found');
  await cache.set(cacheKey, data);
  return data;
}

async function resolveUserId(userIdOrUsername) {
  if (!userIdOrUsername) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isNumeric = /^\d+$/.test(userIdOrUsername);
  const isSequential = /^user[\s-]?\d+$/i.test(userIdOrUsername);
  const isAresId = /^00000000-0000-0000-0000-00000000000[a-z0-9]$/i.test(userIdOrUsername);

  if (uuidRegex.test(userIdOrUsername) || isNumeric || isSequential || isAresId) {
    return userIdOrUsername;
  }
  try {
    const profile = await getProfile(userIdOrUsername);
    return profile.id;
  } catch (err) {
    return null;
  }
}

async function updateProfile(userId, updates) {
  const updateData = { updated_at: new Date().toISOString() };

  if (updates.departments !== undefined)  updateData.departments = updates.departments;
  if (updates.hobbies !== undefined)      updateData.hobbies = updates.hobbies;
  if (updates.master_skills !== undefined) updateData.master_skills = updates.master_skills;
  if (updates.avatar_url !== undefined)   updateData.avatar_url = updates.avatar_url;
  if (updates.bio !== undefined)          updateData.bio = updates.bio;

  // Check if all three enrichment fields are now populated
  if (updates.departments || updates.hobbies || updates.master_skills) {
    const { data: current } = await supabaseAdmin
      .from('user_profiles')
      .select('departments, hobbies, master_skills, is_profile_complete')
      .eq('id', userId)
      .single();

    if (current) {
      const finalDeps = updateData.departments ?? current.departments ?? [];
      const finalHobbies = updateData.hobbies ?? current.hobbies ?? [];
      const finalSkills = updateData.master_skills ?? current.master_skills ?? [];
      const complete = Array.isArray(finalDeps) && finalDeps.length > 0 && 
                       Array.isArray(finalHobbies) && finalHobbies.length > 0 && 
                       Array.isArray(finalSkills) && finalSkills.length > 0;

      if (complete && !current.is_profile_complete) {
        updateData.is_profile_complete = true;
        logger.info('Profile completed', { userId });
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .update(updateData)
    .eq('id', userId)
    .select('id, username, first_name, last_name, avatar_url, bio, departments, hobbies, master_skills, is_profile_complete')
    .single();

  if (error) {
    logger.error('Failed to update profile', { userId, error: error.message });
    throw new BadRequestError('Failed to update profile');
  }

  await cache.invalidate(`${PROFILE_CACHE_PREFIX}${userId}`);
  return data;
}

async function updateDemographics(userId, updates) {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, username, first_name, last_name, country, city, profession, user_type')
    .single();

  if (error) throw new BadRequestError('Failed to update demographics');
  await cache.invalidate(`${PROFILE_CACHE_PREFIX}${userId}`);
  return data;
}

async function getPoints(userId) {
  const cacheKey = `${POINTS_CACHE_PREFIX}${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    // Revalidate asynchronously in background to ensure cache updates
    supabaseAdmin
      .from('user_points')
      .select('total_points, level')
      .eq('user_id', userId)
      .single()
      .then(async ({ data, error }) => {
        if (!error && data) {
          await cache.set(cacheKey, data);
        }
      })
      .catch(() => {});
    return cached;
  }

  const { data, error } = await supabaseAdmin
    .from('user_points')
    .select('total_points, level')
    .eq('user_id', userId)
    .single();

  if (error) throw new NotFoundError('Points record not found');
  await cache.set(cacheKey, data);
  return data;
}

async function getLedgerHistory(userId, { cursor, pageSize }) {
  let query = supabaseAdmin
    .from('ledger_transactions')
    .select('id, action_type, base_points, penalty_rate, points_awarded, created_at', { count: 'exact' })
    .eq('target_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query = query.lt('created_at', decoded.created_at);
  }

  const { data, count, error } = await query;
  if (error) throw new BadRequestError('Failed to fetch ledger');

  const hasMore = data.length > pageSize;
  const items = hasMore ? data.slice(0, pageSize) : data;
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem
    ? Buffer.from(JSON.stringify({ created_at: lastItem.created_at, id: lastItem.id })).toString('base64')
    : null;

  return { data: items, pagination: { hasMore, total: count, nextCursor } };
}

async function deactivateUser(userId) {
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ banned: true, banned_reason: 'Account deleted by owner', updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    logger.error('Failed to deactivate user', { userId, error: error.message });
    throw new BadRequestError('Failed to deactivate account');
  }

  cache.invalidate(`${PROFILE_CACHE_PREFIX}${userId}`);
  return { success: true };
}

async function searchUsers(q) {
  if (!q || !q.trim()) return [];
  const cleanQ = q.trim();

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, username, email, first_name, last_name, avatar_url, profession, user_type, created_at')
    .or(`username.ilike.%${cleanQ}%,first_name.ilike.%${cleanQ}%,last_name.ilike.%${cleanQ}%,email.ilike.%${cleanQ}%`)
    .limit(20);

  if (error) {
    logger.error('Failed to search users', { q, error: error.message });
    throw new BadRequestError('Failed to search users');
  }

  // Get points for each profile to sort by reputation rank
  const userIds = data.map(u => u.id);
  if (userIds.length > 0) {
    const { data: pointsData } = await supabaseAdmin
      .from('user_points')
      .select('user_id, total_points')
      .in('user_id', userIds);
    const pointsMap = new Map((pointsData || []).map(p => [p.user_id, p.total_points]));
    
    data.forEach(u => {
      u.points = pointsMap.get(u.id) || 0;
    });
    
    data.sort((a, b) => b.points - a.points);
  }

  return data;
}

async function getFullProfile(requesterId, targetUserIdOrUsername) {
  const targetUserId = await resolveUserId(targetUserIdOrUsername);
  if (!targetUserId) throw new NotFoundError('User not found');

  const { getConnectionCount, getConnectionStatus } = require('../connections/connections.service');
  const { getUserPosts } = require('../posts/posts.service');

  const [profile, points, postsRes, connCount, connStatus] = await Promise.all([
    getProfile(targetUserId),
    getPoints(targetUserId).catch(() => ({ total_points: 0, level: 1 })),
    getUserPosts(targetUserId, requesterId, { cursor: null, pageSize: 20 }).catch(() => ({ data: [] })),
    getConnectionCount(targetUserId).catch(() => 0),
    requesterId === targetUserId
      ? Promise.resolve({ status: 'self', connectionId: null })
      : getConnectionStatus(requesterId, targetUserId).catch(() => ({ status: 'none', connectionId: null }))
  ]);

  return {
    profile: {
      ...profile,
      points: points.total_points || 0,
      level: points.level || 1,
    },
    posts: postsRes.data || [],
    connectionCount: connCount,
    connectionStatus: connStatus.status || 'none',
    connectionId: connStatus.connectionId || null,
  };
}

module.exports = { getProfile, updateProfile, updateDemographics, getPoints, getLedgerHistory, deactivateUser, resolveUserId, searchUsers, getFullProfile };
