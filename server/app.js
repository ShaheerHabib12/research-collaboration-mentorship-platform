/**
 * app.js - C2 API gateway, built on Express 5.
 *
 * Request pipeline: helmet security headers -> HTTPS redirect -> CORS -> throttles -> JSON body ->
 * authenticate (JWT) -> route -> ONE database transaction (services.js) -> JSON response.
 * Nothing is reported as saved before the transaction has committed (NFR-010). Logs never contain
 * passwords, tokens or request bodies (NFR-016). In production the React build in client/dist is
 * served from the same origin, so no cross-origin access is needed.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const DB = require('./db');
const Auth = require('./auth');
const { api, ApiError } = require('./services');
const { seedDatabase } = require('./seed');
const V = require('../shared/validators');

const MAX_JSON = 1024 * 1024;
/** GET endpoints that lazily create a record (the agreement template on first open) need a write transaction. */
const LAZY_CREATE_GETS = /^\/api\/projects\/[^/]+\/agreement$/;
/** POSTs that never change data: they run in a read-only snapshot and do not take the writer lock. */
const READ_ONLY_POSTS = new Set(['/api/auth/login', '/api/auth/logout', '/api/auth/forgot', '/api/assistant']);

/** The route table: one entry per endpoint, in the order Express must register them (static paths before :id). */
function buildRoutes() {
  const routes = [];
  const add = (method, pattern, fn, created) => {
    routes.push({ method, pattern, fn, created: !!created });
  };
  const F = (q) => { try { return q.f ? JSON.parse(q.f) : {}; } catch (e) { throw new ApiError(400, 'Filters could not be read.'); } };
  const page = (q) => Math.max(1, parseInt(q.page, 10) || 1);

  // Accounts and profiles (C3)
  add('POST', '/api/auth/register', (c, p, q, b) => api.register(c, b), true);
  add('POST', '/api/auth/verify', (c, p, q, b) => api.verifyEmail(c, b.email, b.pin));
  add('POST', '/api/auth/resend', (c, p, q, b) => api.resendPin(c, b.email));
  add('POST', '/api/auth/login', (c, p, q, b) => api.login(c, b.email, b.password));
  add('POST', '/api/auth/forgot', (c, p, q, b) => api.forgotPassword(c, b.email));
  add('POST', '/api/auth/reset', (c, p, q, b) => api.resetPassword(c, b.token, b.password));
  add('POST', '/api/assistant', (c, p, q, b) => api.assistant(c, b.message));
  add('POST', '/api/auth/logout', () => ({ ok: true }));
  add('GET', '/api/me', (c) => api.me(c));
  add('GET', '/api/summary', (c) => api.summary(c));
  add('GET', '/api/profile', (c) => api.getProfile(c, null));
  add('PUT', '/api/profile', (c, p, q, b) => api.updateProfile(c, b));
  add('GET', '/api/profiles/:id', (c, p) => api.getProfile(c, p.id));
  add('GET', '/api/me/export', (c) => api.exportMyData(c));
  add('DELETE', '/api/me', (c) => api.deleteMyAccount(c));
  add('GET', '/api/dashboard', (c) => api.dashboard(c));
  // Discovery and projects (C4)
  add('GET', '/api/projects/search', (c, p, q) => api.searchProjects(c, F(q), page(q)));
  add('GET', '/api/people/search', (c, p, q) => api.searchPeople(c, F(q), page(q)));
  add('GET', '/api/projects', (c) => api.myProjects(c));
  add('POST', '/api/projects', (c, p, q, b) => api.saveProject(c, b.data, null, !!b.publish), true);
  add('GET', '/api/projects/:id', (c, p) => api.getProject(c, p.id));
  add('PUT', '/api/projects/:id', (c, p, q, b) => api.saveProject(c, b.data, p.id, !!b.publish));
  add('POST', '/api/projects/:id/status', (c, p, q, b) => api.setProjectStatus(c, p.id, b.status));
  add('POST', '/api/projects/:id/interest', (c, p, q, b) => api.sendInterest(c, p.id, b.message), true);
  add('POST', '/api/projects/:id/invitations', (c, p, q, b) => api.sendInvitation(c, p.id, b.userId, b.message), true);
  add('GET', '/api/requests', (c) => api.listRequests(c));
  add('POST', '/api/requests/:id/act', (c, p, q, b) => api.actOnRequest(c, p.id, b.to));
  // Team agreement (C4)
  add('GET', '/api/projects/:id/agreement', (c, p) => api.getAgreement(c, p.id));
  add('PUT', '/api/projects/:id/agreement', (c, p, q, b) => api.saveAgreement(c, p.id, b.draft, b.baseVersion, !!b.publish));
  add('POST', '/api/projects/:id/agreement/acknowledge', (c, p, q, b) => api.acknowledgeAgreement(c, p.id, b.version));
  add('POST', '/api/projects/:id/agreement/proposals', (c, p, q, b) => api.proposeRevision(c, p.id, b.section, b.text));
  add('POST', '/api/projects/:id/agreement/proposals/:pid', (c, p, q, b) => api.resolveProposal(c, p.id, p.pid, b.decision));
  // Workspace (C6)
  add('GET', '/api/projects/:id/workspace', (c, p) => api.getWorkspace(c, p.id));
  add('POST', '/api/projects/:id/tasks', (c, p, q, b) => api.saveTask(c, p.id, b, null), true);
  add('PUT', '/api/projects/:id/tasks/:tid', (c, p, q, b) => api.saveTask(c, p.id, b, p.tid));
  add('POST', '/api/projects/:id/tasks/:tid/move', (c, p, q, b) => api.moveTask(c, p.id, p.tid, b.status));
  add('DELETE', '/api/projects/:id/tasks/:tid', (c, p) => api.deleteTask(c, p.id, p.tid));
  add('POST', '/api/projects/:id/milestones', (c, p, q, b) => api.addMilestone(c, p.id, b.title, b.due), true);
  add('POST', '/api/projects/:id/milestones/:mid/toggle', (c, p) => api.toggleMilestone(c, p.id, p.mid));
  add('GET', '/api/projects/:id/files/:fid', (c, p) => api.openFile(c, p.id, p.fid));
  add('GET', '/api/projects/:id/files/:fid/content', (c, p) => { const r = api.readFile(c, p.id, p.fid); return { __raw: r }; });
  add('DELETE', '/api/projects/:id/files/:fid', (c, p) => api.deleteFile(c, p.id, p.fid));
  // Mentorship and researcher support (C5)
  add('GET', '/api/mentors/search', (c, p, q) => api.searchMentors(c, F(q), page(q)));
  add('PUT', '/api/mentors/accepting', (c, p, q, b) => api.toggleAccepting(c, !!b.accepting));
  add('POST', '/api/mentorship-requests', (c, p, q, b) => api.requestMentorship(c, b), true);
  add('GET', '/api/mentorship-requests', (c) => api.listMentorRequests(c));
  add('POST', '/api/mentorship-requests/:id/act', (c, p, q, b) => api.actOnMentorRequest(c, p.id, b.action, b.note));
  add('POST', '/api/support', (c, p, q, b) => api.createSupport(c, b), true);
  add('GET', '/api/support', (c) => api.listSupport(c));
  add('POST', '/api/support/:id/act', (c, p, q, b) => api.updateSupport(c, p.id, b.action, b.text));
  add('POST', '/api/support/:id/feedback', (c, p, q, b) => api.feedbackSupport(c, p.id, b.rating, b.comment));
  // Subscription and compensation (C10)
  add('GET', '/api/subscription', (c) => api.getSubscription(c));
  add('POST', '/api/subscription', (c, p, q, b) => api.subscribe(c, b.planId, b.outcome));
  add('POST', '/api/subscription/settle', (c, p, q, b) => api.settlePending(c, b.eventId));
  add('DELETE', '/api/subscription', (c) => api.cancelSubscription(c));
  add('GET', '/api/statements', (c) => api.listStatements(c));
  add('POST', '/api/statements/:id/act', (c, p, q, b) => api.actOnStatement(c, p.id, b.action, b.payload));
  // Administration and moderation (C7)
  add('GET', '/api/admin/overview', (c) => api.adminOverview(c));
  add('GET', '/api/admin/researchers', (c) => api.listResearchers(c));
  add('PATCH', '/api/admin/researchers/:id', (c, p, q, b) => api.updateResearcher(c, p.id, b));
  add('POST', '/api/reports', (c, p, q, b) => api.reportContent(c, b), true);
  add('POST', '/api/contact', (c, p, q, b) => api.sendContact(c, b), true);
  add('GET', '/api/admin/contact', (c) => api.listContact(c));
  add('POST', '/api/admin/contact/:id/status', (c, p, q, b) => api.setContactStatus(c, p.id, b.status));
  add('GET', '/api/admin/reports', (c) => api.listReports(c));
  add('POST', '/api/admin/reports/:id/act', (c, p, q, b) => api.actOnReport(c, p.id, b.action));
  add('GET', '/api/admin/audit', (c) => api.listAudit(c));
  // Notifications
  add('GET', '/api/notifications', (c) => api.listNotifications(c));
  add('POST', '/api/notifications/:id/read', (c, p) => api.markRead(c, p.id));
  add('GET', '/api/notification-prefs', (c) => api.getPrefs(c));
  add('PUT', '/api/notification-prefs', (c, p, q, b) => api.setPrefs(c, b));
  return routes;
}


