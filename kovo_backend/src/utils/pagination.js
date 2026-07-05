'use strict';

const env = require('../config/env');

/**
 * Cursor-based pagination helpers.
 * Cursor = base64({ created_at, id }) for deterministic ordering.
 */
function parseCursor(cursor) {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    if (decoded.created_at && decoded.id) return decoded;
    return null;
  } catch {
    return null;
  }
}

function encodeCursor(createdAt, id) {
  return Buffer.from(JSON.stringify({ created_at: createdAt, id })).toString('base64');
}

function parsePageSize(raw) {
  const size = parseInt(raw, 10);
  if (isNaN(size) || size < 1) return env.DEFAULT_PAGE_SIZE;
  return Math.min(size, env.MAX_PAGE_SIZE);
}

module.exports = { parseCursor, encodeCursor, parsePageSize };
