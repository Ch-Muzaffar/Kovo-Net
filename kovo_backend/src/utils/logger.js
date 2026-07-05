'use strict';

/**
 * Simple structured logger.
 * In production, pipe stdout to your log aggregator.
 */
const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({ level: 'info', ts: new Date().toISOString(), message, ...meta }));
  },
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({ level: 'warn', ts: new Date().toISOString(), message, ...meta }));
  },
  error: (message, meta = {}) => {
    console.error(JSON.stringify({ level: 'error', ts: new Date().toISOString(), message, ...meta }));
  },
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(JSON.stringify({ level: 'debug', ts: new Date().toISOString(), message, ...meta }));
    }
  },
};

module.exports = logger;
