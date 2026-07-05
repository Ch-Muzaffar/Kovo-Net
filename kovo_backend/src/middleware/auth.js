'use strict';

const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');
const { createUserClient } = require('../config/supabase');
const env = require('../config/env');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const cache = require('../utils/cache');

/**
 * Validates the Supabase JWT from the Authorization header.
 * Creates a user-scoped Supabase client attached to req.
 * 
 * PERF: Uses cache-first strategy for user validation + parallel async checks.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) throw new UnauthorizedError('Missing token');

    // Decode JWT payload (signature validation is securely handled by supabaseAdmin.auth.getUser below)
    const payload = jwt.decode(token);
    if (!payload) throw new UnauthorizedError('Invalid token');

    // Check expiration locally to save a roundtrip for expired tokens
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new UnauthorizedError('Token expired', 'TOKEN_EXPIRED');
    }

    // PERF: Check if we have a cached validated user to skip all DB lookups
    const userCacheKey = `auth-user:${payload.sub}`;
    const cachedUser = await cache.get(userCacheKey);

    if (cachedUser && cachedUser.tokenJti === payload.jti) {
      // Cached user is still valid for this exact token — skip all DB checks
      req.user = { id: cachedUser.id, email: cachedUser.email, role: payload.role || 'authenticated' };
      req.accessToken = token;
      req.supabase = createUserClient(token);
      next();
      return;
    }

    // PERF: Run token blacklist check, user auth verification, AND ban check ALL concurrently
    const [blacklistRes, authRes, profileRes] = await Promise.all([
      supabaseAdmin
        .from('token_blacklist')
        .select('jti')
        .eq('jti', payload.jti)
        .maybeSingle(),
      supabaseAdmin.auth.getUser(token),
      // PERF: Moved ban check into the parallel batch (was a separate sequential call)
      supabaseAdmin
        .from('user_profiles')
        .select('banned, banned_reason')
        .eq('id', payload.sub)
        .maybeSingle(),
    ]);

    if (blacklistRes.data) {
      throw new UnauthorizedError('Token has been revoked', 'TOKEN_REVOKED');
    }

    const { data: { user }, error: authError } = authRes;
    if (authError || !user) {
      throw new UnauthorizedError('User not found or token invalid');
    }

    const profile = profileRes.data;
    if (profile?.banned) {
      throw new ForbiddenError(
        `Account suspended: ${profile.banned_reason || 'Violation of terms'}`,
        'ACCOUNT_BANNED'
      );
    }

    // PERF: Cache the validated user for subsequent requests (TTL from env, usually 60s)
    cache.set(userCacheKey, {
      id: user.id,
      email: user.email,
      tokenJti: payload.jti,
    });

    req.user = { id: user.id, email: user.email, role: payload.role || 'authenticated' };
    req.accessToken = token;
    req.supabase = createUserClient(token);

    // Fire-and-forget IP tracking
    cache.set(`user-ip:${user.id}`, req.ip, 3600);

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Restricts access to admin users only. Must follow authenticate.
 */
function requireAdmin(req, res, next) {
  const email = req.user?.email?.toLowerCase();
  if (!email || !env.ADMIN_EMAIL_LIST.includes(email)) {
    return next(new ForbiddenError('Admin access required', 'ADMIN_ONLY'));
  }
  req.isAdmin = true;
  next();
}

module.exports = { authenticate, requireAdmin };
