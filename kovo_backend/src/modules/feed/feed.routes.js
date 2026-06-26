'use strict';

const { Router } = require('express');
const FeedController = require('./feed.controller');
const { authenticate } = require('../../middleware/auth');
const { feedLimiter } = require('../../config/rateLimit');

const router = Router();
router.get('/', authenticate, feedLimiter, FeedController.index);
module.exports = router;
