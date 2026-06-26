'use strict';

const { createComment, getComments, deleteComment } = require('./comments.service');
const { parsePageSize } = require('../../utils/pagination');

class CommentsController {
  static async create(req, res, next) {
    try {
      const comment = await createComment(req.user.id, req.params.postId, req.validatedBody.body);
      res.status(201).json({ data: comment });
    } catch (error) { next(error); }
  }
  static async index(req, res, next) {
    try {
      const pageSize = parsePageSize(req.query.pageSize);
      const result = await getComments(req.params.postId, req.user.id, { cursor: req.query.cursor || null, pageSize });
      res.status(200).json(result);
    } catch (error) { next(error); }
  }
  static async delete(req, res, next) {
    try {
      const result = await deleteComment(req.params.commentId, req.user.id);
      res.status(200).json({ data: result });
    } catch (error) { next(error); }
  }
}

module.exports = CommentsController;
