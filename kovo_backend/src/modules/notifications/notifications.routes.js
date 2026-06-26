'use strict';

const { Router } = require('express');
const NotificationsController = require('./notifications.controller');
const { authenticate } = require('../../middleware/auth');
const { generalLimiter } = require('../../config/rateLimit');

const router = Router();

router.get('/',                        authenticate, generalLimiter, NotificationsController.index);
router.patch('/:notificationId/read',  authenticate, generalLimiter, NotificationsController.markRead);
router.patch('/read-all',              authenticate, generalLimiter, NotificationsController.markAllRead);

module.exports = router;