/**
 * @param {object} o
 * @param {import('./pool').Pool} o.pool PostgreSQL connection pool
 * @param {{put,get,has,remove}} o.storage encrypted file store (C9)
 * @param {string} o.secret JWT signing secret
 * @param {boolean} [o.allowSim] honour demo simulation flags / reset (never in production)
 * @param {string} [o.staticDir] folder with the built React client
 * @param {(line:object)=>void} [o.log]
 * @returns {import('express').Express}
 */
function createApp(o) {
  if (o.verifyEmail && !(o.mailer && o.mailer.configured)) throw new Error('E-mail verification needs a mail provider (see .env.example).');
  const log = o.log || (() => {});
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  if (o.trustProxy) app.set('trust proxy', 1);

  /* ---- security headers (NFR-004) ---- */
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], fontSrc: ["'self'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"], frameAncestors: ["'none'"] } },
    referrerPolicy: { policy: 'same-origin' }, frameguard: { action: 'deny' },
    hsts: o.forceHttps ? { maxAge: 15552000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: { policy: 'require-corp' }   // nothing is loaded from another origin, so the strict policy is safe
  }));
  /* Browser features the application never uses are switched off (reported by the OWASP ZAP baseline scan). */
  app.use((req, res, next) => { res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'); next(); });
  /* NFR-003: in deployed environments plain HTTP is redirected to HTTPS. */
  if (o.forceHttps) app.use((req, res, next) => (req.headers['x-forwarded-proto'] === 'https' ? next() : res.redirect(308, 'https://' + req.headers.host + req.originalUrl)));

  /* ---- CORS: open only for local development; in production only an explicit origin ---- */
  const corsOrigin = o.corsOrigin || (o.allowSim ? true : false);
  app.use('/api', cors({ origin: corsOrigin, allowedHeaders: ['Authorization', 'Content-Type', 'X-RCMP-Sim', 'X-File-Name', 'X-File-Permission'], methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], exposedHeaders: ['X-RCMP-Sim-Consumed'] }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  /* ---- request log: method, path, status, time, user id. Never headers, bodies or tokens (NFR-016). ---- */
  app.use('/api', (req, res, next) => {
    const t0 = Date.now();
    res.on('finish', () => log({ level: 'info', method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - t0, user: res.locals.userId || undefined }));
    next();
  });

  /* ---- throttles: in-memory sliding windows per client address ---- */
  const hitsStore = new Map();
  const limit = (name, max, windowMs, message) => (req, res, next) => {
    const key = name + '|' + req.ip, now = Date.now(), hits = (hitsStore.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) { hitsStore.set(key, hits); return next(new ApiError(429, message)); }
    hits.push(now); hitsStore.set(key, hits);
    if (hitsStore.size > 5000) for (const [k, v] of hitsStore) if (!v.some((t) => now - t < 600000)) hitsStore.delete(k);
    next();
  };
  const failures = new Map(); // login brute-force throttle: 8 failures / 10 min per client
  app.post('/api/auth/login', (req, res, next) => {
    const key = req.ip, f = failures.get(key);
    if (f && f.n >= 8 && f.until > Date.now()) return next(new ApiError(429, 'Too many sign-in attempts. Please wait a few minutes and try again.'));
    res.on('finish', () => {
      if (res.statusCode === 401) { const cur = failures.get(key); failures.set(key, { n: (cur && cur.until > Date.now() ? cur.n : 0) + 1, until: Date.now() + 10 * 60 * 1000 }); }
      else if (res.statusCode === 200) failures.delete(key);
    });
    next();
  });
  const pre = {
    'POST /api/assistant': limit('ask', o.askLimit || 30, 60000, 'You are asking quickly. Please wait a moment and try again.'),
    'POST /api/contact': limit('contact', o.contactLimit || 5, 600000, 'You have sent several messages recently. Please try again in a few minutes.'),
    'POST /api/auth/register': null, 'POST /api/auth/resend': null, 'POST /api/auth/verify': null
  };
  const authLimit = limit('auth', o.authLimit || 12, 600000, 'Too many attempts from this connection. Please wait a few minutes and try again.');
  for (const k of ['POST /api/auth/register', 'POST /api/auth/resend', 'POST /api/auth/verify']) pre[k] = authLimit;

  /** A fresh request context: who is calling, simulation flags, mail outbox. */
  function makeCtx(req, res) {
    const ctx = { userId: null, sim: {}, consumed: [], onRollback: [], storage: o.storage, outbox: [], pinSecret: o.secret, verifyEmail: !!o.verifyEmail, mailEnabled: !!(o.mailer && o.mailer.configured && o.publicUrl), publicUrl: o.publicUrl || '' };
    res.locals.ctx = ctx;
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    const claims = m ? Auth.verifyToken(m[1], o.secret) : null;
    if (claims && !claims.purpose) { ctx.userId = claims.sub; ctx.tokenPv = claims.pv; res.locals.userId = claims.sub; }
    ctx.issueReset = (u) => Auth.signToken(u.id, o.secret, undefined, { purpose: 'reset', pv: Auth.pwFingerprint(u.pw) }, Auth.RESET_TTL_SECONDS);
    ctx.verifyReset = (t) => { const c = Auth.verifyToken(t, o.secret); return c && c.purpose === 'reset' ? c : null; };
    if (o.allowSim && req.headers['x-rcmp-sim']) { try { ctx.sim = JSON.parse(req.headers['x-rcmp-sim']) || {}; } catch (e) { ctx.sim = {}; } }
    return ctx;
  }
  const simHeader = (ctx) => (ctx.consumed.length ? { 'X-RCMP-Sim-Consumed': ctx.consumed.join(',') } : {});
  /** Shape an error into `{error, fields?}` for the client; never includes stack traces. */
  function errorBody(e) {
    const out = { error: e.message };
    Object.keys(e).forEach((k) => { if (['status', 'commit', 'name'].indexOf(k) === -1) out[k] = e[k]; });
    return out;
  }
  /** Map unexpected/engine errors to safe, honest responses (NFR-004, NFR-010). */
  function normalise(e) {
    if (e instanceof ApiError) return e;
    if (e && e.type === 'entity.too.large') return new ApiError(413, 'Request body is too large.');
    if (e && (e.type === 'entity.parse.failed' || e instanceof SyntaxError)) return new ApiError(400, 'The request body is not valid JSON.');
    // SQLSTATE classes: 23505 unique, 23514 check, 23503 foreign key, 23502 not null, 22xxx bad value.
    const code = e && e.code;
    if (code === '23505') return new ApiError(409, 'This record already exists or was just changed by someone else. Nothing was saved.');
    if (code === '23514' || code === '23503' || code === '23502' || (typeof code === 'string' && code.startsWith('22'))) return new ApiError(400, 'The data was rejected by the database rules. Nothing was saved.');
    return new ApiError(500, 'Something went wrong on the server. Your change was not saved - please retry.');
  }
  /** Run one service call in ONE transaction, send mail after the commit, and answer. */
  async function respond(req, res, ctx, status, work, write) {
    let result = await DB.transact(o.pool, ctx, work, { write });
    // E-mail goes out only after the database commit, so a rolled-back request never sends a PIN.
    for (const m of ctx.outbox) {
      try { await o.mailer.send(m); } catch (e) { log({ level: 'error', msg: 'mail failed: ' + String(e && e.message) }); if (result && result.pending) result.emailSent = false; }
    }
    res.set(simHeader(ctx));
    if (result && result.__raw) {
      return res.status(200).set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="' + V.sanitizeFileName(result.__raw.file.name) + '"', 'X-Content-Type-Options': 'nosniff' }).send(result.__raw.bytes);
    }
    if (ctx.loginAs) result = { token: Auth.signToken(ctx.loginAs, o.secret, undefined, { pv: ctx.loginPv }), user: result };
    return res.status(status).json(result === undefined ? { ok: true } : result);
  }

  /* ---- health and demo reset ---- */
  app.get('/api/health', async (req, res) => {
    try { await o.pool.query('SELECT 1'); res.json({ ok: true, db: true, demo: !!o.allowSim, time: new Date().toISOString() }); }
    catch (e) { res.status(503).json({ ok: false, db: false, error: 'The database is not reachable.' }); }
  });
  app.post('/api/demo/reset', async (req, res, next) => {
    try {
      if (!o.allowSim) throw new ApiError(404, 'Not found.');
      const keep = (await o.pool.query("SELECT data->>'pw' AS pw FROM users WHERE id = 'USR-099'")).rows[0]; // the real administrator keeps their password across a demo reset
      await DB.wipe(o.pool); await seedDatabase(o.pool, DB, keep && keep.pw); if (o.storage.clear) o.storage.clear();
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  /* ---- file upload: raw bytes; the size is always counted, bytes are kept only within 10 MiB (FR-029, NFR-018) ---- */
  app.post('/api/projects/:id/files', async (req, res, next) => {
    try {
      const ctx = makeCtx(req, res);
      const chunks = []; let size = 0, over = false;
      await new Promise((resolve, reject) => { req.on('data', (c) => { size += c.length; if (size <= V.MAX_FILE_BYTES) chunks.push(c); else over = true; }); req.on('end', resolve); req.on('error', reject); });
      let fileName = ''; try { fileName = decodeURIComponent(req.headers['x-file-name'] || ''); } catch (e) { throw new ApiError(400, 'The file name could not be read.'); }
      const file = { name: fileName, size, bytes: over ? null : Buffer.concat(chunks) };
      await respond(req, res, ctx, 201, async () => api.uploadFile(ctx, req.params.id, file, req.headers['x-file-permission']), true);
    } catch (e) { next(e); }
  });

  /* ---- JSON API: one handler per row of the route table ---- */
  const json = express.json({ limit: MAX_JSON, type: () => true });
  for (const r of buildRoutes()) {
    const mws = [];
    const p = pre[r.method + ' ' + r.pattern]; if (p) mws.push(p);
    if (['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(r.method) !== -1) mws.push(json);
    app[r.method.toLowerCase()](r.pattern, ...mws, async (req, res, next) => {
      try {
        const ctx = makeCtx(req, res), body = req.body && typeof req.body === 'object' ? req.body : {};
        const write = !((req.method === 'GET' && !LAZY_CREATE_GETS.test(req.path)) || READ_ONLY_POSTS.has(req.path));
        await respond(req, res, ctx, r.created ? 201 : 200, async () => r.fn(ctx, req.params, req.query, body), write);
      } catch (e) { next(e); }
    });
  }
  app.use('/api', (req, res, next) => next(new ApiError(404, 'Unknown API route.')));

  /* ---- the React build (client/dist), with a fallback to index.html for client-side routes ---- */
  if (o.staticDir) {
    // links written as page.html (notifications, e-mails, the Scout assistant) map onto the client routes
    app.get(/^\/([\w-]+)\.html$/, (req, res) => res.redirect(301, '/' + (req.params[0] === 'index' ? '' : req.params[0]) + req.url.slice(req.path.length)));
    // never answer for hidden files or project folders, not even with the app shell (NFR-001, OWASP A05)
    app.use((req, res, next) => (/(^|\/)\.(?!well-known\/)/.test(req.path) || /^\/(data|server|shared|tests|docs|scripts|node_modules|supabase|cypress|k6)(\/|$)/i.test(req.path) ? res.status(404).type('text/plain').send('Not found') : next()));
    app.get('/.well-known/security.txt', (req, res) => res.redirect(301, '/security.txt'));
    app.use(express.static(o.staticDir, { index: false, dotfiles: 'ignore', setHeaders: (res, file) => res.set('Cache-Control', file.endsWith('.html') ? 'no-cache' : 'public, max-age=300') }));
    app.get(/^(?!\/api\/).*/, (req, res, next) => {
      const index = path.join(o.staticDir, 'index.html');
      if (path.extname(req.path) || !fs.existsSync(index)) return next();
      res.set('Cache-Control', 'no-cache').sendFile(index);
    });
  }
  app.use((req, res) => res.status(404).type('text/plain').send('Not found'));

  /* ---- error handler: honest status, safe message, no stack traces ---- */
  // eslint-disable-next-line no-unused-vars
  app.use((e, req, res, next) => {
    const err = normalise(e);
    if (err.status === 500) log({ level: 'error', msg: String(e && e.message), stack: o.allowSim ? String(e && e.stack) : undefined });
    if (res.locals.ctx) res.set(simHeader(res.locals.ctx));
    res.status(err.status).json(errorBody(err));
  });
  return app;
}
module.exports = { createApp, buildRoutes };
