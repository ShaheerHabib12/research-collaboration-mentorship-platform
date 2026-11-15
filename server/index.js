/**
 * index.js - process entry point. `node server/index.js` serves the API and the
 * web client on http://localhost:3000 (PORT to change). Configuration comes from
 * environment variables, never from the repository (see docs/ARCHITECTURE.md).
 *
 *   DATABASE_URL   postgres://user:password@host:5432/database  (required in production)
 *   RCMP_JWT_SECRET, RCMP_FILE_KEY   secrets (required in production)
 *   RCMP_ADMIN_EMAIL, RCMP_ADMIN_NAME, RCMP_ADMIN_PASSWORD   the real administrator created on first start
 *                  (default muhammad.habib@myport.ac.uk; a random password is printed once if none is given)
 */
'use strict';
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const DB = require('./db');
const { Pool } = require('./pool');
const { createApp } = require('./app');
const { createMailer } = require('./mailer');
const { createStorage } = require('./storage');
const { seedDatabase, adminPassword, ADMIN_EMAIL } = require('./seed');

const root = path.resolve(__dirname, '..');
const prod = process.env.NODE_ENV === 'production';
const dataDir = process.env.RCMP_DATA_DIR || path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });

/** Development secrets are generated once and kept in data/ (git-ignored). Production must set them. */
function secret(name, bytes) {
  if (process.env[name]) return process.env[name];
  if (prod) throw new Error(name + ' must be set in production.');
  const f = path.join(dataDir, '.' + name.toLowerCase());
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(bytes).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(f, 'utf8').trim();
}

/** Start-up: connect, migrate, seed if empty, then listen. */
async function main() {
  if (prod && !process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set in production.');
  const url = process.env.DATABASE_URL || 'postgres://rcmp:rcmp@localhost:5432/rcmp';
  const pool = new Pool(url, Number(process.env.RCMP_DB_POOL || 10));
  try { await DB.migrate(pool); }
  catch (e) { throw new Error('Cannot reach PostgreSQL at ' + url.replace(/:[^:@/]*@/, ':***@') + ' (' + e.message + '). Start it with "docker compose up -d db" or set DATABASE_URL.', { cause: e }); }
  if (!(await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n) { await seedDatabase(pool, DB); console.log('Seeded demo data.');
    if (!process.env.RCMP_ADMIN_PASSWORD) console.log('Administrator account created: ' + ADMIN_EMAIL + '\n  First sign-in password (shown once, change it in Profile): ' + adminPassword());
    else console.log('Administrator account created: ' + ADMIN_EMAIL + ' (password from RCMP_ADMIN_PASSWORD)'); }

  const mailer = createMailer(process.env);
  if (mailer.problems().length) throw new Error('E-mail settings: ' + mailer.problems().join('; '));
  // Verification is on whenever real e-mail is configured (or RCMP_REQUIRE_VERIFY=1 with the console provider, to try it locally).
  const verifyEmail = mailer.enabled || (process.env.RCMP_REQUIRE_VERIFY === '1' && mailer.configured);
  const publicUrl = (process.env.RCMP_PUBLIC_URL || '').replace(/\/+$/, '');
  if (mailer.enabled && !publicUrl) console.warn('RCMP_PUBLIC_URL is not set: password-reset links cannot be e-mailed.');
  console.log(verifyEmail ? 'E-mail verification: ON (' + mailer.provider + ')' : 'E-mail verification: OFF (set RCMP_MAIL_PROVIDER to turn it on)');

  const filesDir = path.join(dataDir, 'files');
  const storage = createStorage(filesDir, secret('RCMP_FILE_KEY', 32));
  const app = createApp({
    mailer, verifyEmail, publicUrl, pool, storage, secret: secret('RCMP_JWT_SECRET', 32), staticDir: path.join(root, 'client', 'dist'),
    allowSim: !prod && process.env.RCMP_ALLOW_SIM !== '0', forceHttps: process.env.RCMP_FORCE_HTTPS === '1', trustProxy: process.env.RCMP_TRUST_PROXY === '1',
    log: (l) => { if (process.env.RCMP_QUIET !== '1') console.log(JSON.stringify(Object.assign({ t: new Date().toISOString() }, l))); }
  });
  const port = Number(process.env.PORT || 3000);
  const server = http.createServer(app).listen(port, () => console.log('RCMP running on http://localhost:' + port + (prod ? '' : '  (demo tools enabled)')));
  const stop = () => { server.close(() => pool.end().then(() => process.exit(0))); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
