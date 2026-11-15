/**
 * Database tests against a real PostgreSQL: constraints, Unit of Work, rollback,
 * concurrency and backup/restore (NFR-008, NFR-009, NFR-010).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { freshDatabase } = require('./pgtest');
const { boot } = require('./helpers');
const DB = require('../server/db');
const Backup = require('../server/backup');

const user = (id, email) => ({ id, email, role: 'student', status: 'active', name: id });
/** One migrated, empty database per test; dropped afterwards. */
async function withDb(fn) {
  const f = await freshDatabase();
  try { await DB.migrate(f.pool); await fn(f.pool); } finally { await f.drop(); }
}
const run = async (pool, fn) => { const ctx = {}; await DB.transact(pool, ctx, async () => fn(ctx)); return ctx; };
const n = async (pool, table) => (await pool.query('SELECT COUNT(*)::int AS n FROM ' + table)).rows[0].n;
const rejects = (p, code) => assert.rejects(p, (e) => (code ? e.code === code : true));
const U = "INSERT INTO users (id,email,role,status,data) VALUES ($1,$2,$3,$4,'{}')";
const P = "INSERT INTO projects (id,owner_id,status,visibility,data) VALUES ($1,'U',$2,$3,'{}')";

test('TC-D01 UNIQUE email, case-insensitive (F1, NFR-009)', () => withDb(async (pool) => {
  await pool.query(U, ['U1', 'a@x.org', 'student', 'active']);
  await rejects(pool.query(U, ['U2', 'A@X.ORG', 'student', 'active']), '23505');
}));
test('TC-D02 CHECK constraints reject impossible roles, statuses and visibility', () => withDb(async (pool) => {
  await rejects(pool.query(U, ['U', 'e@x', 'root', 'active']), '23514');
  await rejects(pool.query(U, ['U', 'e@x', 'student', 'weird']), '23514');
  await pool.query(U, ['U', 'e@x', 'student', 'active']);
  await rejects(pool.query(P, ['P', 'open', 'secret']), '23514');
  await pool.query(P, ['P', 'open', 'public']);
}));
test('TC-D03 file size is capped at 10 MiB by the database itself (FR-029)', () => withDb(async (pool) => {
  await pool.query(U, ['U', 'e@x', 'student', 'active']); await pool.query(P, ['P', 'open', 'public']);
  const ins = (k) => pool.query("INSERT INTO files (id,project_id,size,data) VALUES ($1,'P',$2,'{}')", ['F' + k, k]);
  await ins(10485760); await ins(1);
  await rejects(ins(10485761), '23514'); await rejects(ins(0), '23514');
}));
test('TC-D04 only one pending request per sender/project/recipient/type (F4)', () => withDb(async (pool) => {
  await pool.query(U, ['U', 'e@x', 'student', 'active']); await pool.query(P, ['P', 'open', 'public']);
  const ins = (id, st) => pool.query("INSERT INTO requests (id,project_id,from_id,to_id,type,status,data) VALUES ($1,'P','A','B','interest',$2,'{}')", [id, st]);
  await ins('R1', 'pending');
  await rejects(ins('R2', 'pending'), '23505');
  await ins('R3', 'declined'); // history rows are allowed
}));
test('TC-D05 one statement per researcher and period (FR-055)', () => withDb(async (pool) => {
  const ins = (id) => pool.query("INSERT INTO statements (id,researcher_id,period,status,data) VALUES ($1,'R','2026-10','draft','{}')", [id]);
  await ins('S1'); await rejects(ins('S2'), '23505');
}));
test('TC-D06 Unit of Work: inserts, updates, deletes and ordering are persisted in one commit', () => withDb(async (pool) => {
  await run(pool, (c) => { c.db.users.push(user('U1', 'a@x.org')); c.db.users.push(user('U2', 'b@x.org')); c.db.seq.USR = 2; });
  await run(pool, (c) => { c.db.users[0].name = 'Renamed'; c.db.users = c.db.users.filter((u) => u.id !== 'U2'); });
  await run(pool, (c) => {
    assert.deepEqual(c.db.users.map((u) => u.name), ['Renamed']);
    assert.equal(c.db.seq.USR, 2);
    c.db.notifications.unshift({ id: 'N1', userId: 'U1' }); c.db.notifications.unshift({ id: 'N2', userId: 'U1' });
  });
  await run(pool, (c) => assert.deepEqual(c.db.notifications.map((x) => x.id), ['N2', 'N1'], 'newest first is preserved'));
}));
test('TC-D07 an error rolls back EVERYTHING - no partial record (NFR-009, NFR-010)', () => withDb(async (pool) => {
  await assert.rejects(run(pool, (c) => { c.db.users.push(user('U1', 'a@x.org')); throw new Error('boom'); }), /boom/);
  assert.equal(await n(pool, 'users'), 0);
}));
test('TC-D08 a constraint failure at commit time also rolls back the whole request', () => withDb(async (pool) => {
  await run(pool, (c) => c.db.users.push(user('U1', 'a@x.org')));
  await rejects(run(pool, (c) => { c.db.users.push(user('U2', 'fresh@x.org')); c.db.users.push(user('U3', 'A@x.org')); }), '23505');
  assert.equal(await n(pool, 'users'), 1, 'U2 must not survive U3 failing');
}));
test('TC-D09 project membership table follows project.members and cascades on delete', () => withDb(async (pool) => {
  await run(pool, (c) => { c.db.users.push(user('U1', 'a@x.org'), user('U2', 'b@x.org')); c.db.projects.push({ id: 'P1', ownerId: 'U1', status: 'open', visibility: 'public', members: ['U1', 'U2'] }); });
  assert.equal(await n(pool, 'project_members'), 2);
  await run(pool, (c) => { c.db.projects[0].members = ['U1']; });
  assert.equal(await n(pool, 'project_members'), 1);
  await run(pool, (c) => { c.db.projects = []; });
  assert.equal(await n(pool, 'project_members'), 0);
}));
test('TC-D10 backup + restore: record counts and checksums match the manifest (NFR-008)', async () => {
  const th = await boot();
  if (th.db.bin) process.env.PG_BIN = th.db.bin;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcmp-bk-'));
  try {
    const m = await Backup.backup(th.db.url, dir);
    assert.ok(m.counts.users >= 16 && m.counts.projects >= 11);
    assert.match(m.sha256, /^[0-9a-f]{64}$/);
    const r = await Backup.verifyRestore(th.db.url, dir, m.file);
    assert.equal(r.ok, true);
    assert.deepEqual(r.counts, m.counts);
    assert.ok(r.elapsedMs < 4 * 3600 * 1000, 'restore within the 4 hour RTO');
    fs.appendFileSync(path.join(dir, m.file), 'tamper');
    assert.equal((await Backup.verifyRestore(th.db.url, dir, m.file)).ok, false, 'corrupted backup is detected');
  } finally { await th.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
test('TC-D11 concurrent writers are serialised: no lost updates (NFR-010)', () => withDb(async (pool) => {
  await run(pool, (c) => { c.db.users.push(user('U1', 'a@x.org')); c.db.seq.CNT = 0; });
  await Promise.all(Array.from({ length: 12 }, () => run(pool, (c) => { c.db.seq.CNT += 1; })));
  await run(pool, (c) => assert.equal(c.db.seq.CNT, 12, 'every increment survived'));
}));
test('TC-D12 a read-only transaction cannot change data', () => withDb(async (pool) => {
  const ctx = {};
  await assert.rejects(DB.transact(pool, ctx, async () => { ctx.db.users.push(user('U1', 'a@x.org')); }, { write: false }), /read-only/i);
  assert.equal(await n(pool, 'users'), 0);
}));
test('TC-D13 wipe() empties every table and restarts identity', () => withDb(async (pool) => {
  await run(pool, (c) => c.db.users.push(user('U1', 'a@x.org')));
  await DB.wipe(pool);
  assert.equal(await n(pool, 'users'), 0);
}));
