'use strict';

const jwt = require('jsonwebtoken');
const { supabaseAdmin, supabaseAnon } = require('../../config/supabase');
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
      const { data: sessionData, error: loginError } = await supabaseAnon.auth.signInWithPassword({
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

      let emailToAuth = email;

      // If the input doesn't contain '@', treat it as a username
      if (!email.includes('@')) {
        const { data: profile, error: pError } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .ilike('username', email.trim())
          .maybeSingle();

        if (pError || !profile) {
          throw new BadRequestError('Invalid credentials');
        }

        const { data: userData, error: uError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        if (uError || !userData?.user?.email) {
          throw new BadRequestError('Invalid credentials');
        }

        emailToAuth = userData.user.email;
      }

      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email: emailToAuth, password });
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
      const result = await onboardUser(req.user.id, req.validatedBody, req.user.email);
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

  /** GET /api/v1/auth/check-username?username=xxx */
  static async checkUsername(req, res, next) {
    try {
      const { username } = req.query;
      if (!username || username.length < 3) {
        throw new BadRequestError('Username must be at least 3 characters');
      }
      if (!/^[a-zA-Z0-9._]+$/.test(username)) {
        throw new BadRequestError('Username can only contain letters, numbers, dots, and underscores');
      }
      const { data: existing, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .ilike('username', username)
        .maybeSingle();

      if (error) throw new BadRequestError('Failed to check username');

      // If checking for a logged-in user, exclude their own username
      const isTaken = existing && existing.id !== (req.user?.id || null);

      res.status(200).json({ data: { available: !isTaken, username } });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/auth/me */
  static async me(req, res, next) {
    try {
      const [profileRes, pointsRes] = await Promise.all([
        req.supabase
          .from('user_profiles')
          .select('id, username, email, first_name, last_name, is_profile_complete, tos_accepted, avatar_url, profession, user_type, country, city, bio, master_skills, departments, hobbies')
          .eq('id', req.user.id)
          .maybeSingle(),
        req.supabase
          .from('user_points')
          .select('total_points')
          .eq('user_id', req.user.id)
          .maybeSingle()
      ]);

      let profile = profileRes.data;
      const profileError = profileRes.error;
      const pointsData = pointsRes.data;

      if (profileError) {
        console.error('[Error fetching profile in me]:', profileError);
      }

      // Proactive email backfill/sync if missing from profile but present in auth
      if (profile && !profile.email && req.user.email) {
        const { data: updatedProfile, error: updateError } = await req.supabase
          .from('user_profiles')
          .update({ email: req.user.email })
          .eq('id', req.user.id)
          .select('id, username, email, first_name, last_name, is_profile_complete, tos_accepted, avatar_url, profession, user_type, country, city, bio, master_skills, departments, hobbies')
          .single();

        if (!updateError && updatedProfile) {
          profile = updatedProfile;
        } else {
          console.error('[Error backfilling email in me]:', updateError);
        }
      }

      const points = pointsData?.total_points || 0;
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
