'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const morgan = require('morgan');
const env = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { sanitizeInput } = require('./middleware/sanitize');
const logger = require('./utils/logger');

// Route modules (lazy imports prevent circular dependencies)
const authRoutes         = require('./modules/auth/auth.routes');
const userRoutes         = require('./modules/users/users.routes');
const postRoutes         = require('./modules/posts/posts.routes');
const feedRoutes         = require('./modules/feed/feed.routes');
const commentRoutes      = require('./modules/comments/comments.routes');
const ledgerRoutes       = require('./modules/ledger/ledger.routes');
const messageRoutes      = require('./modules/messages/messages.routes');
const reportRoutes       = require('./modules/reports/reports.routes');
const notificationRoutes = require('./modules/notifications/notifications.routes');
const uploadRoutes       = require('./modules/uploads/uploads.routes');
const adminRoutes        = require('./modules/admin/admin.routes');
const connectionRoutes   = require('./modules/connections/connections.routes');

const app = express();

// ─── Security Middleware ───
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(hpp());
app.use(express.json({ limit: '1mb' }));

// ─── Request Logging ───
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ─── Input Sanitization ───
app.use(sanitizeInput);

// ─── Health Check (before auth) ───
app.get(`${env.API_PREFIX}/health`, (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

// ─── API Routes ───
const apiRouter = express.Router();
apiRouter.use('/auth',          authRoutes);
apiRouter.use('/users',         userRoutes);
apiRouter.use('/posts',         postRoutes);
apiRouter.use('/feed',          feedRoutes);
apiRouter.use('/posts/:postId/comments', commentRoutes);
apiRouter.use('/ledger',        ledgerRoutes);
apiRouter.use('/messages',      messageRoutes);
apiRouter.use('/reports',       reportRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/uploads',       uploadRoutes);
apiRouter.use('/admin',         adminRoutes);
apiRouter.use('/connections',   connectionRoutes);

app.use(env.API_PREFIX, apiRouter);

// ─── Error Handling ───
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
