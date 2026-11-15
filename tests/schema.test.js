/**
 * schema.test.js - the SQL file for Supabase (supabase/schema.sql) must work on a real
 * PostgreSQL, be safe to run twice, lock the tables against the public API, and match
 * what the server expects.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const DB = require('../server/db');
const { freshDatabase } = require('./pgtest');

const SQL = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
let fresh;
beforeAll(async () => { fresh = await freshDatabase(); });
afterAll(async () => { await fresh.drop(); });

test('TC-SQ-01 schema.sql creates every table and can be run twice', async () => {
  await fresh.pool.withClient((c) => c.exec(SQL));
  await fresh.pool.withClient((c) => c.exec(SQL));
  const r = await fresh.pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  const have = r.rows.map((x) => x.tablename);
  for (const t of DB.TABLES) assert.ok(have.includes(t), 'missing table ' + t);
});

test('TC-SQ-02 row level security is on for every table (Supabase anon key cannot read rows)', async () => {
  const r = await fresh.pool.query("SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity");
  assert.deepEqual(r.rows, []);
});

test('TC-SQ-03 the server still migrates and works on a database created from schema.sql', async () => {
  await DB.migrate(fresh.pool);
  const r = await fresh.pool.query('SELECT COUNT(*)::int AS n FROM users');
  assert.equal(r.rows[0].n, 0);
});

test('TC-SQ-04 schema.sql contains the server SCHEMA verbatim (regenerate with npm run schema)', () => {
  assert.ok(SQL.includes(DB.SCHEMA.trim()));
});
