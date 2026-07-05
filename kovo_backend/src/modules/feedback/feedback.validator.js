'use strict';

const { z } = require('zod');

const submitFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  category: z.enum(['bug_report', 'feature_request', 'general_review', 'academic_issue']),
  message: z.string().trim().min(3).max(2000),
  is_anonymous: z.boolean().default(false),
});

module.exports = { submitFeedbackSchema };
