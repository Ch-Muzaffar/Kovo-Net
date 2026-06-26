'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const cache = require('../../utils/cache');
const { NotFoundError, BadRequestError } = require('../../utils/errors');
const logger = require('../../utils/logger');

const PROFILE_CACHE_PREFIX = 'profile:';
const POINTS_CACHE_PREFIX = 'points:';

async function getProfile(userId) {
  const cacheKey = `${PROFILE_CACHE_PREFIX}${userId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, first_name, last_name, avatar_url, bio, departments, hobbies, master_skills, user_type, is_profile_complete, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) throw new NotFoundError('User profile not found');
  cache.set(cacheKey, data);
  return data;
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
      const finalDeps = updateData.departments ?? current.departments;
      const finalHobbies = updateData.hobbies ?? current.hobbies;
      const finalSkills = updateData.master_skills ?? current.master_skills;
      const complete = finalDeps.length > 0 && finalHobbies.length > 0 && finalSkills.length > 0;

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
    .select('id, first_name, last_name, avatar_url, bio, departments, hobbies, master_skills, is_profile_complete')
    .single();

  if (error) {
    logger.error('Failed to update profile', { userId, error: error.message });
    throw new BadRequestError('Failed to update profile');
  }

  cache.invalidate(`${PROFILE_CACHE_PREFIX}${userId}`);
  return data;
}

async function updateDemographics(userId, updates) {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, first_name, last_name, country, city, profession, user_type')
    .single();

  if (error) throw new BadRequestError('Failed to update demographics');
  cache.invalidate(`${PROFILE_CACHE_PREFIX}${userId}`);
  return data;
}

async function getPoints(userId) {
  const cacheKey = `${POINTS_CACHE_PREFIX}${userId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabaseAdmin
    .from('user_points')
    .select('total_points, level')
    .eq('user_id', userId)
    .single();

  if (error) throw new NotFoundError('Points record not found');
  cache.set(cacheKey, data);
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

module.exports = { getProfile, updateProfile, updateDemographics, getPoints, getLedgerHistory, deactivateUser };
