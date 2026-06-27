'use strict';

const { Router } = require('express');
const ConnectionsController = require('./connections.controller');
const { authenticate } = require('../../middleware/auth');
const { generalLimiter } = require('../../config/rateLimit');

const router = Router();

router.post('/request',         authenticate, generalLimiter, ConnectionsController.request);
router.post('/respond',         authenticate, generalLimiter, ConnectionsController.respond);
router.post('/withdraw',        authenticate, generalLimiter, ConnectionsController.withdraw);
router.get('/pending',          authenticate, generalLimiter, ConnectionsController.getPending);
router.get('/list',             authenticate, generalLimiter, ConnectionsController.list);
router.get('/status/:userId',   authenticate, generalLimiter, ConnectionsController.status);
router.get('/count/:userId',    authenticate, generalLimiter, ConnectionsController.count);

module.exports = router;
