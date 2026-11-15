/** Jest global setup: one real PostgreSQL 16 server for the whole run (each test file gets its own database in it). */
'use strict';
module.exports = async () => {
  if (process.env.TEST_DATABASE_URL) return;
  const { ensureServer } = require('./pgtest');
  const srv = await ensureServer();
  process.env.TEST_DATABASE_URL = srv.url;
  globalThis.__RCMP_PG__ = srv;
};
