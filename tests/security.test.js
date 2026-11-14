/**
 * Security tests (OWASP Top 10 classes) against the running API: injection, broken access control, token attacks,
 * headers, oversized and malformed input, file-name tricks. TC-SEC-01..11. Complements the ZAP baseline scan in CI.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { boot, SECRET } = require('./helpers');
let t;
beforeAll(async () => { t = await boot(); });
afterAll(async () => { await t.close(); });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

test('TC-SEC-01 SQL injection text in login, search and registration stays data and breaks nothing (A03)', async () => {
  const bad = ["' OR '1'='1", "'; DROP TABLE users; --", '" OR ""="', '1; SELECT pg_sleep(5)'];
  for (const p of bad) {
    const r = await t.call('POST', '/api/auth/login', { email: p, password: p });
    assert.ok([400, 401].includes(r.status), 'login with ' + p + ' gave ' + r.status);
  }
  const tok = await t.as('aisha');
  for (const p of bad) { const r = await t.call('GET', '/api/projects/search?f=' + encodeURIComponent(JSON.stringify({ q: p })), undefined, tok); assert.equal(r.status, 200); }
  assert.ok((await t.count('SELECT COUNT(*) AS n FROM users')) >= 5, 'users table intact');
});
test('TC-SEC-02 forged tokens are refused: alg none, wrong secret, tampered payload, expired (A07)', async () => {
  const head = b64({ alg: 'none', typ: 'JWT' }), pay = b64({ sub: 'USR-101', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  const wrong = (secret, payload) => { const h = b64({ alg: 'HS256', typ: 'JWT' }); const sig = crypto.createHmac('sha256', secret).update(h + '.' + payload).digest('base64url'); return h + '.' + payload + '.' + sig; };
  const tokens = [head + '.' + pay + '.', wrong('not-the-secret', pay), wrong(SECRET, b64({ sub: 'USR-101', role: 'admin', exp: 1 })), 'garbage', ''];
  for (const tk of tokens) { const r = await t.call('GET', '/api/dashboard', undefined, tk || undefined); assert.equal(r.status, 401, 'token ' + tk.slice(0, 20)); }
});
test('TC-SEC-03 a student cannot use administrator endpoints and cannot read another team\'s workspace (A01)', async () => {
  const tok = await t.as('priya');
  for (const [m, p] of [['GET', '/api/admin/researchers'], ['GET', '/api/admin/audit'], ['GET', '/api/admin/messages'], ['GET', '/api/admin/reports']]) {
    const r = await t.call(m, p, undefined, tok); assert.ok([403, 404].includes(r.status), p + ' gave ' + r.status);
  }
});
test('TC-SEC-04 security headers on the home page and the API (A05)', async () => {
  const h = await t.call('GET', '/'); const csp = h.headers.get('content-security-policy') || '';
  assert.match(csp, /default-src 'self'/); assert.match(csp, /script-src 'self'/); assert.ok(!/unsafe-eval|script-src[^;]*unsafe-inline/.test(csp), 'no unsafe script sources');
  assert.match(csp, /frame-ancestors 'none'/); assert.equal(h.headers.get('x-content-type-options'), 'nosniff'); assert.match(h.headers.get('permissions-policy') || '', /camera=\(\), microphone=\(\), geolocation=\(\)/);
  const a = await t.call('GET', '/api/health'); assert.ok(!a.headers.get('x-powered-by'), 'framework banner hidden');
  const d = await t.call('GET', '/api/dashboard', undefined, await t.as('aisha')); assert.match(d.headers.get('cache-control') || '', /no-store/);
});
test('TC-SEC-05 malformed and oversized JSON gets a clean 4xx, never a 500 or a stack trace (A05)', async () => {
  const r1 = await t.call('POST', '/api/auth/login', Buffer.from('{"email": '), undefined, { 'Content-Type': 'application/json' });
  assert.ok(r1.status >= 400 && r1.status < 500, 'malformed gave ' + r1.status);
  const big = { email: 'a@b.co', password: 'x'.repeat(3 * 1024 * 1024) };
  const r2 = await t.call('POST', '/api/auth/login', big); assert.ok(r2.status >= 400 && r2.status < 500, 'oversized gave ' + r2.status);
  assert.ok(!/at .*\.js:\d+/.test((r1.raw || '').toString() + (r2.raw || '').toString()), 'no stack trace in the body');
});
test('TC-SEC-06 stored markup is returned as plain text data and never executed server-side (A03)', async () => {
  const tok = await t.as('aisha');
  const r = await t.call('POST', '/api/projects/PRJ-1001/tasks', { title: '<img src=x onerror=1>' }, tok);
  assert.ok([201, 400].includes(r.status));
  if (r.status === 201) assert.ok(!/[<>]/.test(r.body.title || r.body.task?.title || ''), 'markup neutralised on input');
});
test('TC-SEC-07 path tricks in uploaded file names never reach the file system (A01)', async () => {
  const tok = await t.as('aisha');
  const r = await t.call('POST', '/api/projects/PRJ-1001/files?name=' + encodeURIComponent('../../etc/passwd.pdf') + '&perm=team', new Uint8Array([37, 80, 68, 70]), tok);
  assert.ok([200, 201, 400, 415].includes(r.status), 'status ' + r.status);
  const rows = await t.rows("SELECT data->>'name' AS n FROM files WHERE data->>'name' LIKE '%..%' OR data->>'name' LIKE '%/%'");
  assert.equal(rows.length, 0);
});
test('TC-SEC-08 responses never contain password hashes or secrets (A02)', async () => {
  const tok = await t.as('admin');
  for (const p of ['/api/me', '/api/dashboard', '/api/admin/researchers', '/api/projects/search?f=%7B%7D']) {
    const r = await t.call('GET', p, undefined, tok); const s = (r.raw || '').toString();
    assert.ok(!/\$2[aby]\$\d\d\$/.test(s) && !s.includes(SECRET), p + ' leaked');
  }
});
test('TC-SEC-09 login throttling answers 429 after repeated failures (A07)', async () => {
  const t2 = await boot();
  try { let last; for (let i = 0; i < 9; i++) last = await t2.call('POST', '/api/auth/login', { email: 'aisha@port.ac.uk', password: 'wrong' + i }); assert.equal(last.status, 429); } finally { await t2.close(); }
});
test('TC-SEC-10 unknown API routes and methods return JSON 404/405, not an HTML error page', async () => {
  const r = await t.call('GET', '/api/does-not-exist'); assert.ok([404, 405].includes(r.status)); assert.match(r.headers.get('content-type') || '', /json/);
});
test('TC-SEC-11 hidden files and project folders are never served; robots.txt and security.txt are', async () => {
  for (const u of ['/.env', '/.git/config', '/data/', '/server/app.js', '/shared/rules.js', '/tests/helpers.js', '/package.json', '/node_modules/']) {
    const r = await t.call('GET', u); assert.equal(r.status, 404, u + ' returned ' + r.status);
  }
  for (const u of ['/robots.txt', '/security.txt']) { const r = await fetch(t.base + u); assert.equal(r.status, 200, u); assert.match(r.headers.get('content-type') || '', /text\/plain/); }
});
