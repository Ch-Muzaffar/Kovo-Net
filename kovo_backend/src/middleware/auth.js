'use strict';

const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');
const { createUserClient } = require('../config/supabase');
const env = require('../config/env');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Validates the Supabase JWT from the Authorization header.
 * Creates a user-scoped Supabase client attached to req.
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

    // Check token blacklist (for logout)
    const { data: blacklisted } = await supabaseAdmin
      .from('token_blacklist')
      .select('jti')
      .eq('jti', payload.jti)
      .maybeSingle();

    if (blacklisted) {
      throw new UnauthorizedError('Token has been revoked', 'TOKEN_REVOKED');
    }

    // Verify user still exists in Supabase Auth
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      throw new UnauthorizedError('User not found or token invalid');
    }

    // Check if banned
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('banned, banned_reason')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.banned) {
      throw new ForbiddenError(
        `Account suspended: ${profile.banned_reason || 'Violation of terms'}`,
        'ACCOUNT_BANNED'
      );
    }

    req.user = { id: user.id, email: user.email, role: payload.role || 'authenticated' };
    req.accessToken = token;
    req.supabase = createUserClient(token);

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
