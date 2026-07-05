'use strict';

const { Router } = require('express');
const UploadsController = require('./uploads.controller');
const { authenticate } = require('../../middleware/auth');
const { uploadLimiter } = require('../../config/rateLimit');

const router = Router();
router.get('/presign', authenticate, uploadLimiter, UploadsController.presign);
module.exports = router;
