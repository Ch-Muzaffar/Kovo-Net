'use strict';

const z = require('zod');

const sendMessageSchema = z.object({
  receiver_id: z.string().uuid('Invalid receiver ID'),
  post_id: z.string().uuid().optional(),
  body: z.string().min(1, 'Message cannot be empty').max(5000),
});

module.exports = { sendMessageSchema };
