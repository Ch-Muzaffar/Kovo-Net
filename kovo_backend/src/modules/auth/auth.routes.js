'use strict';

const { Router } = require('express');
const AuthController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { onboardSchema, acceptTosSchema, refreshTokenSchema } = require('./auth.validator');
const { authLimiter } = require('../../config/rateLimit');

const router = Router();

// ─── Public auth endpoints (no JWT required) ───
router.post('/register',       authLimiter, AuthController.register);
router.post('/login',          authLimiter, AuthController.login);
router.get('/check-username',  authLimiter, AuthController.checkUsername);

// ─── Authenticated endpoints ───
router.post('/refresh',    authLimiter, validate(refreshTokenSchema), AuthController.refresh);
router.post('/logout',     authenticate, AuthController.logout);
router.get('/me',          authenticate, AuthController.me);
router.post('/onboard',    authenticate, authLimiter, validate(onboardSchema), AuthController.onboard);
router.post('/accept-tos', authenticate, validate(acceptTosSchema), AuthController.acceptTos);

module.exports = router;
