'use strict';

const { Router } = require('express');
const CommentsController = require('./comments.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { createCommentSchema } = require('./comments.validator');
const { postLimiter, generalLimiter } = require('../../config/rateLimit');

const router = Router({ mergeParams: true });

router.post('/',              authenticate, postLimiter, validate(createCommentSchema), CommentsController.create);
router.get('/',               authenticate, generalLimiter, CommentsController.index);
router.delete('/:commentId',  authenticate, postLimiter, CommentsController.delete);

module.exports = router;
