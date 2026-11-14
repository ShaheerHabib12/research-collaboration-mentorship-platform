/**
 * stack.js - starts the whole system for end-to-end tests: a real PostgreSQL database, the Express API
 * and the built React client (client/dist) on one port. Used by the Playwright runner (tests/e2e/run.js);
 * the Cypress specs (cypress/e2e) talk to an already running server instead (npm start).
 */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const { freshDatabase } = require('../pgtest');
const DB = require('../../server/db');
const { createApp } = require('../../server/app');
const { createStorage } = require('../../server/storage');
const { seedDatabase } = require('../../server/seed');
const { createMailer } = require('../../server/mailer');

async function startStack(opts = {}) {
  const db = await freshDatabase();
  await DB.migrate(db.pool); await seedDatabase(db.pool, DB);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcmp-e2e-'));
  const app = createApp({
    pool: db.pool, storage: createStorage(path.join(dir, 'files'), Buffer.alloc(32, 7).toString('hex')), secret: 'e2e-secret-e2e-secret-e2e-secret-00',
    mailer: createMailer({}), verifyEmail: false, publicUrl: '', allowSim: true, staticDir: path.resolve(__dirname, '../../client/dist'), loginLimit: 1000, authLimit: 1000, contactLimit: 1000
  });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(opts.port || 0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  return { url, db, async stop() { await new Promise((r) => server.close(r)); await db.drop(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
module.exports = { startStack };
