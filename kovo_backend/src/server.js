'use strict';

const env = require('./config/env');
const app = require('./app');
const logger = require('./utils/logger');
const cache = require('./utils/cache');

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info('Kovo-Net API running', { port: PORT, env: env.NODE_ENV, prefix: env.API_PREFIX });
});

// ─── Graceful Shutdown ───
const shutdown = (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
    cache.destroy();
    logger.info('Cache destroyed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  shutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
  shutdown('UNHANDLED_REJECTION');
});

module.exports = server;
