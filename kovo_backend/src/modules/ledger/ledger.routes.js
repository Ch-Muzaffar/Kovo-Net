'use strict';

const { Router } = require('express');
const LedgerController = require('./ledger.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { awardPointsSchema } = require('./ledger.validator');
const { postLimiter } = require('../../config/rateLimit');

const router = Router();
router.post('/award', authenticate, postLimiter, validate(awardPointsSchema), LedgerController.award);
module.exports = router;
