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

const sendMessageSchema = z.object({
  receiver_id: flexibleId('Invalid receiver ID'),
  post_id: flexibleId('Invalid post ID').optional(),
  body: z.string().min(1, 'Message cannot be empty').max(5000),
});

module.exports = { sendMessageSchema };
