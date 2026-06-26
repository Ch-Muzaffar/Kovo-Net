'use strict';

const { getFeed } = require('./feed.service');
const { parsePageSize } = require('../../utils/pagination');

class FeedController {
  static async index(req, res, next) {
    try {
      const pageSize = parsePageSize(req.query.pageSize);
      const result = await getFeed(req.user.id, { cursor: req.query.cursor || null, pageSize });
      res.status(200).json(result);
    } catch (error) { next(error); }
  }
}

module.exports = FeedController;
