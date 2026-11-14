/**
 * services.js - Layer 2 (application) business logic: modules C3-C7 and C10.
 *
 * Each exported function is one use of the API. It receives a request context
 * (`ctx`: authenticated user id, simulation flags, the Unit of Work in
 * `ctx.db`) and returns plain JSON-serialisable data. Functions run inside ONE
 * database transaction (see db.js) so a failure never leaves partial data
 * (NFR-009, NFR-010). Pure rules (validators.js, rules.js) are shared with the
 * browser and unit-tested in isolation (NFR-017).
 *
 * Status codes (Tables 7 and 13): 400 validation, 401 not signed in / expired,
 * 402 plan limit, 403 forbidden, 404 not found, 409 conflict, 413 file too
 * large, 500 save failed.
 */
'use strict';
const V = require('../shared/validators');
const R = require('../shared/rules');
const C = require('../shared/constants');
const Auth = require('./auth');
const Mailer = require('./mailer');
const Assistant = require('./assistant');
const CONTACT_TOPICS = ['general', 'account', 'subscription', 'mentorship', 'bug', 'partnership'];
const { PLANS, COMP_CONFIG, SUPPORT_CATEGORIES, SUBJECTS, STAGES, TOPICS, SKILL_SUGGESTIONS, LANGUAGES, DAYS, colorFor, initials } = C;
const DEMO_PASSWORD = 'Demo@1234';

class ApiError extends Error {
  constructor(status, message, extra) { super(message); this.name = 'ApiError'; this.status = status; if (extra) Object.assign(this, extra); }
}
const H = 3600 * 1000, D = 24 * H;
/** Current time in ms. A single indirection so the clock is read in one place. */
function now() { return Date.now(); }
/** Timestamp `h` hours in the past (used by the seed data). */
function ago(h) { return now() - h * H; }
/** ISO date (YYYY-MM-DD) `d` days from now. */
function inDays(d) { return new Date(now() + d * D).toISOString().slice(0, 10); }
/** Deep copy of a JSON-safe value, so a response can never alias stored state. */
function clone(o) { return JSON.parse(JSON.stringify(o)); }
/** Lower-cased string; null and undefined become the empty string. */
function lower(s) { return String(s || '').toLowerCase(); }
/** Next identifier for a prefix, e.g. `REQ-981`. @param {object} db the loaded state @param {string} prefix @param {number} [start] first number. @returns {string} */
function nextId(db, prefix, start) { db.seq[prefix] = (db.seq[prefix] || start || 100) + 1; return prefix + '-' + db.seq[prefix]; }

/**
 * Every service starts here: simulated failure flags (demo only), JWT identity
 * (401), account status and role check (403).
 */
