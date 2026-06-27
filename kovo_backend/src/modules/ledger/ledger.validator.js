'use strict';

const z = require('zod');

const flexibleId = (msg) => z.string().refine(
  val => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) ||
         /^user[\s-]?\d+$/i.test(val) ||
         /^\d+$/.test(val) ||
         /^[a-zA-Z0-9_-]+\d+$/i.test(val) ||
         /^[a-zA-Z]+-\d+$/i.test(val),
  { message: msg || 'Invalid ID' }
);

const awardPointsSchema = z.object({
  comment_id: flexibleId('Invalid comment ID'),
});

module.exports = { awardPointsSchema };
