'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

/**
 * Builds the Express application (C2 entry point).
 * Module routers (C3 account/profile, C4 project, C5 mentorship, C6 workspace,
 * C7 notification, C10 subscription) are mounted here as they are written.
 */
function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Mount module routers below, for example:
  // app.use('/api/account', require('./modules/account/routes'));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
