'use strict';

const { Router } = require('express');
const MessagesController = require('./messages.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { sendMessageSchema } = require('./messages.validator');
const { messageLimiter, generalLimiter } = require('../../config/rateLimit');

const router = Router();

router.post('/',                      authenticate, messageLimiter, validate(sendMessageSchema), MessagesController.send);
router.get('/conversations',          authenticate, generalLimiter, MessagesController.getConversations);
router.get('/conversation/:otherUserId', authenticate, generalLimiter, MessagesController.getConversation);

module.exports = router;
