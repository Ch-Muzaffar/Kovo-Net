'use strict';

const z = require('zod');

const awardPointsSchema = z.object({
  comment_id: z.string().uuid('Invalid comment ID'),
});

module.exports = { awardPointsSchema };
