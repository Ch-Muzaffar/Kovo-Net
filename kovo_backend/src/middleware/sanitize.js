'use strict';

/**
 * Strips HTML tags from text fields to prevent stored XSS.
 * Preserves plain-text content (markdown-safe).
 */
function sanitizeInput(req, res, next) {
  if (!req.body || typeof req.body !== 'object') return next();

  const strip = (value) => {
    if (typeof value !== 'string') return value;
    return value
      .replace(/<[^>]*>/g, '')
      .replace(/&[^;\s]+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const textFields = ['title', 'body', 'bio', 'first_name', 'last_name', 'city', 'country', 'profession'];
  for (const field of textFields) {
    if (req.body[field] !== undefined) {
      req.body[field] = strip(req.body[field]);
    }
  }

  if (Array.isArray(req.body.departments)) {
    req.body.departments = req.body.departments.map(strip).filter(Boolean);
  }
  if (Array.isArray(req.body.hobbies)) {
    req.body.hobbies = req.body.hobbies.map(strip).filter(Boolean);
  }
  if (Array.isArray(req.body.master_skills)) {
    req.body.master_skills = req.body.master_skills.map(strip).filter(Boolean);
  }

  next();
}

module.exports = { sanitizeInput };
