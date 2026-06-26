'use strict';

const { Router } = require('express');
const ReportsController = require('./reports.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { createReportSchema } = require('./reports.validator');
const { generalLimiter } = require('../../config/rateLimit');

const router = Router();
router.post('/', authenticate, generalLimiter, validate(createReportSchema), ReportsController.create);
module.exports = router;
