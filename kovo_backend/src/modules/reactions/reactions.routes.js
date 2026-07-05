'use strict';

const { Router } = require('express');
const ReactionsController = require('./reactions.controller');
const { authenticate } = require('../../middleware/auth');
const { generalLimiter } = require('../../config/rateLimit');

const router = Router();

router.post('/', authenticate, generalLimiter, ReactionsController.toggle);

module.exports = router;
