'use strict';

const { getPendingReports, resolveReport, banUser, getAllUsers } = require('./admin.service');
const { parsePageSize } = require('../../utils/pagination');
const { z } = require('zod');
const { ValidationError } = require('../../utils/errors');

const resolveReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  unhide_content: z.boolean().default(false),
});

const banUserSchema = z.object({
  banned: z.boolean(),
  reason: z.string().max(500).optional(),
});

class AdminController {
  static async getReports(req, res, next) {
    try {
      const pageSize = parsePageSize(req.query.pageSize);
      const result = await getPendingReports({ cursor: req.query.cursor || null, pageSize });
      res.status(200).json(result);
    } catch (error) { next(error); }
  }

  static async resolveReport(req, res, next) {
    try {
      const parsed = resolveReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ValidationError('Validation failed', 'VALIDATION_ERROR',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))));
      }
      const result = await resolveReport(req.params.reportId, req.user.id, {
        status: parsed.data.status,
        unhideContent: parsed.data.unhide_content,
      });
      res.status(200).json({ data: result });
    } catch (error) { next(error); }
  }

  static async banUser(req, res, next) {
    try {
      const parsed = banUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ValidationError('Validation failed', 'VALIDATION_ERROR',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))));
      }
      const result = await banUser(req.params.userId, req.user.id, parsed.data);
      res.status(200).json({ data: result });
    } catch (error) { next(error); }
  }

  static async getUsers(req, res, next) {
    try {
      const pageSize = parsePageSize(req.query.pageSize);
      const result = await getAllUsers({ cursor: req.query.cursor || null, pageSize });
      res.status(200).json(result);
    } catch (error) { next(error); }
  }
}

module.exports = AdminController;
