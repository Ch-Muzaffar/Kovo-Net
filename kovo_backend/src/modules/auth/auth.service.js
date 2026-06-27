'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { ConflictError, BadRequestError } = require('../../utils/errors');
const logger = require('../../utils/logger');

/** Step 2: Create or update user profile after Supabase Auth registration. */
async function onboardUser(userId, data) {
  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .upsert({
      id: userId,
      username: data.username || null,
      first_name: data.first_name,
      last_name: data.last_name,
      date_of_birth: data.date_of_birth,
      country: data.country,
      city: data.city,
      profession: data.profession,
      user_type: data.user_type,
      is_profile_complete: true,
    })
    .select('id, username, first_name, last_name, is_profile_complete, tos_accepted')
    .single();

  if (error) {
    logger.error('Failed to onboard user profile', { userId, error: error.message });
    throw new BadRequestError('Failed to save profile: ' + error.message);
  }

  // Safely ensure a user_points entry exists
  const { data: existingPoints } = await supabaseAdmin
    .from('user_points')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existingPoints) {
    await supabaseAdmin.from('user_points').insert({ user_id: userId });
  }

  logger.info('User profile onboarded', { userId });
  return profile;
}

/** Step 3: Accept Terms of Service. */
async function acceptTos(userId) {
  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      tos_accepted: true,
      tos_accepted_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id, tos_accepted, tos_accepted_at')
    .single();

  if (error || !profile) {
    throw new BadRequestError('Profile not found');
  }
  return profile;
}

/** Refresh access token. */
async function refreshToken(refreshToken) {
  const { data, error } = await supabaseAdmin.auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (error) {
    throw new BadRequestError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
  };
}

/** Blacklist the current token (logout). */
async function logout(tokenJti, tokenExp) {
  await supabaseAdmin.from('token_blacklist').insert({
    jti: tokenJti,
    exp: new Date(tokenExp * 1000).toISOString(),
  });
  logger.info('Token blacklisted', { jti: tokenJti });
}

module.exports = { onboardUser, acceptTos, refreshToken, logout };
