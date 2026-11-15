/** Database pool tests (server/pool.js on the official pg package): auth, parameters, types, errors, pool (NFR-009). */

const assert = require('node:assert/strict');
const { freshDatabase } = require('./pgtest');
const { Pool, parseUrl } = require('../server/pool');

let f;
beforeAll(async () => { f = await freshDatabase(); });
afterAll(async () => { await f.drop(); });

test('TC-PG01 parseUrl reads host, port, credentials (incl. encoded) and sslmode', () => {
  const c = parseUrl('postgres://us%40er:p%3Aw@db.example:6543/mydb?sslmode=require');
  assert.deepEqual([c.host, c.port, c.user, c.password, c.database, c.ssl], ['db.example', 6543, 'us@er', 'p:w', 'mydb', { rejectUnauthorized: false }]);
  assert.equal(parseUrl('postgres://a:b@h/d').ssl, false);
  assert.equal(parseUrl('postgres://a:b@h/d').port, 5432);
});
test('TC-PG02 parameterised query returns typed rows (int, bool, text, json, null)', async () => {
  const r = await f.pool.query('SELECT $1::int AS i, $2::bool AS b, $3::text AS s, $4::jsonb AS j, $5::text AS n', [42, true, "O'Reilly; DROP TABLE x", { a: [1, 2] }, null]);
  assert.deepEqual(r.rows[0], { i: 42, b: true, s: "O'Reilly; DROP TABLE x", j: { a: [1, 2] }, n: null });
});
test('TC-PG03 SQL injection text is treated as data, never executed (NFR-004)', async () => {
  await f.pool.query('CREATE TABLE inj (v text)');
  await f.pool.query('INSERT INTO inj VALUES ($1)', ["x'); DROP TABLE inj; --"]);
  assert.equal((await f.pool.query('SELECT COUNT(*)::int AS n FROM inj')).rows[0].n, 1);
});
test('TC-PG04 server errors surface as PgError with SQLSTATE and constraint name', async () => {
  await f.pool.query('CREATE TABLE u (id int PRIMARY KEY)'); await f.pool.query('INSERT INTO u VALUES (1)');
  await assert.rejects(f.pool.query('INSERT INTO u VALUES (1)'), (e) => e.code === '23505' && e.constraint === 'u_pkey');
  await assert.rejects(f.pool.query('SELEC 1'), (e) => e.code === '42601');
});
test('TC-PG05 a failed statement does not poison the pooled connection', async () => {
  const p = new Pool(f.url, 1);
  await assert.rejects(p.query('SELECT 1/0'), (e) => e.code === '22012');
  assert.equal((await p.query('SELECT 7 AS n')).rows[0].n, 7);
  await p.end();
});
test('TC-PG06 wrong password is rejected (SCRAM) and unreachable host fails fast', async () => {
  const bad = f.url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:wrong@');
  await assert.rejects(new Pool(bad, 1).query('SELECT 1'));
  await assert.rejects(new Pool('postgres://x:y@127.0.0.1:1/z', 1).query('SELECT 1'));
});
test('TC-PG07 pool queues work beyond its size and returns every result', async () => {
  const p = new Pool(f.url, 2);
  const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => p.query('SELECT pg_sleep(0.02), $1::int AS i', [i])));
  assert.deepEqual(rs.map((r) => r.rows[0].i), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await p.end(); await assert.rejects(p.query('SELECT 1'), /end/i);
});
test('TC-PG08 withClient gives one connection: session state persists inside, multi-statement exec works', async () => {
  await f.pool.withClient(async (c) => { await c.query("SET application_name = 'rcmp-test'"); assert.equal((await c.query('SHOW application_name')).rows[0].application_name, 'rcmp-test'); await c.exec('CREATE TEMP TABLE tt (a int); INSERT INTO tt VALUES (1),(2);'); assert.equal((await c.query('SELECT COUNT(*)::int AS n FROM tt')).rows[0].n, 2); });
});
