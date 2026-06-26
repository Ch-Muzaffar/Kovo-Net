'use strict';

const rateLimit = require('express-rate-limit');

const createLimiter = (opts) =>
  rateLimit({
    windowMs: opts.windowMs,
    max: process.env.NODE_ENV === 'development' ? 1000 : opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests',
      code: 'RATE_LIMITED',
      retryAfter: Math.ceil(opts.windowMs / 1000),
    },
    ...opts,
  });

module.exports = {
  authLimiter:    createLimiter({ windowMs: 60_000, max: 5 }),
  generalLimiter: createLimiter({ windowMs: 60_000, max: 60 }),
  feedLimiter:    createLimiter({ windowMs: 60_000, max: 120 }),
  postLimiter:    createLimiter({ windowMs: 60_000, max: 20 }),
  messageLimiter: createLimiter({ windowMs: 60_000, max: 30 }),
  uploadLimiter:  createLimiter({ windowMs: 60_000, max: 10 }),
  adminLimiter:   createLimiter({ windowMs: 60_000, max: 30 }),
};
