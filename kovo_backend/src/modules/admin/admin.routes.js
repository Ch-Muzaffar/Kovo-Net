'use strict';

const { Router } = require('express');
const AdminController = require('./admin.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { adminLimiter } = require('../../config/rateLimit');

const router = Router();

router.get('/reports',                  authenticate, requireAdmin, adminLimiter, AdminController.getReports);
router.patch('/reports/:reportId',      authenticate, requireAdmin, adminLimiter, AdminController.resolveReport);
router.patch('/users/:userId/ban',      authenticate, requireAdmin, adminLimiter, AdminController.banUser);
router.get('/users',                    authenticate, requireAdmin, adminLimiter, AdminController.getUsers);

module.exports = router;
