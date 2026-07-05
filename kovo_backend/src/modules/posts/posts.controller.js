'use strict';

const { createPost, getPost, updatePost, deletePost, getUserPosts } = require('./posts.service');
const { parsePageSize } = require('../../utils/pagination');

class PostsController {
  static async create(req, res, next) {
    try {
      const post = await createPost(req.user.id, req.validatedBody);
      res.status(201).json({ data: post });
    } catch (error) { next(error); }
  }
  static async getOne(req, res, next) {
    try {
      const post = await getPost(req.params.postId, req.user.id);
      res.status(200).json({ data: post });
    } catch (error) { next(error); }
  }
  static async update(req, res, next) {
    try {
      const post = await updatePost(req.params.postId, req.user.id, req.validatedBody);
      res.status(200).json({ data: post });
    } catch (error) { next(error); }
  }
  static async delete(req, res, next) {
    try {
      const result = await deletePost(req.params.postId, req.user.id);
      res.status(200).json({ data: result });
    } catch (error) { next(error); }
  }
  static async getByUser(req, res, next) {
    try {
      const pageSize = parsePageSize(req.query.pageSize);
      const result = await getUserPosts(req.params.userId, req.user.id, { cursor: req.query.cursor || null, pageSize });
      res.status(200).json(result);
    } catch (error) { next(error); }
  }
}

module.exports = PostsController;
