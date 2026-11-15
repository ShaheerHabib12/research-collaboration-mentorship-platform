/**
 * backup.js - NFR-008: scheduled backup with a manifest, and a restore check.
 *
 *   node server/backup.js backup [dir]        -> pg_dump (custom format) + manifest
 *   node server/backup.js verify <dir> <file> -> restore into a scratch database and compare
 *
 * Needs the PostgreSQL client tools (pg_dump, pg_restore) on PATH, or PG_BIN
 * pointing at their folder. The manifest records per-table row counts, the
 * SHA-256 of the dump and the time taken: the evidence NFR-008 asks for
 * (RPO 24 h / RTO 4 h). A restore is only considered good if the restored
 * row counts equal the manifest.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Pool, parseUrl } = require('./pool');
const { TABLES } = require('./db');
const COUNTED = TABLES.filter((t) => t !== 'meta');

const bin = (name) => (process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name);
/** Environment for pg_dump/pg_restore with the password passed out of band, not on the command line. */
function env(cfg) { return Object.assign({}, process.env, { PGPASSWORD: cfg.password }); }
const args = (cfg, db) => ['-h', cfg.host, '-p', String(cfg.port), '-U', cfg.user, '-d', db || cfg.database];

/** Row count of every table, used as backup evidence. */
async function counts(pool) {
  const o = {};
  for (const t of COUNTED) o[t] = (await pool.query('SELECT COUNT(*)::int AS n FROM ' + t)).rows[0].n;
  return o;
}
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Run pg_dump (custom format) and write a manifest with the sha256 and row counts (NFR-008). */
async function backup(url, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const cfg = parseUrl(url), pool = new Pool(url, 2), t0 = Date.now();
  const file = 'rcmp-' + new Date().toISOString().replace(/[:.]/g, '-') + '.dump', full = path.join(dir, file);
  try {
    execFileSync(bin('pg_dump'), ['-Fc', '-f', full].concat(args(cfg)), { env: env(cfg), stdio: ['ignore', 'ignore', 'pipe'] });
    const manifest = { file, createdAt: new Date().toISOString(), elapsedMs: Date.now() - t0, counts: await counts(pool), sha256: sha(full) };
    fs.writeFileSync(path.join(dir, file + '.manifest.json'), JSON.stringify(manifest, null, 2));
    return manifest;
  } finally { await pool.end(); }
}

/** Restore into a scratch database on the same server, compare with the manifest, drop it. */
async function verifyRestore(url, dir, file) {
  const t0 = Date.now(), cfg = parseUrl(url), manifest = JSON.parse(fs.readFileSync(path.join(dir, file + '.manifest.json'), 'utf8'));
  if (sha(path.join(dir, file)) !== manifest.sha256) return { ok: false, reason: 'checksum mismatch' };
  const scratch = 'rcmp_restore_' + crypto.randomBytes(4).toString('hex');
  const admin = new Pool(Object.assign({}, cfg, { database: 'postgres' }), 1);
  try {
    await admin.query('CREATE DATABASE ' + scratch);
    execFileSync(bin('pg_restore'), ['--no-owner'].concat(args(cfg, scratch), [path.join(dir, file)]), { env: env(cfg), stdio: ['ignore', 'ignore', 'pipe'] });
    const pool = new Pool(Object.assign({}, cfg, { database: scratch }), 1);
    const c = await counts(pool); await pool.end();
    return { ok: JSON.stringify(c) === JSON.stringify(manifest.counts), counts: c, elapsedMs: Date.now() - t0 };
  } finally { await admin.query('DROP DATABASE IF EXISTS ' + scratch).catch(() => {}); await admin.end(); }
}
module.exports = { backup, verifyRestore, counts };

if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2), url = process.env.DATABASE_URL || 'postgres://rcmp:rcmp@localhost:5432/rcmp';
  const dir = a || path.join(process.env.RCMP_DATA_DIR || path.join(__dirname, '..', 'data'), 'backups');
  (cmd === 'backup' ? backup(url, dir) : cmd === 'verify' ? verifyRestore(url, a, b) : Promise.reject(new Error('usage: node server/backup.js backup [dir] | verify <dir> <file>')))
    .then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error(e.message); process.exit(1); });
}
