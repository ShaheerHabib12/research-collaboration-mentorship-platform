/**
 * helpers.js - boots the real API (routing, JWT, transactions, PostgreSQL, encrypted
 * storage) in-process on a random port with its own throw-away PostgreSQL database, so the API
 * tests exercise the same code path as production without any mocks.
 */
'use strict';
process.env.RCMP_BCRYPT_ROUNDS = process.env.RCMP_BCRYPT_ROUNDS || '4'; // fast hashing for tests only (production uses 12)
const http = require('node:http');
const request = require('supertest');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const DB = require('../server/db');
const { freshDatabase } = require('./pgtest');
const { createApp } = require('../server/app');
const { createStorage } = require('../server/storage');
const { seedDatabase } = require('../server/seed');

const SECRET = 'test-secret-test-secret-test-secret';
const KEY = 'ab'.repeat(32);

async function boot(opts) {
  opts = opts || {};
  const fresh = await freshDatabase(), pool = fresh.pool;
  await DB.migrate(pool);
  await seedDatabase(pool, DB);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcmp-test-'));
  const storage = createStorage(dir, KEY);
  const logs = [];
  const app = createApp({ pool, storage, secret: SECRET, allowSim: true, staticDir: path.resolve(__dirname, '..', 'client', 'dist'), log: (l) => logs.push(l), ...(opts.app || {}) });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  /** call(method, path, body, token, extraHeaders) -> {status, body, headers}; a Supertest request straight into the Express app. */
  async function call(method, p, body, token, headers) {
    let r = request(app)[method.toLowerCase()](p).buffer(true).parse((res, cb) => { const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => cb(null, Buffer.concat(ch))); });
    if (token) r = r.set('Authorization', 'Bearer ' + token);
    for (const [k, v] of Object.entries(headers || {})) r = r.set(k, v);
    if (body instanceof Uint8Array) r = r.set('Content-Type', 'application/octet-stream').send(Buffer.from(body));
    else if (body !== undefined) r = r.set('Content-Type', 'application/json').send(JSON.stringify(body));
    const res = await r, buf = res.body;
    let parsed = null;
    if ((res.headers['content-type'] || '').includes('json')) { try { parsed = JSON.parse(buf.toString()); } catch (e) { parsed = null; } }
    return { status: res.status, body: parsed, raw: buf, headers: { get: (k) => res.headers[String(k).toLowerCase()] || null } };
  }
  const tokens = {};
  async function login(email) {
    if (tokens[email]) return tokens[email];
    const r = await call('POST', '/api/auth/login', { email, password: 'Demo@1234' });
    if (r.status !== 200) throw new Error('login failed for ' + email + ': ' + r.status);
    return (tokens[email] = r.body.token);
  }
  const who = {
    aisha: 'aisha@port.ac.uk', priya: 'priya.nair@port.ac.uk', elena: 'elena.vance@port.ac.uk', marcus: 'marcus.okafor@port.ac.uk', noor: 'noor.ahmed@lums.example',
    admin: 'admin@rcmp.example', tariq: 'tariq.khan@ic.example', yuki: 'yuki.tanaka@titech.example', liam: 'liam.chen@port.ac.uk', fatima: 'fatima.zahra@lums.example'
  };
  async function as(name) { return login(who[name]); }
  /** Direct SQL against the test database, used to assert what was really persisted. */
  const rows = async (sql, ...a) => (await pool.query(sql, a)).rows;
  const count = async (sql, ...a) => Number((await rows(sql, ...a))[0].n);
  const close = async () => { await new Promise((r) => server.close(r)); await fresh.drop(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { pool, rows, count, storage, dir, logs, call, login, as, who, base, close, SECRET, db: fresh };
}
module.exports = { boot, SECRET };
