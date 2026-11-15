/**
 * db.js - Layer 3 (data) access: PostgreSQL schema, constraints and Unit of Work.
 *
 * Design (see docs/ARCHITECTURE.md):
 *  - Every aggregate has its own table with real PRIMARY/FOREIGN keys, UNIQUE
 *    indexes and CHECK constraints on the columns that protect integrity
 *    (email, roles, request status, one pending request per user/project,
 *    one statement per researcher/period, file size <= 10 MiB ...).
 *  - The full entity is also stored as JSONB in `data`, which keeps the domain
 *    code simple while the columns above stay queryable and constrained.
 *  - A Unit of Work loads the collections at the start of the request (one
 *    round trip), the domain code works on plain objects, and the changes are
 *    detected by comparing snapshots and written in ONE transaction. If
 *    anything throws, the transaction rolls back and nothing is stored
 *    (NFR-009, NFR-010).
 *  - Writers are serialised with a transaction-scoped advisory lock so that two
 *    requests can never both read the old state and overwrite each other
 *    (the "lost update" problem). Reads run concurrently in a REPEATABLE READ
 *    snapshot. Row-level locking / optimistic versions are the next step if
 *    the write rate ever outgrows this (documented limitation).
 */
'use strict';

const WRITE_LOCK_ID = 727001;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','researcher','mentor','admin')),
  status TEXT NOT NULL CHECK (status IN ('active','suspended')),
  data JSONB NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users (lower(email));
