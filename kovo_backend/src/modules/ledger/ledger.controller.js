'use strict';

const { awardHelpfulPoints } = require('./ledger.service');

class LedgerController {
  static async award(req, res, next) {
    try {
      const transaction = await awardHelpfulPoints(req.user.id, req.validatedBody.comment_id);
      res.status(201).json({ data: transaction });
    } catch (error) { next(error); }
  }
}

module.exports = LedgerController;
