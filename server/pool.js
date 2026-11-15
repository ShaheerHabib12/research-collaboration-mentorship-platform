/**
 * pool.js - the database connection pool, built on the official `pg` package (node-postgres).
 *
 * A thin wrapper that gives the rest of the server three small methods:
 *   pool.query(text, params)        one statement on any free connection
 *   pool.withClient(fn)             one connection, held exclusively (transactions)
 *   client.exec(sql)                a multi-statement script (migrations)
 * All values travel as bound parameters ($1, $2 ...), never concatenated into SQL (NFR-004).
 */
'use strict';
const pg = require('pg');

/** Read a postgres:// URL. sslmode=require encrypts without verifying the chain (libpq semantics; Supabase's CA is not in the system store). */
function parseUrl(url) {
  const u = new URL(url);
  const mode = u.searchParams.get('sslmode') || '';
  return {
    host: u.hostname || '127.0.0.1', port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)),
    ssl: /^(require|verify-ca|verify-full)$/.test(mode) ? { rejectUnauthorized: mode !== 'require' } : false
  };
}

/** Numbers come back as JavaScript numbers (counts, sizes, rates); json/jsonb are already parsed by pg. */
const NUMERIC_OIDS = new Set([20, 21, 23, 26, 700, 701, 1700]);
const types = { getTypeParser: (oid, format) => (NUMERIC_OIDS.has(oid) ? Number : pg.types.getTypeParser(oid, format)) };

class Pool {
  /** @param {string|object} url postgres:// URL or a config object; @param {number} [max] */
  constructor(url, max) {
    const cfg = typeof url === 'string' ? parseUrl(url) : url;
    this.cfg = cfg; this.max = max || 10;
    this.pool = new pg.Pool(Object.assign({}, cfg, { max: this.max, types, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 }));
    this.pool.on('error', () => { /* an idle connection dropped: the pool opens a new one on demand */ });
  }
  query(text, params) { return this.pool.query(text, params); }
  async withClient(fn) {
    const c = await this.pool.connect();
    const client = { query: (t, p) => c.query(t, p), exec: (sql) => c.query(sql) };
    let broken = false;
    try { return await fn(client); } catch (e) { if (e && (e.code === 'ECONNRESET' || e.code === '57P01')) broken = true; throw e; } finally { c.release(broken); }
  }
  end() { return this.pool.end(); }
}

module.exports = { Pool, parseUrl };
