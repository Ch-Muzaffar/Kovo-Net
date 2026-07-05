'use strict';

// Load backend deps from the correct subdirectory path
// This is the Vercel serverless entry point — do NOT import server.js (has setInterval, WS)
const app = require('../kovo_backend/src/app');

module.exports = app;
