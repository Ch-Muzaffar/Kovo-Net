'use strict';

const z = require('zod');

const createPostSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(300),
  body: z.string().min(10, 'Body must be at least 10 characters').max(10000),
  attachments: z.array(z.object({
    url: z.string().url().max(500),
    name: z.string().max(200).optional().default('file'),
    // Accept both legacy `type` and new `mime_type` field names
    type: z.string().max(50).optional(),
    mime_type: z.string().max(100).optional(),
    // Accept both legacy `size` (could be string like "1.2 MB") and numeric `size_bytes`
    size: z.union([z.number(), z.string()]).optional(),
    size_bytes: z.number().int().positive().optional(),
  })).max(10).default([]),
  tags: z.array(z.object({
    type: z.enum(['department', 'profession', 'skill', 'hobby', 'user', 'topic']),
    value: z.string().min(1).max(200),
  })).max(20).default([]),
});

const updatePostSchema = z.object({
  title: z.string().min(3).max(300).optional(),
  body: z.string().min(10).max(10000).optional(),
  tags: z.array(z.object({
    type: z.enum(['department', 'profession', 'skill', 'hobby', 'user', 'topic']),
    value: z.string().min(1).max(200),
  })).max(20).optional(),
});

module.exports = { createPostSchema, updatePostSchema };
