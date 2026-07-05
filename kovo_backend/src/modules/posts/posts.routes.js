'use strict';

const { Router } = require('express');
const PostsController = require('./posts.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { createPostSchema, updatePostSchema } = require('./posts.validator');
const { postLimiter, generalLimiter } = require('../../config/rateLimit');

const router = Router();

router.post('/',          authenticate, postLimiter, validate(createPostSchema), PostsController.create);
router.get('/user/:userId', authenticate, generalLimiter, PostsController.getByUser);
router.get('/:postId',    authenticate, generalLimiter, PostsController.getOne);
router.patch('/:postId',  authenticate, postLimiter, validate(updatePostSchema), PostsController.update);
router.delete('/:postId', authenticate, postLimiter, PostsController.delete);

module.exports = router;
