'use strict';

const { Router } = require('express');
const UsersController = require('./users.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { updateProfileSchema, updateDemographicsSchema } = require('./users.validator');
const { generalLimiter } = require('../../config/rateLimit');

const router = Router();

router.get('/me',                authenticate, generalLimiter, UsersController.getMyProfile);
router.delete('/me',             authenticate, UsersController.deactivate);
router.patch('/me/profile',      authenticate, validate(updateProfileSchema),      UsersController.updateProfile);
router.patch('/me/demographics', authenticate, validate(updateDemographicsSchema), UsersController.updateDemographics);
router.get('/me/points',         authenticate, generalLimiter, UsersController.getMyPoints);
router.get('/me/ledger',         authenticate, generalLimiter, UsersController.getMyLedger);
router.get('/:userId',           authenticate, generalLimiter, UsersController.getProfile);

module.exports = router;
