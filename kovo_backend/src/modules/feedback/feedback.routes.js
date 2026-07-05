'use strict';

const { Router } = require('express');
const FeedbackController = require('./feedback.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { submitFeedbackSchema } = require('./feedback.validator');
const { generalLimiter } = require('../../config/rateLimit');

const router = Router();

// Endpoint for submitting feedback
router.post('/', authenticate, generalLimiter, validate(submitFeedbackSchema), FeedbackController.create);

module.exports = router;
