'use strict';

const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../../config/supabase');
const { onboardUser, acceptTos, refreshToken, logout } = require('./auth.service');
const { BadRequestError } = require('../../utils/errors');

class AuthController {
  /** POST /api/v1/auth/register */
  static async register(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        throw new BadRequestError('Email and password are required');
      }
      // Create user with auto-confirm enabled via Admin API
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw new BadRequestError(createError.message);

      // Sign in the newly created user to establish session
      const { data: sessionData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) throw new BadRequestError(loginError.message);

      res.status(201).json({
        data: {
          user: { id: userData.user.id, email: userData.user.email },
          session: {
            accessToken: sessionData.session.access_token,
            refreshToken: sessionData.session.refresh_token,
            expiresIn: sessionData.session.expires_in,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/auth/login */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        throw new BadRequestError('Email and password are required');
      }
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
      if (error) throw new BadRequestError(error.message || 'Invalid credentials');
      res.status(200).json({
        data: {
          user: { id: data.user.id, email: data.user.email },
          session: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresIn: data.session.expires_in,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/auth/onboard */
  static async onboard(req, res, next) {
    try {
      const result = await onboardUser(req.user.id, req.validatedBody);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/auth/accept-tos */
  static async acceptTos(req, res, next) {
    try {
      const result = await acceptTos(req.user.id);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/auth/refresh */
  static async refresh(req, res, next) {
    try {
      const { refresh_token: rt } = req.validatedBody;
      const result = await refreshToken(rt);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/auth/logout */
  static async logout(req, res, next) {
    try {
      const payload = jwt.decode(req.accessToken);
      if (payload?.jti && payload?.exp) {
        await logout(payload.jti, payload.exp);
      }
      res.status(200).json({ data: { message: 'Logged out successfully' } });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/auth/me */
  static async me(req, res, next) {
    try {
      const { data: profile, error: profileError } = await req.supabase
        .from('user_profiles')
        .select('id, first_name, last_name, is_profile_complete, tos_accepted, avatar_url, profession, user_type, country, city, bio')
        .eq('id', req.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[Error fetching profile in me]:', profileError);
      }

      // Fetch points from user_points table
      let points = 0;
      if (profile) {
        const { data: pointsData } = await req.supabase
          .from('user_points')
          .select('total_points')
          .eq('user_id', req.user.id)
          .maybeSingle();
        if (pointsData) {
          points = pointsData.total_points || 0;
        }
      }

      const profileWithPoints = profile ? { ...profile, points } : null;

      res.status(200).json({
        data: {
          id: req.user.id,
          email: req.user.email,
          profile: profileWithPoints,
          onboardingComplete: !!(profile?.tos_accepted),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