function guard(ctx, opts) {
  opts = opts || {};
  const db = ctx.db, sim = ctx.sim || {};
  let me = null;
  if (opts.auth !== false) {
    if (sim.expireNext) { ctx.consumed.push('expireNext'); throw new ApiError(401, 'Your session has expired. Please sign in again.'); }
    if (!ctx.userId) throw new ApiError(401, 'Your session has expired. Please sign in again.');
    me = db.users.find(function (u) { return u.id === ctx.userId; });
    if (!me || me.status === 'suspended') throw new ApiError(401, 'This account is not available.');
    if (ctx.tokenPv && ctx.tokenPv !== Auth.pwFingerprint(me.pw)) throw new ApiError(401, 'Your password was changed. Please sign in again.');
    if (opts.roles && opts.roles.indexOf(me.role) === -1) throw new ApiError(403, 'Your role (' + me.role + ') cannot perform this action.');
  }
  if (opts.write && sim.dbFail) throw new ApiError(500, 'Database error: the change was rolled back and nothing was saved. Please retry.');
  return { db: db, me: me };
}
const api = {};

  /* ----------------------------- shared lookups ------------------------- */
  function findProject(db, id) { var p = db.projects.find(function (x) { return x.id === id; }); if (!p) throw new ApiError(404, 'Project not found.'); return p; }
  function isMember(p, uid) { return p.members.indexOf(uid) !== -1; }
  function sharesProject(db, a, b) { return db.projects.some(function (p) { return isMember(p, a) && isMember(p, b); }); }
  /** Find a user record by id. @returns {object|undefined} */
  function userById(db, id) { return db.users.find(function (u) { return u.id === id; }); }
  /** Minimal public view of a user (id, name, role, initials, colour) used inside other records. */
  function mini(u) { return u ? { id: u.id, name: u.name, role: u.role, initials: initials(u.name), color: colorFor(u.id), headline: u.headline } : { id: '?', name: 'Unknown user', role: '', initials: '?', color: '#94a3b8' }; }
  /** Authorisation check: throw 403 unless `me` belongs to project `p` (NFR-001). @throws {ApiError} 403 */
  function requireMember(db, p, me) { if (!isMember(p, me.id)) throw new ApiError(403, 'You are not a member of this project, so its private content is not available to you.'); }
  /** Create an in-app notification, honouring the recipient's preferences (essential ones always go through, FR-034). */
  function notify(db, userId, n) {
    var prefs = (db.prefs && db.prefs[userId]) || {};
    var item = { id: nextId(db, 'NTF', 1000), userId: userId, category: n.category || 'projects', title: n.title, body: n.body || '', href: n.href || '', ts: now(), read: false, essential: !!n.essential };
    if (!R.shouldDeliverNotification(item, prefs, now())) return;
    db.notifications.unshift(item);
  }
  /** Append an administrator-visible audit entry (FR-038). @param {object} db @param {string} actor user id @param {string} action @param {string} target */
  function audit(db, actor, action, target) { db.audit.unshift({ id: nextId(db, 'AUD', 5000), ts: now(), actor: actor, action: action, target: target || '' }); }
  /** Append a line to a project's activity history (FR-031). */
  function activity(db, projectId, userId, text) { db.activity.unshift({ id: nextId(db, 'ACT', 1), projectId: projectId, userId: userId, text: text, ts: now() }); }
  /** Number of support and mentorship requests a user has made in the current period, excluding returned ones (FR-047). */
  function periodRequests(db, userId) {
    var sub = db.subscriptions[userId], from = sub ? sub.periodStart : 0;
    return db.mentorRequests.filter(function (r) { return r.studentId === userId && r.createdAt >= from; })
      .concat(db.supportRequests.filter(function (r) { return r.studentId === userId && r.createdAt >= from; }));
  }
  /** The plan a user is currently on; cancelled subscriptions fall back to the free plan. */
  function planOf(db, userId) { var sub = db.subscriptions[userId]; var id = sub && sub.status !== 'cancelled' ? sub.planId : 'free'; return PLANS.find(function (p) { return p.id === id; }); }
  /** Compute a student's plan allowance: `{plan, used, remaining, blocked}` (FR-045, FR-047). */
  function entitlement(db, user) {
    if (user.role !== 'student') return { allowance: Infinity, used: 0, remaining: Infinity, blocked: false, unlimited: true, plan: null };
    var plan = planOf(db, user.id), sum = R.allowanceSummary(plan, periodRequests(db, user.id));
    sum.plan = plan; return sum;
  }
  /** Throw 402 when a student has no request allowance left (FR-047). @throws {ApiError} 402 */
  function requireEntitlement(db, me) {
    var e = entitlement(db, me);
    if (e.blocked) {
      throw new ApiError(402, e.allowance === 0
        ? 'Your current plan (' + e.plan.name + ') does not include support or mentorship requests. Choose a plan to continue.'
        : 'You have used all ' + e.allowance + ' requests included in ' + e.plan.name + ' this period. Upgrade your plan or wait for renewal.', { reason: e.allowance === 0 ? 'no_plan' : 'exhausted' });
    }
    return e;
  }

  /** Profile as seen by `viewer` - private fields are removed server-side (FR-005, NFR-001). */
  function profileFor(db, u, viewerId) {
    var own = viewerId === u.id, shares = sharesProject(db, viewerId, u.id), hidden = [];
    var out = { id: u.id, role: u.role, name: u.name, headline: u.headline, initials: initials(u.name), color: colorFor(u.id), interests: u.interests, skills: u.skills, languages: u.languages, preferredRoles: u.preferredRoles, assistance: u.assistance, status: u.status, createdAt: u.createdAt, visibility: own ? u.visibility : undefined };
    ['institution', 'department', 'experience', 'availability', 'link'].forEach(function (f) {
      var level = (u.visibility.fields[f === 'department' ? 'institution' : f]) || 'public';
      if (R.canViewField(level, viewerId, u.id, shares)) out[f] = u[f]; else hidden.push(f);
    });
    if (own) out.email = u.email;
    if (u.mentor) out.mentor = u.mentor;
    if (u.researcher && (own || viewerId)) out.researcher = { approved: u.researcher.approved, designation: u.researcher.designation, expertise: u.researcher.expertise, active: u.researcher.active };
    out.hidden = hidden; out.sharesProject = shares;
    return out;
  }
  /** Copy of a user record with the password hash removed; the only form that may leave the server. */
  function publicUser(u) { var c = clone(u); delete c.pw; delete c.verify; return c; }
  /** Create a fresh 6-digit PIN for an unverified account and queue the e-mail (sent after the database commit). Throttled: 60 s between sends, 5 per hour. */
  function issuePin(ctx, u) {
    var t = now(), v = u.verify || {}, log = (v.sendLog || []).filter(function (x) { return t - x < 3600000; });
    if (v.sentAt && t - v.sentAt < Auth.PIN_RESEND_MS) throw new ApiError(429, 'Please wait a minute before asking for another code.', { retryAfter: Math.ceil((Auth.PIN_RESEND_MS - (t - v.sentAt)) / 1000) });
    if (log.length >= Auth.PIN_MAX_SENDS_PER_HOUR) throw new ApiError(429, 'Too many codes were requested. Try again in an hour.');
    var pin = Auth.newPin(); log.push(t);
    u.verify = { hash: Auth.pinHash(ctx.pinSecret, u.id, pin), exp: t + Auth.PIN_TTL_MS, tries: 0, sentAt: t, sendLog: log };
    ctx.outbox.push(Object.assign({ to: u.email }, Mailer.pinMessage(u.name, pin, Auth.PIN_TTL_MS / 60000)));
  }

  /* =======================================================================
     API
     ======================================================================= */

  /* ---- Auth (FR-001, FR-002) ----------------------------------------- */
  api.register = async function (ctx, d) {
    var g = guard(ctx, { auth: false, write: true }), db = g.db, errors = {};
    var n = V.validateName(d.name); if (!n.ok) errors.name = n.error;
    var e = V.validateEmail(d.email); if (!e.ok) errors.email = e.error;
    var p = V.validatePassword(d.password); if (!p.ok) errors.password = p.error;
    if (['student', 'researcher', 'mentor'].indexOf(d.role) === -1) errors.role = 'Choose how you will use the platform.';
    if (!d.consent) errors.consent = 'You must accept the privacy notice to register.';
    if (Object.keys(errors).length) throw new ApiError(400, 'Please fix the highlighted fields.', { fields: errors });
    // An account that never confirmed its email does not own the address: registering again replaces it (and sends a new PIN).
    var existing = db.users.find(function (u) { return u.email === e.value; });
    if (existing && !(ctx.verifyEmail && existing.emailVerified === false)) throw new ApiError(409, 'An account with this email already exists.', { fields: { email: 'This email is already registered. Try signing in.' } });
    var id = existing ? existing.id : nextId(db, 'USR', 100);
    var u = { id: id, email: e.value, pw: await Auth.hashPassword(d.password), role: d.role, status: d.role === 'researcher' ? 'active' : 'active', name: n.value, headline: '', institution: V.sanitizeText(d.institution || ''), department: '', interests: [], skills: [], experience: '', availability: { hours: 0, days: [], note: '' }, preferredRoles: [], languages: ['English'], assistance: [], link: '', visibility: { overall: 'listed', fields: { institution: 'public', experience: 'public', availability: 'public', link: 'team' } }, createdAt: now() };
    if (d.role === 'mentor') u.mentor = { expertise: [], qualifications: [], verification: 'pending', accepting: false };
    if (d.role === 'researcher') u.researcher = { approved: false, designation: '', expertise: [], active: true, base: 1200 };
    u.emailVerified = !ctx.verifyEmail;
    if (existing) { u.verify = existing.verify; Object.keys(existing).forEach(function (k) { delete existing[k]; }); Object.assign(existing, u); u = existing; } else db.users.push(u);
    notify(db, id, { category: 'account', essential: true, title: 'Welcome to RCMP', body: 'Complete your profile so collaborators can find you.', href: 'profile.html' });
    if (d.role === 'researcher') db.users.filter(function (x) { return x.role === 'admin'; }).forEach(function (a) { notify(db, a.id, { category: 'admin', essential: true, title: 'Researcher awaiting approval', body: u.name + ' registered as a researcher.', href: 'admin.html' }); }); if (!ctx.verifyEmail) { ctx.loginAs = id; ctx.loginPv = Auth.pwFingerprint(u.pw); }
    if (ctx.verifyEmail) { issuePin(ctx, u); return { pending: true, email: u.email, resendSeconds: Auth.PIN_RESEND_MS / 1000 }; }
    return publicUser(u);
  };
  /** Sign in (FR-002). Same 401 for unknown email and wrong password, so accounts cannot be enumerated (NFR-004). @returns {{token:string,user:object}} */
  api.login = async function (ctx, email, password) {
    var g = guard(ctx, { auth: false }), db = g.db;
    var u = db.users.find(function (x) { return x.email === lower(email).trim(); });
    // Same message and same work for unknown email and wrong password: no account enumeration (NFR-004).
    var ok = await Auth.verifyPassword(String(password || ''), u ? u.pw : null);
    if (!u || !ok) throw new ApiError(401, 'Incorrect email or password.');
    if (u.status === 'suspended') throw new ApiError(403, 'This account has been suspended. Contact an administrator.');
    if (ctx.verifyEmail && u.emailVerified === false) throw new ApiError(403, 'Confirm your email address first. Enter the 6-digit code we sent you.', { code: 'email_unverified', email: u.email });
    ctx.loginAs = u.id; ctx.loginPv = Auth.pwFingerprint(u.pw); return publicUser(u);
  };
  /**
   * Account recovery (FR-002). Always answers the same way whether or not the
   * email exists (no enumeration). There is no email service in this build, so
   * the one-time link is returned only when demo tools are enabled; in production
   * it would be emailed. The link is a signed token valid for 30 minutes and for
   * a single use (it carries a fingerprint of the current password hash).
   */
  api.forgotPassword = function (ctx, email) {
    var g = guard(ctx, { auth: false }), db = g.db, e = V.validateEmail(email);
    if (!e.ok) throw new ApiError(400, e.error, { fields: { email: e.error } });
    var u = db.users.find(function (x) { return x.email === lower(email).trim(); });
    var out = { ok: true, message: 'If that email belongs to an account, a reset link has been sent. It is valid for 30 minutes.' };
    if (u && u.status !== 'suspended' && ctx.issueReset) {
      var tok = ctx.issueReset(u);
      if (ctx.mailEnabled) ctx.outbox.push(Object.assign({ to: u.email }, Mailer.resetMessage(u.name, ctx.publicUrl + '/reset.html?token=' + encodeURIComponent(tok))));
      else out.resetToken = tok;
    }
    return out;
  };
  /**
   * Confirm an email address with the 6-digit PIN (valid 10 minutes, 5 wrong tries, then a new PIN is needed). Wrong tries are saved
   * even though the request fails (commit: true), so they cannot be undone by the rollback. Success signs the user in.
   */
  api.verifyEmail = function (ctx, email, pin) {
    var g = guard(ctx, { auth: false, write: true }), db = g.db, t = now();
    var u = db.users.find(function (x) { return x.email === lower(email).trim(); });
    var bad = function (m, extra) { return new ApiError(400, m, Object.assign({ fields: { pin: m } }, extra)); };
    if (!u || u.emailVerified !== false || !u.verify) throw bad('That code is not correct or has expired. Request a new one.');
    if (u.verify.tries >= Auth.PIN_MAX_TRIES) throw new ApiError(429, 'Too many wrong codes. Request a new code.', { fields: { pin: 'Too many wrong codes. Request a new code.' } });
    if (!/^\d{6}$/.test(String(pin || '').trim())) throw bad('Enter the 6-digit code from the email.');
    if (t > u.verify.exp) throw bad('That code has expired. Request a new one.');
    if (!Auth.pinMatches(ctx.pinSecret, u.id, String(pin).trim(), u.verify.hash)) {
      u.verify.tries += 1;
      throw bad('That code is not correct. ' + (Auth.PIN_MAX_TRIES - u.verify.tries) + ' attempt' + (Auth.PIN_MAX_TRIES - u.verify.tries === 1 ? '' : 's') + ' left.', { commit: true });
    }
    if (u.status === 'suspended') throw new ApiError(403, 'This account has been suspended. Contact an administrator.');
    u.emailVerified = true; delete u.verify;
    ctx.loginAs = u.id; ctx.loginPv = Auth.pwFingerprint(u.pw);
    return publicUser(u);
  };
  /** Send a new PIN. Always answers the same way, so it cannot be used to discover which emails have accounts. */
  api.resendPin = function (ctx, email) {
    var g = guard(ctx, { auth: false, write: true }), db = g.db;
    var u = db.users.find(function (x) { return x.email === lower(email).trim(); });
    if (u && u.emailVerified === false && u.status !== 'suspended') { try { issuePin(ctx, u); } catch (e) { if (e.status !== 429) throw e; } }
    return { ok: true, message: 'If that account is waiting for confirmation, a new code has been sent.', resendSeconds: Auth.PIN_RESEND_MS / 1000 };
  };
  /** Complete account recovery with a single-use, 30-minute signed token (FR-002). Sets a new password and revokes older sessions. @throws {ApiError} 400 weak password or bad/expired link */
  api.resetPassword = async function (ctx, token, password) {
    var g = guard(ctx, { auth: false, write: true }), db = g.db, claims = ctx.verifyReset && ctx.verifyReset(token);
    var bad = new ApiError(400, 'This reset link is invalid or has expired. Request a new one.', { fields: { token: 'Invalid or expired link.' } });
    if (!claims) throw bad;
    var u = db.users.find(function (x) { return x.id === claims.sub; });
    if (!u || u.status === 'suspended' || claims.pv !== Auth.pwFingerprint(u.pw)) throw bad;
    var pw = V.validatePassword(password); if (!pw.ok) throw new ApiError(400, pw.error, { fields: { password: pw.error } });
    u.pw = await Auth.hashPassword(password);
    notify(db, u.id, { category: 'account', essential: true, title: 'Password changed', body: 'Your password was changed. If this was not you, contact an administrator.', href: 'profile.html' });
    return { ok: true };
  };
  /**
   * Scout help assistant (no writes). Public: anyone may ask how the platform works.
   * A valid session only adds a personal sentence (plan allowance, pending requests); a bad or
   * expired token is simply treated as signed-out so help is always reachable.
   */
  api.assistant = function (ctx, message) {
    if (typeof message !== 'string' || !message.trim()) throw new ApiError(400, 'Type a question for Scout.', { fields: { message: 'Required.' } });
    if (message.length > 300) throw new ApiError(400, 'Please keep your question under 300 characters.', { fields: { message: 'Too long.' } });
    var who = null, db = ctx.db, me = ctx.userId ? db.users.find(function (u) { return u.id === ctx.userId && u.status !== 'suspended'; }) : null;
    if (me && (!ctx.tokenPv || ctx.tokenPv === Auth.pwFingerprint(me.pw))) {
      var e = entitlement(db, me), id = me.id;
      var pending = db.requests.filter(function (r) { return r.to === id && r.status === 'pending'; }).length;
      if (me.role === 'mentor') pending += db.mentorRequests.filter(function (r) { return r.mentorId === id && r.status === 'pending'; }).length;
      who = { name: me.name, role: me.role, pending: pending,
        unread: db.notifications.filter(function (n) { return n.userId === id && !n.read; }).length,
        projects: db.projects.filter(function (p) { return isMember(p, id); }).length };
      if (me.role === 'student' && e.plan) { who.plan = { name: e.plan.name, price: e.plan.price, allowance: e.plan.allowance }; who.used = e.used; who.remaining = e.remaining; }
    }
    return Assistant.answer(message, who);
  };
  /** The signed-in user's own record. @returns {object} */
  api.me = function (ctx) { var g = guard(ctx); return publicUser(g.me); };
  /** Lightweight counters for the sidebar / top bar badges. */
  api.summary = function (ctx) {
    var g = guard(ctx), db = g.db, id = g.me.id;
    var pending = db.requests.filter(function (r) { return r.to === id && r.status === 'pending'; }).length;
    if (g.me.role === 'mentor') pending += db.mentorRequests.filter(function (r) { return r.mentorId === id && r.status === 'pending'; }).length;
    return { unread: db.notifications.filter(function (n) { return n.userId === id && !n.read; }).length, pending: pending };
  };

  /* ---- Profiles (FR-003..006) ---------------------------------------- */
  api.getProfile = function (ctx, id) {
    var g = guard(ctx), u = userById(g.db, id || g.me.id);
    if (!u) throw new ApiError(404, 'Profile not found.');
    if (u.id !== g.me.id && (u.visibility.overall === 'unlisted' && !sharesProject(g.db, g.me.id, u.id) && g.me.role !== 'admin')) throw new ApiError(404, 'Profile not found.'); // hidden profiles are never revealed
    return profileFor(g.db, u, g.me.id);
  };
  /** Update the profile: validates and strips markup (NFR-004, NFR-007) and applies visibility settings (FR-005). @param {object} d profile fields */
  api.updateProfile = function (ctx, d) {
    var g = guard(ctx, { write: true }), db = g.db, u = userById(db, g.me.id);
    var v = V.validateProfile(d);
    if (!v.ok) throw new ApiError(400, 'Please fix the highlighted fields.', { fields: v.errors });
    ['name', 'headline', 'institution', 'department', 'experience', 'link'].forEach(function (k) { if (d[k] != null) u[k] = V.sanitizeText(d[k]); });
    ['interests', 'skills', 'languages', 'preferredRoles', 'assistance'].forEach(function (k) { if (d[k]) u[k] = d[k].map(V.sanitizeText).filter(Boolean); });
    if (d.availability) u.availability = { hours: Number(d.availability.hours) || 0, days: d.availability.days || [], note: V.sanitizeText(d.availability.note || '') };
    if (d.visibility) u.visibility = d.visibility;
    if (d.mentor && u.mentor) u.mentor = Object.assign(u.mentor, d.mentor);
    if (d.researcher && u.researcher) { u.researcher.expertise = d.researcher.expertise || u.researcher.expertise; } return profileFor(db, u, u.id);
  };
  /** Export everything held about the signed-in user as JSON (NFR-006). */
  api.exportMyData = function (ctx) { var g = guard(ctx), db = g.db, id = g.me.id; return { exportedAt: new Date().toISOString(), account: publicUser(g.me), projects: db.projects.filter(function (p) { return isMember(p, id); }).map(function (p) { return { id: p.id, title: p.title }; }), requests: db.requests.filter(function (r) { return r.from === id || r.to === id; }), notifications: db.notifications.filter(function (n) { return n.userId === id; }) }; };
  /** Delete the account: the user record, project memberships and notifications are removed and the action is audited (NFR-006). */
  api.deleteMyAccount = function (ctx) {
    var g = guard(ctx, { write: true }), db = g.db, id = g.me.id;
    db.users = db.users.filter(function (u) { return u.id !== id; });
    db.projects.forEach(function (p) { p.members = p.members.filter(function (m) { return m !== id; }); });
    db.notifications = db.notifications.filter(function (n) { return n.userId !== id; });
    audit(db, id, 'Account deleted by owner', id); return { ok: true };
  };

  /* ---- Discovery (FR-012, FR-013, NFR-015) ---------------------------- */
  var PAGE = 6;
  api.searchProjects = function (ctx, f, page) {
    var g = guard(ctx), db = g.db, me = g.me;
    // Private projects and non-open listings never appear in discovery (Table 7, F3).
    var list = db.projects.filter(function (p) { return p.status === 'open' && p.visibility !== 'private'; });
    var res = R.filterAndPage(list, { q: f.q, skills: f.skills, filters: [
      function (p) { return !f.subject || p.subject === f.subject; },
      function (p) { return !f.stage || p.stage === f.stage; },
      function (p) { return !f.role || p.roles.some(function (r) { return lower(r).indexOf(lower(f.role)) !== -1; }); },
      function (p) { return !f.maxHours || p.hoursPerWeek <= Number(f.maxHours); }
    ] }, page, PAGE, function (p) { return [p.title, p.subject, p.visibility === 'public' ? p.question : '', p.skills.join(' ')].join(' '); }, function (p) { return p.skills; });
    res.items = res.items.map(function (p) { return projectView(db, p, me.id); });
    return res;
  };
  /** Search people with filters, paginated; private fields and unlisted users are hidden (FR-012, FR-013, NFR-015). @param {object} f filters @param {number} page */
  api.searchPeople = function (ctx, f, page) {
    var g = guard(ctx), db = g.db, me = g.me;
    var list = db.users.filter(function (u) { return u.id !== me.id && u.role !== 'admin' && u.status === 'active' && u.visibility.overall === 'listed'; });
    var res = R.filterAndPage(list, { q: f.q, skills: f.skills, filters: [
      function (u) { return !f.role || u.role === f.role; },
      function (u) { return !f.language || u.languages.indexOf(f.language) !== -1; },
      function (u) { return !f.availability || (u.availability && u.availability.hours >= Number(f.availability)); },
      function (u) { return !f.interest || u.interests.some(function (i) { return lower(i).indexOf(lower(f.interest)) !== -1; }); }
    ] }, page, PAGE, function (u) { return [u.name, u.headline, u.interests.join(' '), u.skills.join(' ')].join(' '); }, function (u) { return u.skills; });
    res.items = res.items.map(function (u) { return profileFor(db, u, me.id); });
    return res;
  };

  /** Project as seen by `viewerId`: "summary" briefs hide the detail from non-members (FR-009). */
  function projectView(db, p, viewerId) {
    var member = isMember(p, viewerId), c = clone(p);
    c.owner = mini(userById(db, p.ownerId)); c.memberProfiles = p.members.map(function (id) { return mini(userById(db, id)); });
    c.isMember = member; c.isOwner = p.ownerId === viewerId;
    c.pendingRequest = db.requests.some(function (r) { return r.projectId === p.id && r.from === viewerId && r.type === 'interest' && r.status === 'pending'; });
    if (p.visibility === 'summary' && !member) { c.question = ''; c.objectives = []; c.locked = true; }
    return c;
  }

  /* ---- Projects (FR-007..011) ----------------------------------------- */
  api.myProjects = function (ctx) {
    var g = guard(ctx), db = g.db;
    return db.projects.filter(function (p) { return isMember(p, g.me.id); }).map(function (p) { var v = projectView(db, p, g.me.id); v.taskCount = db.tasks.filter(function (t) { return t.projectId === p.id; }).length; v.doneCount = db.tasks.filter(function (t) { return t.projectId === p.id && t.status === 'done'; }).length; return v; });
  };
  /** One project. Members see everything; others see only the summary of a public project and a 403 for a private one (FR-009). @throws {ApiError} 403, 404 */
  api.getProject = function (ctx, id) {
    var g = guard(ctx), db = g.db, p = findProject(db, id);
    if (p.visibility === 'private' && !isMember(p, g.me.id) && g.me.role !== 'admin') throw new ApiError(403, 'This project is private. Only invited members can open it.');
    if (p.status === 'draft' && p.ownerId !== g.me.id) throw new ApiError(404, 'Project not found.');
    var v = projectView(db, p, g.me.id);
    v.requests = p.ownerId === g.me.id ? db.requests.filter(function (r) { return r.projectId === id; }).map(function (r) { return requestView(db, r); }) : [];
    return v;
  };
  /**
   * Create or update a brief. publish=false keeps it as a draft; publish=true opens it.
   * UC-01: validate -> store in one transaction -> confirm. Nothing partial is stored.
   */
  api.saveProject = function (ctx, d, id, publish) {
    var g = guard(ctx, { write: true }), db = g.db, me = g.me;
    var v = V.validateProjectBrief(d);
    if (publish && !v.ok) throw new ApiError(400, 'Please fix the highlighted fields before publishing.', { fields: v.errors });
    if (!publish && (v.errors.title)) throw new ApiError(400, 'A draft needs at least a title.', { fields: { title: v.errors.title } });
    var p;
    if (id) { p = findProject(db, id); if (p.ownerId !== me.id) throw new ApiError(403, 'Only the project owner can edit this brief.'); }
    else { p = { id: nextId(db, 'PRJ', 1000), ownerId: me.id, members: [me.id], milestones: [], createdAt: now() }; db.projects.push(p); }
    p.title = V.sanitizeText(d.title); p.subject = V.sanitizeText(d.subject || ''); p.question = V.sanitizeText(d.question || '');
    p.objectives = (d.objectives || []).map(V.sanitizeText).filter(Boolean); p.skills = (d.skills || []).map(V.sanitizeText).filter(Boolean);
    p.methods = (d.methods || []).map(V.sanitizeText).filter(Boolean); p.roles = (d.roles || []).map(V.sanitizeText).filter(Boolean);
    p.stage = d.stage || 'idea'; p.hoursPerWeek = Number(d.hoursPerWeek) || 0; p.visibility = d.visibility || 'public';
    p.milestones = (d.milestones || []).filter(function (m) { return m.title; }).map(function (m) { return { id: m.id || nextId(db, 'MS', 1), title: V.sanitizeText(m.title), due: m.due || '', done: !!m.done }; });
    p.status = publish ? (p.status === 'paused' || p.status === 'closed' ? p.status : 'open') : (p.status && p.status !== 'draft' ? p.status : 'draft');
    p.updatedAt = now();
    activity(db, p.id, me.id, publish ? 'Published the project brief' : 'Saved the brief as a draft'); return projectView(db, p, me.id);
  };
  /** Owner sets a project open, paused or closed. Closing declines pending requests and cannot be undone (FR-010). @throws {ApiError} 409 */
  api.setProjectStatus = function (ctx, id, status) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, id);
    if (p.ownerId !== g.me.id) throw new ApiError(403, 'Only the project owner can change the listing.');
    if (['open', 'paused', 'closed'].indexOf(status) === -1) throw new ApiError(400, 'Unknown status.');
    if (p.status === 'closed' && status !== 'closed') throw new ApiError(409, 'A closed project cannot be reopened.');
    p.status = status; p.updatedAt = now();
    if (status === 'closed') db.requests.forEach(function (r) { if (r.projectId === id && r.status === 'pending') { r.status = 'declined'; r.history.push({ ts: now(), status: 'declined', by: 'system', note: 'Project closed' }); } });
    p.members.forEach(function (m) { if (m !== g.me.id) notify(db, m, { category: 'projects', title: 'Project ' + status, body: p.title + ' is now ' + status + '.', href: 'project.html?id=' + id }); });
    activity(db, id, g.me.id, 'Set the listing to ' + status); return projectView(db, p, g.me.id);
  };

  /* ---- Collaboration requests (FR-014..017, NFR-009) ------------------ */
  function requestView(db, r) {
    var c = clone(r), p = db.projects.find(function (x) { return x.id === r.projectId; });
    c.fromUser = mini(userById(db, r.from)); c.toUser = mini(userById(db, r.to)); c.projectTitle = p ? p.title : '(deleted project)'; c.projectStatus = p ? p.status : 'closed';
    return c;
  }
  /** A user asks to join a project (FR-014). One pending request per sender and project is enforced in the database too (FR-016). @throws {ApiError} 409 duplicate */
  api.sendInterest = function (ctx, projectId, message) {
    var g = guard(ctx, { write: true }), db = g.db, me = g.me, p = findProject(db, projectId);
    var m = V.validateMessage(message); if (!m.ok) throw new ApiError(400, m.error, { fields: { message: m.error } });
    if (p.visibility === 'private') throw new ApiError(403, 'This project is private.');
    if (p.status !== 'open') throw new ApiError(409, 'This project is ' + p.status + ' and is not accepting requests.');
    if (isMember(p, me.id)) throw new ApiError(409, 'You are already a member of this project.');
    if (db.requests.some(function (r) { return r.projectId === projectId && r.from === me.id && r.type === 'interest' && r.status === 'pending'; })) throw new ApiError(409, 'You already have a pending request for this project.');
    var r = { id: nextId(db, 'REQ', 980), type: 'interest', projectId: projectId, from: me.id, to: p.ownerId, message: m.value, status: 'pending', createdAt: now(), history: [{ ts: now(), status: 'pending', by: me.id }] };
    db.requests.unshift(r);
    notify(db, p.ownerId, { category: 'requests', title: 'New interest in ' + p.title, body: me.name + ' wants to join.', href: 'requests.html' }); return requestView(db, r);
  };
  /** The owner invites a user (FR-015). Rejects members and duplicates. @throws {ApiError} 403 not owner, 409 */
  api.sendInvitation = function (ctx, projectId, userId, message) {
    var g = guard(ctx, { write: true }), db = g.db, me = g.me, p = findProject(db, projectId), t = userById(db, userId);
    if (p.ownerId !== me.id) throw new ApiError(403, 'Only the project owner can invite collaborators.');
    if (!t || t.status !== 'active') throw new ApiError(404, 'That person could not be found.');
    var m = V.validateMessage(message); if (!m.ok) throw new ApiError(400, m.error, { fields: { message: m.error } });
    if (p.status !== 'open' && p.status !== 'draft') throw new ApiError(409, 'This project is ' + p.status + ' and cannot send invitations.');
    if (isMember(p, userId)) throw new ApiError(409, t.name + ' is already a member.');
    if (db.requests.some(function (r) { return r.projectId === projectId && r.to === userId && r.type === 'invitation' && r.status === 'pending'; })) throw new ApiError(409, 'An invitation to ' + t.name + ' is already pending.');
    var r = { id: nextId(db, 'REQ', 980), type: 'invitation', projectId: projectId, from: me.id, to: userId, message: m.value, status: 'pending', createdAt: now(), history: [{ ts: now(), status: 'pending', by: me.id }] };
    db.requests.unshift(r);
    notify(db, userId, { category: 'requests', title: 'Invitation to ' + p.title, body: me.name + ' invited you to collaborate.', href: 'requests.html' }); return requestView(db, r);
  };
  /** Requests sent and received by the signed-in user with their status history (FR-016). */
  api.listRequests = function (ctx) {
    var g = guard(ctx), db = g.db, id = g.me.id;
    var mine = db.requests.filter(function (r) { return r.from === id || r.to === id; });
    return { received: mine.filter(function (r) { return r.to === id; }).map(function (r) { return requestView(db, r); }), sent: mine.filter(function (r) { return r.from === id; }).map(function (r) { return requestView(db, r); }) };
  };
  /**
   * Accept / decline / withdraw. Implements the concurrency rule of UC-02:
   * exactly one final transition persists; the losing call gets HTTP 409.
   */
  api.actOnRequest = function (ctx, id, to) {
    var g = guard(ctx, { write: true }), db = g.db, me = g.me;
    var r = db.requests.find(function (x) { return x.id === id; });
    if (!r) throw new ApiError(404, 'Request not found.');
    if (!R.canActOnRequest(to, r, me.id)) throw new ApiError(403, 'You cannot ' + to.replace('ed', '').replace('withdrawn', 'withdraw') + ' this request.');
    var sim = ctx.sim || {};
    if (sim.conflictNext && r.status === 'pending') { // demo: the other party answered first
      ctx.consumed.push('conflictNext'); ctx.commitOnError = true;
      var rival = to === 'withdrawn' ? 'accepted' : 'withdrawn';
      r.status = rival; r.history.push({ ts: now(), status: rival, by: to === 'withdrawn' ? r.to : r.from }); }
    if (!R.canTransitionRequest(r.status, to)) throw new ApiError(409, 'This request was already ' + r.status + ' - your action was not applied. The first response stays in place.', { current: r.status });
    var p = db.projects.find(function (x) { return x.id === r.projectId; });
    if (to === 'accepted') {
      if (!p || p.status === 'closed') throw new ApiError(409, 'The project is closed, so the request cannot be accepted.');
      var joiner = r.type === 'interest' ? r.from : r.to;
      if (!isMember(p, joiner)) p.members.push(joiner);
      activity(db, p.id, me.id, userById(db, joiner).name + ' joined the project');
    }
    r.status = to; r.updatedAt = now(); r.history.push({ ts: now(), status: to, by: me.id });
    var other = r.from === me.id ? r.to : r.from;
    notify(db, other, { category: 'requests', title: 'Request ' + to, body: (p ? p.title : 'Project') + ' - ' + me.name + ' ' + to + ' the ' + r.type + '.', href: 'requests.html' }); return requestView(db, r);
  };

  /* ---- Team agreement (FR-023..026, UC-03) ---------------------------- */
  var AGREEMENT_TEMPLATE = { communication: 'Weekly 30-minute check-in; day-to-day updates in the project workspace. Reply to requests within 2 working days.', contributions: '', authorship: 'Authorship order is discussed before submission and follows the contribution to the work. Disagreements are raised with the owner first, then with an academic supervisor.', deadlines: [] };
  function agreementView(db, a, viewerId) {
    var p = findProject(db, a.projectId), c = clone(a), owner = p.ownerId === viewerId;
    c.isOwner = owner; c.members = p.members.map(function (id) { return mini(userById(db, id)); });
    c.proposals = c.proposals.map(function (x) { x.user = mini(userById(db, x.userId)); return x; });
    if (!owner) delete c.draft; // members see only the published text
    c.published = c.published || null; c.projectTitle = p.title;
    return c;
  }
  /** Current team agreement, created from the template on first view by a member (FR-023, FR-024). This GET writes, so app.js runs it in a write transaction. */
  api.getAgreement = function (ctx, projectId) {
    var g = guard(ctx), db = g.db, p = findProject(db, projectId);
    requireMember(db, p, g.me);
    var a = db.agreements.find(function (x) { return x.projectId === projectId; });
    if (!a) {
      if (p.ownerId !== g.me.id) return { exists: false, isOwner: false, projectTitle: p.title, owner: mini(userById(db, p.ownerId)) };
      a = { projectId: projectId, version: 0, published: null, draft: Object.assign(clone(AGREEMENT_TEMPLATE), { roles: p.members.map(function (m) { return { userId: m, role: m === p.ownerId ? 'Project owner / lead' : 'Team member', responsibilities: '' }; }) }), acks: {}, proposals: [], history: [] };
      db.agreements.push(a); }
    p.members.forEach(function (m) { if (a.draft && !a.draft.roles.some(function (r) { return r.userId === m; })) a.draft.roles.push({ userId: m, role: 'Team member', responsibilities: '' }); });
    return Object.assign({ exists: true }, agreementView(db, a, g.me.id));
  };
  /** Owner saves a draft or publishes a new version. Stale base version -> 409 (E3). */
  api.saveAgreement = function (ctx, projectId, draft, baseVersion, publish) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, projectId), me = g.me;
    requireMember(db, p, me);
    if (p.ownerId !== me.id) throw new ApiError(403, 'Only the project owner can edit or publish the agreement. Members can acknowledge it or propose a revision.');
    var a = db.agreements.find(function (x) { return x.projectId === projectId; });
    if (!a) throw new ApiError(404, 'Open the agreement page first so a template can be created.');
    if ((ctx.sim || {}).conflictNext) { ctx.consumed.push('conflictNext'); ctx.commitOnError = true; a.version += 1; a.history.push({ version: a.version, ts: now(), by: 'another session', summary: 'Edited in another browser tab' }); }
    if (a.version !== baseVersion) throw new ApiError(409, 'A newer version (v' + a.version + ') was saved while you were editing. Reload to see it before publishing - your draft text is kept on screen.', { currentVersion: a.version });
    if (publish) {
      if (!draft.contributions || V.sanitizeText(draft.contributions).length < 10) throw new ApiError(400, 'Describe expected contributions before publishing.', { fields: { contributions: 'Add a short description of expected contributions (at least 10 characters).' } });
      if (!(draft.deadlines || []).length) throw new ApiError(400, 'Add at least one deadline before publishing.', { fields: { deadlines: 'Add at least one deadline.' } });
    }
    a.draft = { roles: draft.roles, contributions: V.sanitizeText(draft.contributions || ''), communication: V.sanitizeText(draft.communication || ''), authorship: V.sanitizeText(draft.authorship || ''), deadlines: (draft.deadlines || []).filter(function (d) { return d.label; }).map(function (d) { return { id: d.id || nextId(db, 'DL', 1), label: V.sanitizeText(d.label), date: d.date }; }) };
    if (publish) {
      a.version += 1; a.published = clone(a.draft); a.publishedAt = now(); a.publishedBy = me.id; a.acks = {}; a.acks[me.id] = a.version;
      a.history.push({ version: a.version, ts: now(), by: me.id, summary: 'Published version ' + a.version });
      p.members.forEach(function (m) { if (m !== me.id) notify(db, m, { category: 'projects', title: 'Team agreement v' + a.version + ' published', body: 'Please read and acknowledge it for ' + p.title + '.', href: 'agreement.html?id=' + projectId }); });
      activity(db, projectId, me.id, 'Published team agreement v' + a.version);
    } return Object.assign({ exists: true }, agreementView(db, a, me.id));
  };
  /** A member acknowledges a specific agreement version (FR-025). @throws {ApiError} 409 if the version is stale */
  api.acknowledgeAgreement = function (ctx, projectId, version) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, projectId); requireMember(db, p, g.me);
    var a = db.agreements.find(function (x) { return x.projectId === projectId; });
    if (!a || !a.published) throw new ApiError(404, 'There is no published agreement yet.');
    if (a.version !== version) throw new ApiError(409, 'The agreement changed to v' + a.version + '. Reload and read the latest version.');
    a.acks[g.me.id] = version; activity(db, projectId, g.me.id, 'Acknowledged team agreement v' + version);
    notify(db, p.ownerId, { category: 'projects', title: 'Agreement acknowledged', body: g.me.name + ' acknowledged v' + version + '.', href: 'agreement.html?id=' + projectId }); return { ok: true };
  };
  /** A member proposes a change to one section; only the owner can resolve it (FR-025). */
  api.proposeRevision = function (ctx, projectId, section, text) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, projectId); requireMember(db, p, g.me);
    var t = V.sanitizeText(text); if (t.length < 10 || t.length > 500) throw new ApiError(400, 'Describe your proposed change in 10-500 characters.', { fields: { proposal: 'Describe your proposed change in 10-500 characters.' } });
    var a = db.agreements.find(function (x) { return x.projectId === projectId; });
    if (!a || !a.published) throw new ApiError(404, 'There is no published agreement to revise yet.');
    a.proposals.unshift({ id: nextId(db, 'PRP', 1), userId: g.me.id, section: section, text: t, status: 'open', createdAt: now(), version: a.version });
    notify(db, p.ownerId, { category: 'projects', title: 'Revision proposed', body: g.me.name + ' proposed a change to the ' + section + ' section.', href: 'agreement.html?id=' + projectId }); return { ok: true };
  };
  /** Owner accepts or rejects a proposal exactly once (FR-025). */
  api.resolveProposal = function (ctx, projectId, proposalId, decision) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, projectId);
    if (p.ownerId !== g.me.id) throw new ApiError(403, 'Only the project owner can resolve proposals.');
    var a = db.agreements.find(function (x) { return x.projectId === projectId; }), pr = a.proposals.find(function (x) { return x.id === proposalId; });
    if (!pr) throw new ApiError(404, 'Proposal not found.');
    if (pr.status !== 'open') throw new ApiError(409, 'This proposal was already ' + pr.status + '.');
    pr.status = decision; notify(db, pr.userId, { category: 'projects', title: 'Proposal ' + decision, body: 'Your proposed change to the team agreement was ' + decision + '.', href: 'agreement.html?id=' + projectId }); return { ok: true };
  };

  /* ---- Workspace: tasks, milestones, files (FR-027..032, FR-042..044) -- */
  function taskView(db, t) { var c = clone(t); c.assigneeUser = t.assignee ? mini(userById(db, t.assignee)) : null; return c; }
  api.getWorkspace = function (ctx, projectId) {
    var g = guard(ctx), db = g.db, p = findProject(db, projectId);
    requireMember(db, p, g.me); // 403 for non-members; no bytes, no metadata (NFR-001)
    return {
      project: projectView(db, p, g.me.id), me: mini(g.me),
      tasks: db.tasks.filter(function (t) { return t.projectId === projectId; }).map(function (t) { return taskView(db, t); }),
      files: db.files.filter(function (f) { return f.projectId === projectId; }).map(function (f) { var c = clone(f); c.uploaderUser = mini(userById(db, f.uploader)); return c; }),
      activity: db.activity.filter(function (a) { return a.projectId === projectId; }).slice(0, 25).map(function (a) { var c = clone(a); c.user = mini(userById(db, a.userId)); return c; }),
      mentorId: (p.members.find(function (m) { var u = userById(db, m); return u && u.role === 'mentor'; })) || null
    };
  };
  /** Create or update a task: title 3-20, description at most 250, at most 3 tags (FR-042..044). @param {number} [taskId] omit to create */
  api.saveTask = function (ctx, projectId, d, taskId) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, projectId); requireMember(db, p, g.me);
    var errors = {}, ti = V.validateTaskTitle(d.title), de = V.validateTaskDescription(d.description), tg = V.validateTags(d.tags);
    if (!ti.ok) errors.title = ti.error; if (!de.ok) errors.description = de.error; if (!tg.ok) errors.tags = tg.error;
    if (d.assignee && !isMember(p, d.assignee)) errors.assignee = 'Assignee must be a project member.';
    if (Object.keys(errors).length) throw new ApiError(400, 'Invalid task details. Nothing was saved.', { fields: errors });
    var t;
    if (taskId) { t = db.tasks.find(function (x) { return x.id === taskId && x.projectId === projectId; }); if (!t) throw new ApiError(404, 'Task not found.'); }
    else { t = { id: nextId(db, 'TSK', 100), projectId: projectId, createdBy: g.me.id, createdAt: now(), status: d.status || 'todo' }; db.tasks.push(t); }
    t.title = ti.value; t.description = de.value; t.tags = tg.value; t.due = d.due || ''; t.assignee = d.assignee || ''; t.updatedAt = now();
    if (d.status) t.status = d.status;
    activity(db, projectId, g.me.id, (taskId ? 'Updated task ' : 'Created task ') + t.id + ' "' + t.title + '"'); return taskView(db, t);
  };
  /** Move a task between board columns; members only, logged to the activity history (FR-028, FR-031). */
  api.moveTask = function (ctx, projectId, taskId, status) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, projectId); requireMember(db, p, g.me);
    if (['todo', 'progress', 'review', 'done'].indexOf(status) === -1) throw new ApiError(400, 'Unknown status.');
    var t = db.tasks.find(function (x) { return x.id === taskId && x.projectId === projectId; }); if (!t) throw new ApiError(404, 'Task not found.');
    var was = t.status; t.status = status; t.updatedAt = now();
    activity(db, projectId, g.me.id, 'Moved ' + t.id + ' from ' + was + ' to ' + status); return taskView(db, t);
  };
  /** Delete a task; members only, logged (FR-028). */
  api.deleteTask = function (ctx, projectId, taskId) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, projectId); requireMember(db, p, g.me);
    var t = db.tasks.find(function (x) { return x.id === taskId && x.projectId === projectId; }); if (!t) throw new ApiError(404, 'Task not found.');
    if (t.createdBy !== g.me.id && p.ownerId !== g.me.id) throw new ApiError(403, 'Only the task creator or the project owner can delete a task.');
    db.tasks = db.tasks.filter(function (x) { return x !== t; }); activity(db, projectId, g.me.id, 'Deleted task ' + t.id); return { ok: true };
  };
  /** Mark a milestone done or not done (FR-028). */
  api.toggleMilestone = function (ctx, projectId, msId) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, projectId); requireMember(db, p, g.me);
    var m = p.milestones.find(function (x) { return x.id === msId; }); if (!m) throw new ApiError(404, 'Milestone not found.');
    m.done = !m.done; activity(db, projectId, g.me.id, (m.done ? 'Completed' : 'Reopened') + ' milestone "' + m.title + '"'); return clone(m);
  };
  /** Add a dated milestone to a project (FR-028, FR-011). */
  api.addMilestone = function (ctx, projectId, title, due) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, projectId); requireMember(db, p, g.me);
    var t = V.sanitizeText(title); if (t.length < 3 || t.length > 60) throw new ApiError(400, 'Milestone title must be 3-60 characters.', { fields: { title: 'Milestone title must be 3-60 characters.' } });
    var m = { id: nextId(db, 'MS', 1), title: t, due: due || '', done: false }; p.milestones.push(m); activity(db, projectId, g.me.id, 'Added milestone "' + t + '"'); return m;
  };
  /**
   * File upload (UC-04): <=10 MB succeeds, 10.1 MB -> 413 with no file and no metadata,
   * storage failure -> 500 with no orphan metadata.
   */
  api.uploadFile = function (ctx, projectId, file, permission) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, projectId); requireMember(db, p, g.me);
    var v = V.validateFile({ name: file && file.name, size: file && file.size });
    if (!v.ok) throw new ApiError(v.status || 400, v.error);
    if ((ctx.sim || {}).storageFail) throw new ApiError(500, 'Encrypted storage failed. The file was not saved and no record was created - please retry.');
    var rec = { id: nextId(db, 'FIL', 1), projectId: projectId, name: v.value.name, size: v.value.size, ext: v.value.ext, uploader: g.me.id, permission: permission === 'owner' ? 'owner' : 'team', uploadedAt: now(), encrypted: false };
    if (file.bytes) {
      try { ctx.storage.put(rec.id, file.bytes); } catch (e) { throw new ApiError(500, 'Encrypted storage failed. The file was not saved and no record was created - please retry.'); }
      ctx.onRollback.push(function () { ctx.storage.remove(rec.id); }); // no orphan bytes if the database write fails
      rec.encrypted = true;
    }
    db.files.unshift(rec); activity(db, projectId, g.me.id, 'Uploaded ' + rec.name); return rec;
  };
  /** Metadata for one file after the membership and permission checks. */
  api.openFile = function (ctx, projectId, fileId) {
    var g = guard(ctx), db = g.db, p = findProject(db, projectId); requireMember(db, p, g.me);
    var f = db.files.find(function (x) { return x.id === fileId && x.projectId === projectId; }); if (!f) throw new ApiError(404, 'File not found.');
    if (f.permission === 'owner' && p.ownerId !== g.me.id) throw new ApiError(403, 'This file is restricted to the project owner.');
    return clone(f);
  };
  /** Decrypted bytes for download. Seed files have no bytes, so a short placeholder is returned. */
  api.readFile = function (ctx, projectId, fileId) {
    var f = api.openFile(ctx, projectId, fileId), bytes = f.encrypted ? ctx.storage.get(f.id) : null;
    if (f.encrypted && !bytes) throw new ApiError(500, 'The stored file could not be decrypted.');
    return { file: f, bytes: bytes || Buffer.from('RCMP demo placeholder for ' + f.name + ' (' + f.size + ' bytes). Seed files carry metadata only.\n') };
  };
  /** Delete a file and its encrypted bytes; the uploader or the owner only (FR-029). */
  api.deleteFile = function (ctx, projectId, fileId) {
    var g = guard(ctx, { write: true }), db = g.db, p = findProject(db, projectId); requireMember(db, p, g.me);
    var f = db.files.find(function (x) { return x.id === fileId && x.projectId === projectId; }); if (!f) throw new ApiError(404, 'File not found.');
    if (f.uploader !== g.me.id && p.ownerId !== g.me.id) throw new ApiError(403, 'Only the uploader or the project owner can delete this file.');
    db.files = db.files.filter(function (x) { return x !== f; }); if (f.encrypted) ctx.storage.remove(f.id); activity(db, projectId, g.me.id, 'Deleted file ' + f.name); return { ok: true };
  };

  /* ---- Mentorship (FR-018..022, UC-05) -------------------------------- */
  function mentorRequestView(db, r) { var c = clone(r); c.student = mini(userById(db, r.studentId)); c.mentor = mini(userById(db, r.mentorId)); var p = r.projectId && db.projects.find(function (x) { return x.id === r.projectId; }); c.projectTitle = p ? p.title : ''; return c; }
  api.searchMentors = function (ctx, f, page) {
    var g = guard(ctx), db = g.db, me = g.me;
    var list = db.users.filter(function (u) { return u.role === 'mentor' && u.status === 'active' && u.visibility.overall === 'listed' && u.id !== me.id; });
    var res = R.filterAndPage(list, { q: f.q, filters: [
      function (u) { return !f.topic || (u.mentor.expertise || []).indexOf(f.topic) !== -1; },
      function (u) { return !f.verifiedOnly || u.mentor.verification === 'verified'; },
      function (u) { return !f.acceptingOnly || u.mentor.accepting; }
    ] }, page, 6, function (u) { return [u.name, u.headline, u.institution, (u.mentor.expertise || []).join(' '), u.interests.join(' ')].join(' '); }, function () { return []; });
    res.items = res.items.map(function (u) { return profileFor(db, u, me.id); });
    res.entitlement = entitlement(db, me); return res;
  };
  /** Ask a mentor for guidance with goals and stage (FR-020). Free-plan students get 402; duplicates get 409. */
  api.requestMentorship = function (ctx, d) {
    var g = guard(ctx, { write: true, roles: ['student', 'researcher'] }), db = g.db, me = g.me;
    var v = V.validateMentorshipRequest(d); if (!v.ok) throw new ApiError(400, 'Please complete the highlighted fields. Nothing was sent.', { fields: v.errors });
    var mentor = userById(db, d.mentorId);
    if (!mentor || mentor.role !== 'mentor') throw new ApiError(404, 'Mentor not found.');
    if (!mentor.mentor.accepting) throw new ApiError(409, mentor.name + ' is not accepting new requests right now. Try another mentor with a similar topic.', { suggest: true });
    if (db.mentorRequests.some(function (r) { return r.studentId === me.id && r.mentorId === mentor.id && ['pending', 'clarify', 'accepted'].indexOf(r.status) !== -1; })) throw new ApiError(409, 'You already have an open request with ' + mentor.name + '.');
    requireEntitlement(db, me); // E5: blocked with an explanation when the plan does not permit it
    var r = { id: nextId(db, 'MEN', 200), studentId: me.id, mentorId: mentor.id, topic: d.topic, goals: V.sanitizeText(d.goals), stage: d.stage, guidance: V.sanitizeText(d.guidance), projectId: d.projectId || '', status: 'pending', createdAt: now(), note: '' };
    db.mentorRequests.unshift(r);
    notify(db, mentor.id, { category: 'mentorship', title: 'New mentorship request', body: me.name + ' asked for help with ' + d.topic + '.', href: 'mentors.html?tab=inbox' }); return mentorRequestView(db, r);
  };
  /** Mentorship requests visible to the user: sent (student) or received (mentor). */
  api.listMentorRequests = function (ctx) {
    var g = guard(ctx), db = g.db, me = g.me;
    var list = me.role === 'mentor' ? db.mentorRequests.filter(function (r) { return r.mentorId === me.id; }) : db.mentorRequests.filter(function (r) { return r.studentId === me.id; });
    return { items: list.map(function (r) { return mentorRequestView(db, r); }), entitlement: entitlement(db, me) };
  };
  /** Mentor accepts, declines or asks for clarification (FR-021). Only the addressed mentor may act. */
  api.actOnMentorRequest = function (ctx, id, action, note) {
    var g = guard(ctx, { write: true, roles: ['mentor'] }), db = g.db, me = g.me;
    var r = db.mentorRequests.find(function (x) { return x.id === id && x.mentorId === me.id; }); if (!r) throw new ApiError(404, 'Request not found.');
    var map = { accept: 'accepted', decline: 'declined', clarify: 'clarify', complete: 'completed' };
    if (!map[action]) throw new ApiError(400, 'Unknown action.');
    if (['declined', 'completed'].indexOf(r.status) !== -1) throw new ApiError(409, 'This request is already ' + r.status + '.');
    r.status = map[action]; r.note = V.sanitizeText(note || ''); r.updatedAt = now();
    notify(db, r.studentId, { category: 'mentorship', title: 'Mentorship request ' + r.status, body: me.name + (r.status === 'clarify' ? ' asked a clarifying question: ' + r.note : ' ' + r.status + ' your request.'), href: 'mentors.html' }); return mentorRequestView(db, r);
  };
  /** Mentor switches availability for new requests on or off (FR-021). */
  api.toggleAccepting = function (ctx, accepting) {
    var g = guard(ctx, { write: true, roles: ['mentor'] }), db = g.db, u = userById(db, g.me.id); u.mentor.accepting = !!accepting; return u.mentor;
  };

  /* ---- Support requests handled by researchers (UC-07, FR-048..052) --- */
  function supportView(db, r) { var c = clone(r); c.student = mini(userById(db, r.studentId)); c.researcher = r.researcherId ? mini(userById(db, r.researcherId)) : null; var p = r.projectId && db.projects.find(function (x) { return x.id === r.projectId; }); c.projectTitle = p ? p.title : ''; return c; }
  /** Match an eligible researcher by expertise, availability and lowest open workload (FR-050). */
  function matchResearcher(db, category) {
    var cands = db.users.filter(function (u) { return u.role === 'researcher' && u.researcher && u.researcher.approved && u.researcher.active && (u.researcher.expertise || []).some(function (e) { return lower(e) === lower(category); }); });
    cands.sort(function (a, b) { return load2(db, a.id) - load2(db, b.id); });
    return cands[0] || null;
  }
  /** Open support workload of a researcher; used to pick the least-loaded eligible researcher (FR-050). */
  function load2(db, id) { return db.supportRequests.filter(function (r) { return r.researcherId === id && ['assigned', 'in_progress', 'reopened'].indexOf(r.status) !== -1; }).length; }
  /** Student submits a support request; entitlement is checked first and an eligible researcher is assigned automatically (FR-047, FR-050). */
  api.createSupport = function (ctx, d) {
    var g = guard(ctx, { write: true, roles: ['student'] }), db = g.db, me = g.me, errors = {};
    if (SUPPORT_CATEGORIES.indexOf(d.category) === -1) errors.category = 'Choose a support category.';
    var desc = V.sanitizeText(d.description); if (desc.length < 20) errors.description = 'Describe what you need in at least 20 characters.'; if (desc.length > 800) errors.description = 'Description must be 800 characters or fewer.';
    if (Object.keys(errors).length) throw new ApiError(400, 'Please fix the highlighted fields. Nothing was sent.', { fields: errors });
    requireEntitlement(db, me);
    var m = matchResearcher(db, d.category);
    var r = { id: nextId(db, 'SUP', 300), studentId: me.id, category: d.category, description: desc, projectId: d.projectId || '', status: m ? 'assigned' : 'pending', researcherId: m ? m.id : '', createdAt: now(), feedback: null, log: [{ ts: now(), text: m ? 'Matched to ' + m.name + ' (expertise, availability, lowest workload)' : 'No suitable researcher available - request kept pending' }] };
    db.supportRequests.unshift(r);
    if (m) notify(db, m.id, { category: 'support', title: 'Support request assigned', body: d.category + ' for ' + me.name + '.', href: 'support.html' }); return supportView(db, r);
  };
  /** Support requests scoped by role: students see their own, researchers their assigned ones, admins all (FR-048). */
  api.listSupport = function (ctx) {
    var g = guard(ctx), db = g.db, me = g.me, list;
    if (me.role === 'student') list = db.supportRequests.filter(function (r) { return r.studentId === me.id; });
    else if (me.role === 'researcher') list = db.supportRequests.filter(function (r) { return r.researcherId === me.id; });
    else if (me.role === 'admin') list = db.supportRequests; else throw new ApiError(403, 'Support requests are available to students, researchers and administrators.');
    return { items: list.map(function (r) { return supportView(db, r); }), entitlement: entitlement(db, me), categories: SUPPORT_CATEGORIES };
  };
  /** Researcher moves a support request along its lifecycle (assigned, in progress, completed, reopened) (FR-051). */
  api.updateSupport = function (ctx, id, action, text) {
    var g = guard(ctx, { write: true }), db = g.db, me = g.me;
    var r = db.supportRequests.find(function (x) { return x.id === id; }); if (!r) throw new ApiError(404, 'Request not found.');
    if (action === 'start' || action === 'complete') {
      if (me.id !== r.researcherId) throw new ApiError(403, 'Only the assigned researcher can update this request.');
      if (action === 'start' && r.status !== 'assigned' && r.status !== 'reopened') throw new ApiError(409, 'This request is already ' + r.status + '.');
      if (action === 'complete' && ['in_progress', 'assigned', 'reopened'].indexOf(r.status) === -1) throw new ApiError(409, 'This request is already ' + r.status + '.');
      r.status = action === 'start' ? 'in_progress' : 'completed'; if (action === 'complete') r.completedAt = now();
      r.log.push({ ts: now(), text: action === 'start' ? 'Researcher started work' : 'Marked completed' + (text ? ': ' + V.sanitizeText(text) : '') });
      notify(db, r.studentId, { category: 'support', title: action === 'complete' ? 'Support request completed' : 'Support work started', body: action === 'complete' ? 'Please rate the support you received.' : 'Your researcher has started.', href: 'support.html' });
    } else if (action === 'reopen') {
      if (me.id !== r.studentId) throw new ApiError(403, 'Only the student can re-open a request.');
      if (r.status !== 'completed') throw new ApiError(409, 'Only a completed request can be re-opened.');
      var reason = V.sanitizeText(text); if (reason.length < 10) throw new ApiError(400, 'Explain why you are re-opening this request (10+ characters).', { fields: { reason: 'Explain why (10+ characters).' } });
      r.status = 'reopened'; r.completedAt = null; r.log.push({ ts: now(), text: 'Student re-opened / disputed: ' + reason });
      notify(db, r.researcherId, { category: 'support', title: 'Request re-opened', body: reason, href: 'support.html' });
    } else throw new ApiError(400, 'Unknown action.'); return supportView(db, r);
  };
  /** Student rates a completed request; the rating feeds the researcher's bonus (FR-052). */
  api.feedbackSupport = function (ctx, id, rating, comment) {
    var g = guard(ctx, { write: true, roles: ['student'] }), db = g.db;
    var r = db.supportRequests.find(function (x) { return x.id === id && x.studentId === g.me.id; }); if (!r) throw new ApiError(404, 'Request not found.');
    if (r.status !== 'completed') throw new ApiError(409, 'You can leave feedback once the request is completed.');
    if (r.feedback) throw new ApiError(409, 'Feedback was already submitted for this request.');
    var f = V.validateFeedback(rating, comment); if (!f.ok) throw new ApiError(400, f.error, { fields: { rating: f.error } });
    r.feedback = f.value; r.log.push({ ts: now(), text: 'Student feedback: ' + f.value.rating + '/5' }); return supportView(db, r);
  };

  /* ---- Subscriptions (FR-045..047, UC-06) ----------------------------- */
  api.getSubscription = function (ctx) {
    var g = guard(ctx, { roles: ['student'] }), db = g.db, id = g.me.id;
    var sub = db.subscriptions[id] || null;
    return { plans: PLANS, subscription: sub ? clone(sub) : null, plan: planOf(db, id), usage: entitlement(db, g.me), billing: db.billing.filter(function (b) { return b.userId === id; }).sort(function (a, b) { return b.ts - a.ts; }) };
  };
  /**
   * The payment provider is external: the front end never sees card data.
   * `outcome` is chosen on the sandbox provider screen (success | failed | pending).
   * Entitlement changes ONLY on a confirmed success (UC-06 E2).
   */
  api.subscribe = function (ctx, planId, outcome) {
    var g = guard(ctx, { write: true, roles: ['student'] }), db = g.db, id = g.me.id;
    var plan = PLANS.find(function (p) { return p.id === planId; });
    if (!plan) throw new ApiError(400, 'That plan is not available.');
    var cur = db.subscriptions[id];
    if (cur && cur.planId === planId && cur.status === 'active') throw new ApiError(409, 'You are already on ' + plan.name + '.');
    var ev = { id: nextId(db, 'BIL', 700), userId: id, ts: now(), type: plan.price ? 'charge' : 'plan_change', planId: planId, amount: plan.price, status: outcome === 'success' ? 'succeeded' : outcome === 'pending' ? 'pending' : 'failed', ref: 'PSP-' + Math.random().toString(36).slice(2, 8).toUpperCase() };
    db.billing.unshift(ev);
    if (plan.price === 0 || outcome === 'success') {
      ev.status = 'succeeded';
      db.subscriptions[id] = { planId: planId, status: 'active', periodStart: cur ? cur.periodStart : now(), periodEnd: cur ? cur.periodEnd : now() + 30 * D, cancelAtEnd: false };
      notify(db, id, { category: 'billing', essential: true, title: 'Subscription active', body: 'You are now on ' + plan.name + '.', href: 'subscription.html' });
    } else if (outcome === 'failed') {
      notify(db, id, { category: 'billing', essential: true, title: 'Payment failed', body: 'No changes were made to your plan.', href: 'subscription.html' });
    } return { status: ev.status, event: ev, plan: plan };
  };
  /** Settle a pending sandbox payment as successful, which grants the plan; failed and pending payments never grant it (UC-06, FR-046). */
  api.settlePending = function (ctx, eventId) {
    var g = guard(ctx, { write: true, roles: ['student'] }), db = g.db, ev = db.billing.find(function (b) { return b.id === eventId && b.userId === g.me.id; });
    if (!ev) throw new ApiError(404, 'Payment not found.'); if (ev.status !== 'pending') throw new ApiError(409, 'This payment is already ' + ev.status + '.');
    ev.status = 'succeeded'; var cur = db.subscriptions[g.me.id];
    db.subscriptions[g.me.id] = { planId: ev.planId, status: 'active', periodStart: cur ? cur.periodStart : now(), periodEnd: cur ? cur.periodEnd : now() + 30 * D, cancelAtEnd: false }; return { ok: true };
  };
  /** Cancel at the end of the current period; the plan stays active until then (FR-046). */
  api.cancelSubscription = function (ctx) {
    var g = guard(ctx, { write: true, roles: ['student'] }), db = g.db, s = db.subscriptions[g.me.id];
    if (!s || s.status !== 'active') throw new ApiError(409, 'There is no active subscription to cancel.');
    s.cancelAtEnd = true; db.billing.unshift({ id: nextId(db, 'BIL', 700), userId: g.me.id, ts: now(), type: 'cancellation', planId: s.planId, amount: 0, status: 'succeeded', ref: 'n/a' }); return clone(s);
  };

  /* ---- Researcher compensation (FR-052..056, UC-08) -------------------- */
  function statementView(db, s) {
    var u = userById(db, s.researcherId), calc = R.calcCompensation({ base: s.base, completed: s.completed, target: s.target, feedback: s.feedback, active: s.active }, db.compConfig);
    var adj = Number(s.adjustment) || 0, c = clone(s);
    c.researcher = mini(u); c.calc = calc; c.total = Math.round((calc.total + adj) * 100) / 100; c.adjustment = adj;
    c.canApprove = s.status === 'awaiting_approval' && (!calc.needsReview || !!s.exception);
    return c;
  }
  /** Researchers see only their own compensation statements; admins see all (NFR-001, FR-055). */
  api.listStatements = function (ctx) {
    var g = guard(ctx, { roles: ['researcher', 'admin'] }), db = g.db, me = g.me;
    var list = me.role === 'admin' ? db.statements : db.statements.filter(function (s) { return s.researcherId === me.id; });
    return { items: list.map(function (s) { return statementView(db, s); }).sort(function (a, b) { return a.period < b.period ? 1 : -1; }), config: db.compConfig };
  };
  /** Admin drives a statement through submit, exception, approve, return, adjust and payout; payout needs approval, a failed payout is recorded and never shown as paid, and a paid statement is final (FR-053..056). */
  api.actOnStatement = function (ctx, id, action, payload) {
    var g = guard(ctx, { write: true, roles: ['admin'] }), db = g.db, s = db.statements.find(function (x) { return x.id === id; });
    if (!s) throw new ApiError(404, 'Statement not found.');
    var v = statementView(db, s);
    /** Validate and apply a statement state change. @throws {ApiError} 409 when the transition is not allowed */
    function move(to) { if (!R.canTransitionStatement(s.status, to)) throw new ApiError(409, 'A statement that is "' + s.status.replace('_', ' ') + '" cannot move to "' + to.replace('_', ' ') + '".'); s.status = to; s.history.push({ ts: now(), status: to, by: g.me.id }); }
    if (action === 'submit') { move('awaiting_approval'); audit(db, g.me.id, 'Submitted statement for approval', id); }
    else if (action === 'exception') {
      var note = V.sanitizeText(payload && payload.note); if (note.length < 10) throw new ApiError(400, 'Record the reason for the approved exception (10+ characters).');
      s.exception = note; audit(db, g.me.id, 'Approved exception: ' + note, id);
    } else if (action === 'approve') {
      if (v.calc.needsReview && !s.exception) throw new ApiError(409, 'This statement is flagged for review (' + v.calc.flags[0] + '). Resolve the flag or record an approved exception first.');
      move('approved'); audit(db, g.me.id, 'Approved statement - total GBP ' + v.total.toFixed(2), id);
      notify(db, s.researcherId, { category: 'billing', essential: true, title: 'Compensation statement approved', body: 'Statement ' + id + ' for ' + s.period + ' was approved.', href: 'compensation.html' });
    } else if (action === 'return') { move('draft'); audit(db, g.me.id, 'Returned statement to draft', id); }
    else if (action === 'payout') {
      if (s.status === 'paid') throw new ApiError(409, 'This statement is already paid - duplicate payout prevented.');
      var ok = (payload && payload.outcome) !== 'failed';
      s.payoutRef = 'PAY-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      move(ok ? 'paid' : 'payout_failed'); // "paid" is never shown without confirmation (TC-COMP-03)
      audit(db, g.me.id, ok ? 'Payout confirmed ' + s.payoutRef : 'Payout FAILED ' + s.payoutRef + ' - needs reconciliation', id);
      notify(db, s.researcherId, { category: 'billing', essential: true, title: ok ? 'Payout sent' : 'Payout failed', body: ok ? 'Statement ' + id + ' was paid.' : 'The provider reported a failure; the team is reconciling.', href: 'compensation.html' });
    } else if (action === 'adjust') {
      var amt = Number(payload && payload.amount), n2 = V.sanitizeText(payload && payload.note);
      if (isNaN(amt) || Math.abs(amt) > 500) throw new ApiError(400, 'Adjustment must be a number between -500 and 500.');
      if (n2.length < 5) throw new ApiError(400, 'Add a reason for the adjustment.');
      if (s.status === 'paid') throw new ApiError(409, 'Paid statements cannot be adjusted. Enter a correction in the next period.');
      s.adjustment = amt; audit(db, g.me.id, 'Adjustment GBP ' + amt.toFixed(2) + ': ' + n2, id);
    } else throw new ApiError(400, 'Unknown action.'); return statementView(db, s);
  };

  /* ---- Admin (FR-036..038, FR-049) ------------------------------------ */
  api.adminOverview = function (ctx) {
    var g = guard(ctx, { roles: ['admin'] }), db = g.db;
    return {
      users: db.users.length, projects: db.projects.filter(function (p) { return p.status === 'open'; }).length,
      pendingResearchers: db.users.filter(function (u) { return u.role === 'researcher' && u.researcher && !u.researcher.approved; }).length,
      openReports: db.reports.filter(function (r) { return r.status === 'open'; }).length,
      newMessages: db.contactMessages.filter(function (m) { return m.status === 'new'; }).length,
      awaitingApproval: db.statements.filter(function (s) { return s.status === 'awaiting_approval'; }).length,
      payoutFailed: db.statements.filter(function (s) { return s.status === 'payout_failed'; }).length,
      unassigned: db.supportRequests.filter(function (r) { return r.status === 'pending'; }).length
    };
  };
  /** Administrator list of researchers awaiting or holding approval (FR-049). */
  api.listResearchers = function (ctx) { var g = guard(ctx, { roles: ['admin'] }); return g.db.users.filter(function (u) { return u.role === 'researcher'; }).map(function (u) { var c = mini(u); c.researcher = clone(u.researcher); c.email = u.email; c.institution = u.institution; c.open = load2(g.db, u.id); return c; }); };
  /** Administrator approves a researcher, sets active status, designation and expertise; audited and notified on approval (FR-049, FR-038). */
  api.updateResearcher = function (ctx, id, patch) {
    var g = guard(ctx, { write: true, roles: ['admin'] }), db = g.db, u = userById(db, id);
    if (!u || !u.researcher) throw new ApiError(404, 'Researcher not found.');
    ['approved', 'active', 'designation'].forEach(function (k) { if (patch[k] != null) u.researcher[k] = patch[k]; });
    if (patch.expertise) u.researcher.expertise = patch.expertise;
    audit(db, g.me.id, 'Updated researcher: ' + JSON.stringify(patch), id);
    if (patch.approved === true) notify(db, id, { category: 'account', essential: true, title: 'Researcher account approved', body: 'You can now receive student support requests.', href: 'support.html' }); return clone(u.researcher);
  };
  /** Any signed-in user reports a user or project with a reason (FR-036). */
  api.reportContent = function (ctx, d) {
    var g = guard(ctx, { write: true }), db = g.db, reason = V.sanitizeText(d.reason), details = V.sanitizeText(d.details || '');
    if (!reason) throw new ApiError(400, 'Choose a reason for the report.', { fields: { reason: 'Choose a reason.' } });
    if (details.length > 400) throw new ApiError(400, 'Details must be 400 characters or fewer.', { fields: { details: 'Details must be 400 characters or fewer.' } });
    var r = { id: nextId(db, 'RPT', 50), reporterId: g.me.id, targetType: d.targetType, targetId: d.targetId, targetName: V.sanitizeText(d.targetName || ''), reason: reason, details: details, status: 'open', outcome: '', createdAt: now() };
    db.reports.unshift(r);
    db.users.filter(function (u) { return u.role === 'admin'; }).forEach(function (a) { notify(db, a.id, { category: 'admin', essential: true, title: 'New report: ' + reason, body: r.targetName, href: 'admin.html' }); }); return { ok: true, id: r.id };
  };
  /**
   * Public contact form: anyone may send the team a message (no account needed).
   * Validated like every other input, a hidden "website" field catches simple bots,
   * and every administrator is notified. Stored in contact_messages.
   */
  api.sendContact = function (ctx, d) {
    var g = guard(ctx, { auth: false, write: true }), db = g.db; d = d || {};
    var name = V.validateName(d.name), email = V.validateEmail(d.email), topic = String(d.topic || ''), subject = V.sanitizeText(d.subject || ''), message = V.sanitizeText(d.message || ''), fields = {};
    if (!name.ok) fields.name = name.error; if (!email.ok) fields.email = email.error;
    if (CONTACT_TOPICS.indexOf(topic) === -1) fields.topic = 'Choose what your message is about.';
    if (subject.length < 3 || subject.length > 100) fields.subject = 'Subject must be 3 to 100 characters.';
    if (message.length < 10 || message.length > 1000) fields.message = 'Message must be 10 to 1000 characters.';
    if (Object.keys(fields).length) throw new ApiError(400, 'Please correct the highlighted fields.', { fields: fields });
    if (d.website) return { ok: true, id: 'MSG-0' }; // honeypot: pretend success, store nothing
    var m = { id: nextId(db, 'MSG', 500), name: name.value, email: email.value, topic: topic, subject: subject, message: message, status: 'new', createdAt: now() };
    db.contactMessages.unshift(m);
    db.users.filter(function (u) { return u.role === 'admin'; }).forEach(function (a) { notify(db, a.id, { category: 'admin', essential: true, title: 'New contact message: ' + subject, body: name.value + ' (' + topic + ')', href: 'admin.html' }); });
    return { ok: true, id: m.id };
  };
  /** Administrator inbox of contact messages, newest first. */
  api.listContact = function (ctx) { var g = guard(ctx, { roles: ['admin'] }); return g.db.contactMessages.map(clone); };
  /** Administrator marks a message read or answered. */
  api.setContactStatus = function (ctx, id, status) {
    var g = guard(ctx, { write: true, roles: ['admin'] }), db = g.db, m = db.contactMessages.find(function (x) { return x.id === id; });
    if (!m) throw new ApiError(404, 'Message not found.'); if (['read', 'answered', 'new'].indexOf(status) === -1) throw new ApiError(400, 'Unknown status.');
    m.status = status; audit(db, g.me.id, 'Contact message ' + id + ' marked ' + status, id); return clone(m);
  };
  /** Administrator view of reports with their targets (FR-036). */
  api.listReports = function (ctx) { var g = guard(ctx, { roles: ['admin'] }), db = g.db; return db.reports.map(function (r) { var c = clone(r); c.reporter = mini(userById(db, r.reporterId)); return c; }); };
  /** Administrator dismisses, warns or suspends once per report; suspending a user signs them out (FR-036, FR-038). */
  api.actOnReport = function (ctx, id, action) {
    var g = guard(ctx, { write: true, roles: ['admin'] }), db = g.db, r = db.reports.find(function (x) { return x.id === id; });
    if (!r) throw new ApiError(404, 'Report not found.'); if (r.status !== 'open') throw new ApiError(409, 'This report was already ' + r.status + '.');
    if (action === 'dismiss') { r.status = 'dismissed'; r.outcome = 'No policy breach found'; }
    else if (action === 'warn') { r.status = 'actioned'; r.outcome = 'Warning issued to the account holder'; if (r.targetType === 'user') notify(db, r.targetId, { category: 'account', essential: true, title: 'Community guidelines warning', body: 'A report about your account was reviewed. Please follow the platform policy.', href: 'privacy.html' }); }
    else if (action === 'suspend') { r.status = 'actioned'; r.outcome = 'Account suspended'; var u = userById(db, r.targetType === 'user' ? r.targetId : (db.projects.find(function (p) { return p.id === r.targetId; }) || {}).ownerId); if (u && u.role !== 'admin') u.status = 'suspended'; }
    else throw new ApiError(400, 'Unknown action.');
    audit(db, g.me.id, 'Report ' + action + ' (' + r.reason + ')', id); return clone(r);
  };
  /** Newest administrator audit entries (FR-038). */
  api.listAudit = function (ctx) { var g = guard(ctx, { roles: ['admin'] }), db = g.db; return db.audit.slice(0, 60).map(function (a) { var c = clone(a); var u = userById(db, a.actor); c.actorName = u ? u.name : a.actor; return c; }); };

  /* ---- Notifications (FR-033..035) ------------------------------------ */
  api.listNotifications = function (ctx) { var g = guard(ctx), db = g.db; return db.notifications.filter(function (n) { return n.userId === g.me.id; }).slice(0, 80); };
  api.markRead = function (ctx, id) { var g = guard(ctx, { write: true }), db = g.db; db.notifications.forEach(function (n) { if (n.userId === g.me.id && (id === 'all' || n.id === id)) n.read = true; }); return { ok: true }; };
  api.getPrefs = function (ctx) { var g = guard(ctx), db = g.db; return clone(db.prefs[g.me.id] || { categories: { requests: true, projects: true, mentorship: true, support: true, digest: false }, pausedUntil: null }); };
  /** Save notification preferences, including pause (FR-034). */
  api.setPrefs = function (ctx, p) { var g = guard(ctx, { write: true }), db = g.db; db.prefs[g.me.id] = { categories: p.categories, pausedUntil: p.pausedUntil || null }; return clone(db.prefs[g.me.id]); };

  /* ---- Dashboard ------------------------------------------------------- */
  api.dashboard = function (ctx) {
    var g = guard(ctx), db = g.db, me = g.me, id = me.id;
    var projects = db.projects.filter(function (p) { return isMember(p, id); });
    var ids = projects.map(function (p) { return p.id; });
    var myTasks = db.tasks.filter(function (t) { return ids.indexOf(t.projectId) !== -1 && t.status !== 'done' && (t.assignee === id); }).sort(function (a, b) { return (a.due || '9') < (b.due || '9') ? -1 : 1; }).slice(0, 5);
    return {
      projects: projects.map(function (p) { return projectView(db, p, id); }), tasks: myTasks.map(function (t) { var c = taskView(db, t); c.projectTitle = (db.projects.find(function (p) { return p.id === t.projectId; }) || {}).title; return c; }),
      pending: db.requests.filter(function (r) { return r.to === id && r.status === 'pending'; }).map(function (r) { return requestView(db, r); }),
      activity: db.activity.filter(function (a) { return ids.indexOf(a.projectId) !== -1; }).slice(0, 8).map(function (a) { var c = clone(a); c.user = mini(userById(db, a.userId)); c.projectTitle = (db.projects.find(function (p) { return p.id === a.projectId; }) || {}).title; return c; }),
      entitlement: entitlement(db, me), unread: db.notifications.filter(function (n) { return n.userId === id && !n.read; }).length,
      mentorPending: me.role === 'mentor' ? db.mentorRequests.filter(function (r) { return r.mentorId === id && r.status === 'pending'; }).length : 0,
      supportOpen: me.role === 'researcher' ? db.supportRequests.filter(function (r) { return r.researcherId === id && ['assigned', 'in_progress', 'reopened'].indexOf(r.status) !== -1; }).length : 0,
      suggested: db.projects.filter(function (p) { return p.status === 'open' && p.visibility !== 'private' && !isMember(p, id); }).slice(0, 3).map(function (p) { return projectView(db, p, id); })
    };
  };


module.exports = { api: api, ApiError: ApiError, DEMO_PASSWORD: DEMO_PASSWORD };
