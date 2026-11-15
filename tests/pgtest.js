/**
 * pgtest.js - gives each test file its own real PostgreSQL database.
 *
 *  1. If TEST_DATABASE_URL is set (CI service container, docker compose, your own
 *     server) it is used: a throw-away database is created on that server.
 *  2. Otherwise, if PostgreSQL's server programs are installed, a temporary
 *     cluster is started on a free port (initdb + pg_ctl) and removed afterwards.
 *     Under root (some containers) the cluster runs as the `postgres` OS user.
 * Tests never touch the development database.
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { Pool, parseUrl } = require('../server/pool');

function findBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  for (const base of ['/usr/lib/postgresql', '/usr/local/pgsql', '/opt/homebrew/opt/postgresql@16']) {
    try { const v = fs.readdirSync(base).sort().pop(); const p = fs.existsSync(path.join(base, v, 'bin')) ? path.join(base, v, 'bin') : path.join(base, 'bin'); if (fs.existsSync(path.join(p, 'initdb'))) return p; } catch (e) { /* next */ }
  }
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['initdb']);
  return which.status === 0 ? path.dirname(which.stdout.toString().split('\n')[0].trim()) : null;
}
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

let cluster = null;
async function ensureServer() {
  if (process.env.TEST_DATABASE_URL) return { url: process.env.TEST_DATABASE_URL };
  if (cluster) return cluster;
  const bin = findBin();
  if (!bin) throw new Error('No PostgreSQL available for tests. Set TEST_DATABASE_URL (e.g. docker compose up -d db) or install PostgreSQL 14+.');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rcmp-pg-')), port = await freePort(), asRoot = process.getuid && process.getuid() === 0;
  const pw = crypto.randomBytes(8).toString('hex'), pwfile = path.join(root, 'pw'); fs.writeFileSync(pwfile, pw);
  if (asRoot) execFileSync('chown', ['-R', 'postgres', root]);
  const run = (cmd, a) => (asRoot ? execFileSync('su', ['postgres', '-s', '/bin/sh', '-c', [path.join(bin, cmd)].concat(a).map((x) => "'" + x + "'").join(' ')], { stdio: 'pipe' }) : execFileSync(path.join(bin, cmd), a, { stdio: 'pipe' }));
  run('initdb', ['-D', path.join(root, 'data'), '-A', 'scram-sha-256', '--pwfile=' + pwfile, '-U', 'rcmp', '--no-sync']);
  run('pg_ctl', ['-D', path.join(root, 'data'), '-o', '-p ' + port + ' -k ' + root + ' -c listen_addresses=127.0.0.1 -c fsync=off -c max_connections=200', '-l', path.join(root, 'log'), '-w', 'start']);
  cluster = { url: 'postgres://rcmp:' + pw + '@127.0.0.1:' + port + '/postgres', root, bin, run };
  process.on('exit', () => { try { run('pg_ctl', ['-D', path.join(root, 'data'), '-m', 'immediate', 'stop']); fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* best effort */ } });
  return cluster;
}

/** @returns {{pool, url, name, drop}} a fresh, empty database (schema NOT yet created). */
async function freshDatabase() {
  const srv = await ensureServer(), base = parseUrl(srv.url), name = 'rcmp_t_' + crypto.randomBytes(5).toString('hex');
  const admin = new Pool(Object.assign({}, base, { database: base.database }), 1);
  await admin.query('CREATE DATABASE ' + name); await admin.end();
  const cfg = Object.assign({}, base, { database: name }), url = 'postgres://' + encodeURIComponent(base.user) + ':' + encodeURIComponent(base.password) + '@' + base.host + ':' + base.port + '/' + name;
  const pool = new Pool(cfg, 12);
  return {
    pool, url, name, adminUrl: srv.url, bin: srv.bin,
    async drop() { await pool.end(); const a = new Pool(base, 1); await a.query('DROP DATABASE IF EXISTS ' + name + ' WITH (FORCE)'); await a.end(); }
  };
}
module.exports = { freshDatabase, ensureServer };