CREATE TABLE IF NOT EXISTS projects (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','open','paused','closed')),
  visibility TEXT NOT NULL CHECK (visibility IN ('public','summary','private')),
  data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_projects_owner ON projects(owner_id);
CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_members_user ON project_members(user_id);
CREATE TABLE IF NOT EXISTS requests (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('interest','invitation')),
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','declined','withdrawn')),
  data JSONB NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_request_one_pending ON requests(project_id, from_id, to_id, type) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ix_requests_to ON requests(to_id, status);
CREATE TABLE IF NOT EXISTS agreements (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  version INTEGER NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  status TEXT NOT NULL CHECK (status IN ('todo','progress','review','done')),
  data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tasks_project ON tasks(project_id);
CREATE TABLE IF NOT EXISTS files (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  size BIGINT NOT NULL CHECK (size > 0 AND size <= 10485760),
  data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_files_project ON files(project_id);
CREATE TABLE IF NOT EXISTS activity (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS mentor_requests (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  mentor_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','declined','clarify','withdrawn','completed')),
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS support_requests (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  researcher_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','assigned','in_progress','completed','reopened','rejected')),
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_events (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded','failed','pending')),
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS statements (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  researcher_id TEXT NOT NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','awaiting_approval','approved','paid','payout_failed')),
  data JSONB NOT NULL,
  UNIQUE (researcher_id, period)
);
CREATE TABLE IF NOT EXISTS reports (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('open','dismissed','actioned')),
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS contact_messages (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('new','read','answered')),
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(user_id);
CREATE TABLE IF NOT EXISTS notification_prefs (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
`;
const TABLES = ['users', 'projects', 'project_members', 'requests', 'agreements', 'tasks', 'files', 'activity', 'mentor_requests', 'support_requests', 'subscriptions', 'billing_events', 'statements', 'reports', 'contact_messages', 'audit_log', 'notifications', 'notification_prefs', 'meta'];

/**
 * Collection catalogue: JS collection name -> table, indexed columns and
 * ordering. `newestFirst` collections are unshifted by the domain code, so
 * they are read back newest first (highest rowid first).
 */
const COLLECTIONS = {
  users: { table: 'users', cols: (u) => ({ email: String(u.email).toLowerCase(), role: u.role, status: u.status }) },
  projects: { table: 'projects', cols: (p) => ({ owner_id: p.ownerId, status: p.status, visibility: p.visibility }) },
  requests: { table: 'requests', newestFirst: true, cols: (r) => ({ project_id: r.projectId, from_id: r.from, to_id: r.to, type: r.type, status: r.status }) },
  agreements: { table: 'agreements', idOf: (a) => a.projectId, cols: (a) => ({ version: a.version, status: a.status }) },
  tasks: { table: 'tasks', cols: (t) => ({ project_id: t.projectId, status: t.status }) },
  files: { table: 'files', newestFirst: true, cols: (f) => ({ project_id: f.projectId, size: Math.round(f.size) }) },
  activity: { table: 'activity', newestFirst: true, cols: (a) => ({ project_id: a.projectId }) },
  mentorRequests: { table: 'mentor_requests', newestFirst: true, cols: (r) => ({ student_id: r.studentId, mentor_id: r.mentorId, status: r.status }) },
  supportRequests: { table: 'support_requests', newestFirst: true, cols: (r) => ({ student_id: r.studentId, researcher_id: r.researcherId || null, status: r.status }) },
  billing: { table: 'billing_events', newestFirst: true, cols: (b) => ({ user_id: b.userId, status: b.status }) },
  statements: { table: 'statements', cols: (s) => ({ researcher_id: s.researcherId, period: s.period, status: s.status }) },
  reports: { table: 'reports', newestFirst: true, cols: (r) => ({ status: r.status }) },
  contactMessages: { table: 'contact_messages', newestFirst: true, cols: (m) => ({ status: m.status }) },
  audit: { table: 'audit_log', newestFirst: true, cols: () => ({}) },
  notifications: { table: 'notifications', newestFirst: true, cols: (n) => ({ user_id: n.userId }) }
};
/** Keyed maps (id = user id) exposed to the domain code as plain objects. */
const MAPS = { subscriptions: 'subscriptions', prefs: 'notification_prefs' };
const META_KEYS = ['seq', 'compConfig'];
/** Parents before children so that foreign keys are satisfied at every step. */
const COMMIT_ORDER = ['users', 'projects', 'requests', 'agreements', 'tasks', 'files', 'activity', 'mentorRequests', 'supportRequests', 'billing', 'statements', 'reports', 'contactMessages', 'audit', 'notifications'];

/** Create the schema (idempotent; safe to run on every start). */
async function migrate(pool) { await pool.withClient((c) => c.exec(SCHEMA)); }

/** Remove every row and restart the ordering counters (demo reset, tests). */
async function wipe(pool) { await pool.query('TRUNCATE ' + TABLES.join(', ') + ' RESTART IDENTITY CASCADE'); }

const ORDERED = Object.keys(COLLECTIONS);

class UnitOfWork {
  constructor(client) {
    this.c = client; this.col = {}; this.maps = {}; this.meta = {}; this.writes = 0;
    const self = this, db = {};
    Object.keys(COLLECTIONS).forEach((name) => Object.defineProperty(db, name, {
      enumerable: true, get() { return self.col[name].items; }, set(v) { self.col[name].items = v; }
    }));
    Object.keys(MAPS).forEach((name) => Object.defineProperty(db, name, { enumerable: true, get() { return self.maps[name].obj; } }));
    META_KEYS.forEach((k) => Object.defineProperty(db, k, { enumerable: true, get() { return self.meta[k].obj; } }));
    this.db = db;
  }

  /** One round trip: every collection, newest-first ones ordered by descending insertion sequence. */
  async load() {
    const parts = ORDERED.map((name) => { const cfg = COLLECTIONS[name]; return "SELECT '" + name + "' AS t, id, data, " + (cfg.newestFirst ? '-seq' : 'seq') + ' AS ord FROM ' + cfg.table; })
      .concat(Object.keys(MAPS).map((m) => "SELECT 'map:" + m + "' AS t, id, data, 0 AS ord FROM " + MAPS[m]))
      .concat(["SELECT 'meta' AS t, id, data, 0 AS ord FROM meta"]);
    const rows = (await this.c.query('SELECT t, id, data FROM (' + parts.join(' UNION ALL ') + ') x ORDER BY t, ord')).rows;
    ORDERED.forEach((name) => { this.col[name] = { cfg: COLLECTIONS[name], items: [], snap: new Map() }; });
    Object.keys(MAPS).forEach((m) => { this.maps[m] = { table: MAPS[m], obj: {}, snap: new Map() }; });
    META_KEYS.forEach((k) => { this.meta[k] = { obj: {}, snap: null }; });
    rows.forEach((r) => {
      const json = JSON.stringify(r.data);
      if (this.col[r.t]) { this.col[r.t].items.push(r.data); this.col[r.t].snap.set(r.id, json); }
      else if (r.t.startsWith('map:')) { const m = this.maps[r.t.slice(4)]; m.obj[r.id] = r.data; m.snap.set(r.id, json); }
      else if (this.meta[r.id]) { this.meta[r.id].obj = r.data; this.meta[r.id].snap = json; }
    });
  }

  /** Statements needed to persist every change made during the request. */
  _statements() {
    const out = [];
    const add = (text, params) => out.push([text, params]);
    COMMIT_ORDER.forEach((name) => this._flush(name, add));
    Object.keys(this.maps).forEach((name) => {
      const m = this.maps[name], seen = new Set();
      Object.keys(m.obj).forEach((id) => {
        seen.add(id); const j = JSON.stringify(m.obj[id]);
        if (!m.snap.has(id)) add('INSERT INTO ' + m.table + ' (id, data) VALUES ($1, $2::jsonb)', [id, j]);
        else if (m.snap.get(id) !== j) add('UPDATE ' + m.table + ' SET data = $1::jsonb WHERE id = $2', [j, id]);
      });
      m.snap.forEach((_, id) => { if (!seen.has(id)) add('DELETE FROM ' + m.table + ' WHERE id = $1', [id]); });
    });
    Object.keys(this.meta).forEach((k) => {
      const m = this.meta[k], j = JSON.stringify(m.obj);
      if (m.snap === null) { if (j !== '{}') add('INSERT INTO meta (id, data) VALUES ($1, $2::jsonb)', [k, j]); }
      else if (m.snap !== j) add('UPDATE meta SET data = $1::jsonb WHERE id = $2', [j, k]);
    });
    return out;
  }
  _flush(name, add) {
    const c = this.col[name], cfg = c.cfg, idOf = cfg.idOf || ((x) => x.id), present = new Set();
    const list = cfg.newestFirst ? c.items.slice().reverse() : c.items;
    list.forEach((item) => {
      const id = idOf(item); present.add(id);
      const json = JSON.stringify(item);
      if (!c.snap.has(id)) {
        const cols = cfg.cols(item), names = ['id'].concat(Object.keys(cols), ['data']);
        add('INSERT INTO ' + cfg.table + ' (' + names.join(',') + ') VALUES (' + names.map((n, i) => '$' + (i + 1) + (n === 'data' ? '::jsonb' : '')).join(',') + ')', [id].concat(Object.keys(cols).map((k) => cols[k]), [json]));
      } else if (c.snap.get(id) !== json) {
        const cols = cfg.cols(item), names = Object.keys(cols).concat(['data']);
        add('UPDATE ' + cfg.table + ' SET ' + names.map((n, i) => n + ' = $' + (i + 1) + (n === 'data' ? '::jsonb' : '')).join(',') + ' WHERE id = $' + (names.length + 1), Object.keys(cols).map((k) => cols[k]).concat([json, id]));
      }
    });
    c.snap.forEach((_, id) => { if (!present.has(id)) add('DELETE FROM ' + cfg.table + ' WHERE id = $1', [id]); });
    if (name === 'projects') {
      c.items.forEach((p) => {
        const old = c.snap.get(p.id);
        if (old && JSON.parse(old).members.join() === p.members.join()) return;
        add('DELETE FROM project_members WHERE project_id = $1', [p.id]);
        p.members.forEach((u) => add('INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [p.id, u]));
      });
    }
  }
  /** Persist the changes. Statements run one after another on the one connection; the first failure is the root cause. */
  async commit() {
    const stmts = this._statements(); this.writes = stmts.length;
    if (!stmts.length) return;
    await this.c.exec('SET CONSTRAINTS ALL DEFERRED');
    for (const s of stmts) await this.c.query(s[0], s[1]); // one statement at a time on this connection
  }
}

/**
 * Run `fn` inside one transaction. `ctx.db` is the Unit of Work view.
 * `write` requests take the advisory lock (serialised writers); reads use a
 * REPEATABLE READ snapshot and are rejected if they try to change data.
 * Errors roll everything back unless they carry `commit: true` (the demo
 * conflict simulation, where "the other session" really did win).
 */
async function transact(pool, ctx, fn, opts) {
  const write = !opts || opts.write !== false;
  return pool.withClient(async (c) => {
    await c.query(write ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ');
    if (write) await c.query('SELECT pg_advisory_xact_lock($1)', [WRITE_LOCK_ID]);
    const uow = new UnitOfWork(c); ctx.db = uow.db;
    let result;
    const rollback = async (e) => {
      try { await c.query('ROLLBACK'); } catch (x) { /* connection already gone */ }
      (ctx.onRollback || []).forEach((f) => { try { f(); } catch (x) { /* best effort */ } });
      throw e;
    };
    try {
      await uow.load();
      result = await fn();
      if (!write) { if (uow._statements().length) throw new Error('A read-only request tried to change data'); }
      else await uow.commit();
      await c.query('COMMIT');
    } catch (e) {
      if (write && e && (e.commit || ctx.commitOnError) && !(e.name === 'PgError')) {
        try { await uow.commit(); await c.query('COMMIT'); } catch (x) { return rollback(e); }
        (ctx.onRollback || []).forEach((f) => { try { f(); } catch (x) { /* best effort */ } });
        throw e;
      }
      return rollback(e);
    }
    return result;
  });
}

module.exports = { migrate, wipe, transact, UnitOfWork, COLLECTIONS, SCHEMA, TABLES };
