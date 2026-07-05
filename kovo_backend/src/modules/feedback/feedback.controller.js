'use strict';

const { createFeedback } = require('./feedback.service');

class FeedbackController {
  static async create(req, res, next) {
    try {
      const feedback = await createFeedback(req.user.id, req.validatedBody);
      res.status(201).json({ status: 'success', data: feedback });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = FeedbackController;
