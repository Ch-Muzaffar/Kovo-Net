'use strict';

const { ValidationError } = require('../utils/errors');

/** Validates req.body against a Zod schema. Rejects with 422 on failure. */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return next(new ValidationError('Validation failed', 'VALIDATION_ERROR', details));
    }
    req.validatedBody = result.data;
    next();
  };
}

/** Validates query parameters against a Zod schema. */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return next(new ValidationError('Invalid query parameters', 'INVALID_QUERY', details));
    }
    req.validatedQuery = result.data;
    next();
  };
}

module.exports = { validate, validateQuery };
