'use strict';

const z = require('zod');

const createReportSchema = z.object({
  target_type: z.enum(['post', 'comment', 'dm']),
  target_id: z.string().uuid('Invalid target ID'),
  reason: z.enum(['spam', 'inappropriate', 'disturbing']),
});

module.exports = { createReportSchema };
