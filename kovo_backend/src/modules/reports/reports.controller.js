'use strict';

const { createReport } = require('./reports.service');

class ReportsController {
  static async create(req, res, next) {
    try {
      const report = await createReport(req.user.id, req.validatedBody);
      res.status(201).json({ data: report });
    } catch (error) { next(error); }
  }
}

module.exports = ReportsController;
