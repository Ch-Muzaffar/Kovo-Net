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
  authLimiter:    createLimiter({ windowMs: 60_000, max: process.env.NODE_ENV === 'development' ? 2000 : 60 }),
  generalLimiter: createLimiter({ windowMs: 60_000, max: process.env.NODE_ENV === 'development' ? 2000 : 240 }),
  feedLimiter:    createLimiter({ windowMs: 60_000, max: process.env.NODE_ENV === 'development' ? 3000 : 360 }),
  postLimiter:    createLimiter({ windowMs: 60_000, max: process.env.NODE_ENV === 'development' ? 1000 : 60 }),
  messageLimiter: createLimiter({ windowMs: 60_000, max: process.env.NODE_ENV === 'development' ? 1000 : 120 }),
  uploadLimiter:  createLimiter({ windowMs: 60_000, max: process.env.NODE_ENV === 'development' ? 500  : 30 }),
  adminLimiter:   createLimiter({ windowMs: 60_000, max: process.env.NODE_ENV === 'development' ? 1000 : 120 }),
};
