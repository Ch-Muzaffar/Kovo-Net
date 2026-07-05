'use strict';

const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/** Global error handler — never leaks stack traces in production. */
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const isOperational = err.isOperational || false;

  if (isOperational) {
    logger.warn(err.message, { code, statusCode, path: req.path, details: err.details });
  } else {
    logger.error('Unhandled error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  const response = { error: err.message || 'An unexpected error occurred', code };
  if (err.details) response.details = err.details;
  if (process.env.NODE_ENV === 'development' && !isOperational) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/** 404 handler for unmatched routes. */
function notFoundHandler(req, _res, next) {
  const err = new AppError(`Cannot ${req.method} ${req.path}`, 404, 'NOT_FOUND');
  next(err);
}

module.exports = { errorHandler, notFoundHandler };
