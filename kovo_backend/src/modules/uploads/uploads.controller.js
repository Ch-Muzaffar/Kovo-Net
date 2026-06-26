'use strict';

const { getPresignedUpload } = require('./uploads.service');
const { z } = require('zod');
const { ValidationError } = require('../../utils/errors');

const presignQuerySchema = z.object({
  mime_type: z.string().min(1),
  file_size: z.coerce.number().int().positive(),
});

class UploadsController {
  static async presign(req, res, next) {
    try {
      const parsed = presignQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return next(new ValidationError(
          'Invalid query parameters', 'INVALID_QUERY',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        ));
      }
      const result = getPresignedUpload(parsed.data.mime_type, parsed.data.file_size);
      res.status(200).json({ data: result });
    } catch (error) { next(error); }
  }
}

module.exports = UploadsController;
