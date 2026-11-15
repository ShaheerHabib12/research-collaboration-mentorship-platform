/**
 * API tests, part 2: flows not covered by api.test.js - team agreement lifecycle,
 * invitations, milestones, mentor listing, subscription cancel, admin moderation,
 * notifications and error handling. IDs continue the TC-API series.
 */
const assert = require('node:assert/strict');
const { boot } = require('./helpers');

let t;
beforeAll(async () => { t = await boot(); });
afterAll(async () => { await t.close(); });
const reg = async (name, email, role) => (await t.call('POST', '/api/auth/register', { name, email, password: 'Str0ng#Pass1', role: role || 'student', consent: true })).body;

test('TC-API-41 agreement lifecycle: template, validation, publish, acknowledge, stale 409 (UC-03, FR-023..026)', async () => {
  const owner = await t.as('elena'), member = await t.as('aisha'), id = 'PRJ-1001';
  const a0 = await t.call('GET', '/api/projects/' + id + '/agreement', undefined, owner);
  assert.equal(a0.status, 200); assert.equal(a0.body.isOwner, true);
  const draft = { roles: a0.body.draft.roles, contributions: '', communication: 'Weekly call', authorship: 'By contribution', deadlines: [] };
  let r = await t.call('PUT', '/api/projects/' + id + '/agreement', { draft, baseVersion: a0.body.version, publish: true }, owner);
  assert.equal(r.status, 400); assert.ok(r.body.fields.contributions, 'publish needs contributions');
  r = await t.call('PUT', '/api/projects/' + id + '/agreement', { draft: Object.assign({}, draft, { contributions: 'Each member contributes weekly.' }), baseVersion: a0.body.version, publish: true }, owner);
  assert.equal(r.status, 400); assert.ok(r.body.fields.deadlines, 'publish needs a deadline');
  r = await t.call('PUT', '/api/projects/' + id + '/agreement', { draft: Object.assign({}, draft, { contributions: 'Each member contributes weekly.', deadlines: [{ label: 'Draft', date: '2027-01-10' }] }), baseVersion: a0.body.version, publish: true }, owner);
  assert.equal(r.status, 200, JSON.stringify(r.body)); const v = r.body.version; assert.ok(v >= 1);
  assert.equal((await t.call('PUT', '/api/projects/' + id + '/agreement', { draft, baseVersion: v - 1, publish: false }, owner)).status, 409, 'stale base version');
  assert.equal((await t.call('PUT', '/api/projects/' + id + '/agreement', { draft, baseVersion: v }, member)).status, 403, 'only the owner edits');
  assert.equal((await t.call('POST', '/api/projects/' + id + '/agreement/acknowledge', { version: v - 1 }, member)).status, 409);
  assert.equal((await t.call('POST', '/api/projects/' + id + '/agreement/acknowledge', { version: v }, member)).status, 200);
});
test('TC-API-42 agreement revision proposals: validate, propose, resolve once (UC-03, FR-025)', async () => {
  const owner = await t.as('elena'), member = await t.as('aisha'), id = 'PRJ-1001', base = '/api/projects/' + id + '/agreement';
  assert.equal((await t.call('POST', base + '/proposals', { section: 'authorship', text: 'short' }, member)).status, 400);
  assert.equal((await t.call('POST', base + '/proposals', { section: 'authorship', text: 'Please list alphabetical authorship order.' }, member)).status, 200);
  const view = await t.call('GET', base, undefined, owner), pid = view.body.proposals[0].id;
  assert.equal((await t.call('POST', base + '/proposals/' + pid, { decision: 'accepted' }, member)).status, 403);
  assert.equal((await t.call('POST', base + '/proposals/' + pid, { decision: 'accepted' }, owner)).status, 200);
  assert.equal((await t.call('POST', base + '/proposals/' + pid, { decision: 'declined' }, owner)).status, 409, 'already resolved');
  assert.equal((await t.call('POST', base + '/proposals/NOPE', { decision: 'declined' }, owner)).status, 404);
});
test('TC-API-43 invitations: owner only, validation, duplicates, existing member (UC-02, FR-015)', async () => {
  const owner = await t.as('elena'), other = await t.as('marcus'), id = 'PRJ-1001', url = '/api/projects/' + id + '/invitations';
  const target = (await t.rows("SELECT id FROM users WHERE email = 'yuki.tanaka@titech.example'"))[0].id;
  assert.equal((await t.call('POST', url, { userId: target, message: 'Join us' }, other)).status, 403);
  assert.equal((await t.call('POST', url, { userId: 'USR-NOPE', message: 'Join us for this' }, owner)).status, 404);
  assert.equal((await t.call('POST', url, { userId: target, message: '' }, owner)).status, 400);
  const ok = await t.call('POST', url, { userId: target, message: 'We would love your help with analysis.' }, owner);
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal((await t.call('POST', url, { userId: target, message: 'We would love your help with analysis.' }, owner)).status, 409, 'duplicate pending invitation');
  const aishaId = (await t.rows("SELECT id FROM users WHERE email = 'aisha@port.ac.uk'"))[0].id;
  assert.equal((await t.call('POST', url, { userId: aishaId, message: 'We would love your help with analysis.' }, owner)).status, 409, 'already a member');
  const yuki = await t.as('yuki'), accepted = await t.call('POST', '/api/requests/' + ok.body.id + '/act', { to: 'accepted' }, yuki);
  assert.equal(accepted.status, 200); assert.equal(await t.count('SELECT COUNT(*) AS n FROM project_members WHERE project_id = $1 AND user_id = $2', id, target), 1);
});
test('TC-API-44 milestones: add (boundaries), toggle, unknown id (UC-04, FR-011, FR-028)', async () => {
  const tok = await t.as('elena'), id = 'PRJ-1001';
  assert.equal((await t.call('POST', '/api/projects/' + id + '/milestones', { title: 'ab' }, tok)).status, 400);
  assert.equal((await t.call('POST', '/api/projects/' + id + '/milestones', { title: 'x'.repeat(61) }, tok)).status, 400);
  const ok = await t.call('POST', '/api/projects/' + id + '/milestones', { title: 'Ethics approval', due: '2027-02-01' }, tok);
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const on = await t.call('POST', '/api/projects/' + id + '/milestones/' + ok.body.id + '/toggle', undefined, tok); assert.equal(on.body.done, true);
  const off = await t.call('POST', '/api/projects/' + id + '/milestones/' + ok.body.id + '/toggle', undefined, tok); assert.equal(off.body.done, false);
  assert.equal((await t.call('POST', '/api/projects/' + id + '/milestones/NOPE/toggle', undefined, tok)).status, 404);
  assert.equal((await t.call('POST', '/api/projects/' + id + '/milestones', { title: 'Outsider milestone' }, await t.as('fatima'))).status, 403, 'non-members cannot add milestones');
});
test('TC-API-45 mentor search filters, accepting toggle and request listing (UC-05, FR-018, FR-021)', async () => {
  const stu = await t.as('aisha'), mentor = await t.as('noor');
  const all = await t.call('GET', '/api/mentors/search', undefined, stu); assert.equal(all.status, 200); assert.ok(all.body.items.length >= 3);
  const f = (o) => t.call('GET', '/api/mentors/search?f=' + encodeURIComponent(JSON.stringify(o)), undefined, stu);
  assert.ok((await f({ q: 'grant' })).body.items.length >= 1);
  assert.ok((await f({ topic: 'Grant writing' })).body.items.every((m) => m.mentor.expertise.includes('Grant writing')));
  assert.ok((await f({ verifiedOnly: true })).body.items.every((m) => m.mentor.verification === 'verified'));
  assert.equal((await t.call('GET', '/api/mentors/search?f=%7Bbroken', undefined, stu)).status, 400, 'malformed filter JSON');
  assert.equal((await t.call('PUT', '/api/mentors/accepting', { accepting: false }, stu)).status, 403, 'students cannot toggle');
  assert.equal((await t.call('PUT', '/api/mentors/accepting', { accepting: false }, mentor)).body.accepting, false);
  assert.ok((await f({ acceptingOnly: true })).body.items.every((m) => m.mentor.accepting));
  await t.call('PUT', '/api/mentors/accepting', { accepting: true }, mentor);
  assert.equal((await t.call('GET', '/api/mentorship-requests', undefined, mentor)).status, 200);
  assert.equal((await t.call('GET', '/api/mentorship-requests', undefined, stu)).status, 200);
});
test('TC-API-46 support list is role-scoped; mentors are refused (UC-07, FR-050)', async () => {
  for (const who of ['aisha', 'tariq', 'admin']) assert.equal((await t.call('GET', '/api/support', undefined, await t.as(who))).status, 200, who);
  assert.equal((await t.call('GET', '/api/support', undefined, await t.as('noor'))).status, 403);
});
test('TC-API-47 subscription: cancel needs an active plan, then marks cancel-at-period-end (UC-06, FR-046)', async () => {
  const u = await reg('Cancel Student', 'cancel.student@port.ac.uk'), tok = u.token;
  assert.equal((await t.call('DELETE', '/api/subscription', undefined, tok)).status, 409, 'nothing to cancel on the free plan');
  assert.equal((await t.call('POST', '/api/subscription', { planId: 'plus', outcome: 'success' }, tok)).body.status, 'succeeded');
  assert.equal((await t.call('DELETE', '/api/subscription', undefined, tok)).status, 200);
  assert.equal((await t.call('GET', '/api/subscription', undefined, tok)).body.subscription.cancelAtEnd, true);
});
test('TC-API-48 admin overview, researcher approval and audit trail (FR-036..038)', async () => {
  const admin = await t.as('admin'), stu = await t.as('aisha');
  const o = await t.call('GET', '/api/admin/overview', undefined, admin); assert.equal(o.status, 200); assert.ok(o.body.users >= 16);
  assert.equal((await t.call('GET', '/api/admin/overview', undefined, stu)).status, 403);
  const rs = await t.call('GET', '/api/admin/researchers', undefined, admin); assert.ok(rs.body.length >= 1);
  const rid = rs.body[0].id;
  assert.equal((await t.call('PATCH', '/api/admin/researchers/' + rid, { active: false }, admin)).status, 200);
  assert.equal((await t.call('PATCH', '/api/admin/researchers/USR-NOPE', { active: false }, admin)).status, 404);
  await t.call('PATCH', '/api/admin/researchers/' + rid, { active: true, approved: true }, admin);
  const au = await t.call('GET', '/api/admin/audit', undefined, admin); assert.equal(au.status, 200); assert.ok(au.body.length >= 1);
});
test('TC-API-49 content reports: validate, moderate once, warn/dismiss/remove (FR-037)', async () => {
  const stu = await t.as('aisha'), admin = await t.as('admin');
  assert.equal((await t.call('POST', '/api/reports', { targetType: 'project', targetId: 'PRJ-1002', reason: '' }, stu)).status, 400);
  assert.equal((await t.call('POST', '/api/reports', { targetType: 'project', targetId: 'PRJ-1002', reason: 'Spam', details: 'x'.repeat(401) }, stu)).status, 400);
  const mk = async () => (await t.call('POST', '/api/reports', { targetType: 'user', targetId: 'USR-114', targetName: 'Ben', reason: 'Spam', details: 'Repeated unsolicited messages.' }, stu));
  const a = await mk(); assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal((await t.call('POST', '/api/admin/reports/' + a.body.id + '/act', { action: 'warn' }, stu)).status, 403);
  assert.equal((await t.call('POST', '/api/admin/reports/' + a.body.id + '/act', { action: 'warn' }, admin)).status, 200);
  assert.equal((await t.call('POST', '/api/admin/reports/' + a.body.id + '/act', { action: 'dismiss' }, admin)).status, 409, 'already actioned');
  const b = await mk(); assert.equal((await t.call('POST', '/api/admin/reports/' + b.body.id + '/act', { action: 'dismiss' }, admin)).status, 200);
  const c = await mk(); assert.equal((await t.call('POST', '/api/admin/reports/' + c.body.id + '/act', { action: 'bogus' }, admin)).status, 400);
  assert.equal((await t.call('POST', '/api/admin/reports/NOPE/act', { action: 'dismiss' }, admin)).status, 404);
  assert.ok((await t.call('GET', '/api/admin/reports', undefined, admin)).body.length >= 3);
});
test('TC-API-50 notifications and preferences round-trip; mark single and all read (FR-033..035)', async () => {
  const tok = await t.as('aisha');
  const list = await t.call('GET', '/api/notifications', undefined, tok); assert.equal(list.status, 200);
  if (list.body.length) assert.equal((await t.call('POST', '/api/notifications/' + list.body[0].id + '/read', undefined, tok)).status, 200);
  assert.equal((await t.call('POST', '/api/notifications/all/read', undefined, tok)).status, 200);
  assert.equal((await t.call('GET', '/api/summary', undefined, tok)).body.unread, 0);
  const prefs = { categories: { requests: false, projects: true, mentorship: true, support: true }, pausedUntil: null };
  assert.equal((await t.call('PUT', '/api/notification-prefs', prefs, tok)).status, 200);
  assert.equal((await t.call('GET', '/api/notification-prefs', undefined, tok)).body.categories.requests, false);
});
test('TC-API-51 dashboard has role-specific blocks (FR-005)', async () => {
  const noor = (await t.call('GET', '/api/dashboard', undefined, await t.as('noor'))).body, tariq = (await t.call('GET', '/api/dashboard', undefined, await t.as('tariq'))).body;
  assert.equal(typeof noor.mentorPending, 'number'); assert.equal(typeof tariq.supportOpen, 'number');
  assert.ok(Array.isArray((await t.call('GET', '/api/dashboard', undefined, await t.as('aisha'))).body.suggested));
});
test('TC-API-52 platform behaviour: health, 404, method, bad JSON, CORS-free static and security headers (NFR-002, NFR-003)', async () => {
  const h = await t.call('GET', '/api/health'); assert.equal(h.status, 200); assert.equal(h.body.db, true);
  assert.equal((await t.call('GET', '/api/nope')).status, 404);
  const bad = await fetch(t.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' }); assert.equal(bad.status, 400);
  assert.equal((await t.call('GET', '/api/me')).status, 401, 'no token');
  assert.equal((await t.call('GET', '/api/me', undefined, 'garbage.token.value')).status, 401, 'bad token');
  const s = await fetch(t.base + '/api/health'); assert.equal(s.headers.get('x-content-type-options'), 'nosniff'); assert.ok(s.headers.get('content-security-policy'));
});
test('TC-API-53 demo simulation: db failure -> 500 with nothing saved; reset restores seed (E1, demo tools)', async () => {
  const tok = await t.as('aisha'), before = await t.count('SELECT COUNT(*) AS n FROM tasks');
  const r = await t.call('POST', '/api/projects/PRJ-1001/tasks', { title: 'Will fail' }, tok, { 'X-RCMP-Sim': JSON.stringify({ dbFail: true }) });
  assert.equal(r.status, 500); assert.equal(await t.count('SELECT COUNT(*) AS n FROM tasks'), before);
  const reset = await t.call('POST', '/api/demo/reset'); assert.equal(reset.status, 200);
  assert.ok(await t.count('SELECT COUNT(*) AS n FROM users') >= 16);
});

test('TC-API-54 account recovery: no enumeration, single-use link, weak password refused, old sessions revoked (FR-002, NFR-002, NFR-004)', async () => {
  const email = 'recover.me@port.ac.uk', oldTok = (await reg('Recover Me', email)).token;
  const known = await t.call('POST', '/api/auth/forgot', { email }), unknown = await t.call('POST', '/api/auth/forgot', { email: 'nobody@port.ac.uk' });
  assert.equal(known.status, 200); assert.equal(unknown.status, 200); assert.equal(known.body.message, unknown.body.message, 'same answer either way');
  assert.ok(known.body.resetToken && !unknown.body.resetToken);
  assert.equal((await t.call('POST', '/api/auth/forgot', { email: 'not-an-email' })).status, 400);
  const tok = known.body.resetToken;
  assert.equal((await t.call('GET', '/api/me', undefined, tok)).status, 401, 'a reset token is not a session token');
  assert.equal((await t.call('POST', '/api/auth/reset', { token: tok, password: 'weak' })).status, 400);
  assert.equal((await t.call('POST', '/api/auth/reset', { token: 'garbage', password: 'N3w#Password9' })).status, 400);
  assert.equal((await t.call('POST', '/api/auth/reset', { token: tok, password: 'N3w#Password9' })).status, 200);
  assert.equal((await t.call('POST', '/api/auth/reset', { token: tok, password: 'An0ther#Pass9' })).status, 400, 'link works once');
  assert.equal((await t.call('GET', '/api/me', undefined, oldTok)).status, 401, 'old session signed out');
  assert.equal((await t.call('POST', '/api/auth/login', { email, password: 'Str0ng#Pass1' })).status, 401);
  const fresh = await t.call('POST', '/api/auth/login', { email, password: 'N3w#Password9' });
  assert.equal(fresh.status, 200); assert.equal((await t.call('GET', '/api/me', undefined, fresh.body.token)).status, 200);
  const notes = await t.call('GET', '/api/notifications', undefined, fresh.body.token);
  assert.ok(notes.body.some((n) => n.title === 'Password changed'));
});
test('TC-API-55 an expired reset link is refused (FR-002)', async () => {
  const Auth = require('../server/auth');
  const u = (await t.rows("SELECT id, data FROM users WHERE email = 'priya.nair@port.ac.uk'"))[0];
  const old = Auth.signToken(u.id, t.SECRET, Date.now() - 3600 * 1000, { purpose: 'reset', pv: Auth.pwFingerprint(u.data.pw) }, Auth.RESET_TTL_SECONDS);
  assert.equal((await t.call('POST', '/api/auth/reset', { token: old, password: 'N3w#Password9' })).status, 400);
});
test('TC-API-56 pagination: 500 records are served in pages of at most 20 and every page is reachable (NFR-015)', async () => {
  const DB = require('../server/db'), ctx = {};
  await DB.transact(t.pool, ctx, async () => {
    const src = ctx.db.projects.find((p) => p.visibility === 'public' && p.status === 'open');
    for (let i = 0; i < 500; i++) { const c = JSON.parse(JSON.stringify(src)); c.id = 'PRJ-9' + String(i).padStart(3, '0'); c.title = 'Synthetic pagination project ' + i; c.members = [src.ownerId]; ctx.db.projects.push(c); }
  });
  const tok = await t.as('aisha'), seen = new Set(); let page = 1, total;
  for (;;) {
    const r = await t.call('GET', '/api/projects/search?f=' + encodeURIComponent(JSON.stringify({ q: 'Synthetic pagination' })) + '&page=' + page, undefined, tok);
    assert.equal(r.status, 200); total = r.body.total;
    assert.ok(r.body.items.length <= 20, 'page ' + page + ' has ' + r.body.items.length);
    r.body.items.forEach((p) => seen.add(p.id));
    if (!r.body.items.length || seen.size >= total) break; page++;
    assert.ok(page < 200, 'terminates');
  }
  assert.equal(total, 500); assert.equal(seen.size, 500);
});
test('TC-API-57 API responses are never cached; CORS is closed unless explicitly opened outside demo mode (NFR-001, NFR-003)', async () => {
  const h = await fetch(t.base + '/api/health'); assert.equal(h.headers.get('cache-control'), 'no-store');
  const http = require('node:http'), { createApp } = require('../server/app'), { createStorage } = require('../server/storage');
  const mk = (extra) => new Promise((r) => { const s = http.createServer(createApp(Object.assign({ pool: t.pool, storage: createStorage(t.dir, 'ab'.repeat(32)), secret: t.SECRET, allowSim: false, log() {} }, extra))).listen(0, '127.0.0.1', () => r(s)); });
  for (const [extra, expectOrigin, expectHsts] of [[{}, null, null], [{ corsOrigin: 'https://app.example' }, 'https://app.example', null], [{ forceHttps: true }, null, 'max-age']]) {
    const s = await mk(extra), res = await fetch('http://127.0.0.1:' + s.address().port + '/api/health', { headers: { 'x-forwarded-proto': 'https' } });
    assert.equal(res.headers.get('access-control-allow-origin'), expectOrigin);
    if (expectHsts) assert.match(res.headers.get('strict-transport-security') || '', /max-age/);
    await new Promise((r) => s.close(r));
  }
});
test('TC-API-58 HTTPS enforcement redirects plain HTTP with 308 and passes proxied HTTPS (NFR-003)', async () => {
  const http = require('node:http'), { createApp } = require('../server/app'), { createStorage } = require('../server/storage');
  const s = await new Promise((r) => { const x = http.createServer(createApp({ pool: t.pool, storage: createStorage(t.dir, 'ab'.repeat(32)), secret: t.SECRET, forceHttps: true, log() {} })).listen(0, '127.0.0.1', () => r(x)); });
  const base = 'http://127.0.0.1:' + s.address().port;
  const plain = await fetch(base + '/api/health', { redirect: 'manual' }); assert.equal(plain.status, 308); assert.match(plain.headers.get('location'), /^https:\/\//);
  assert.equal((await fetch(base + '/api/health', { headers: { 'X-Forwarded-Proto': 'https' } })).status, 200);
  await new Promise((r) => s.close(r));
});
test('TC-API-59 login throttle: 8 failures lock the client out and a forged X-Forwarded-For cannot dodge it (NFR-004)', async () => {
  const th = await boot(); // own server: the lock-out must not affect other tests
  let last;
  for (let i = 0; i < 9; i++) last = await th.call('POST', '/api/auth/login', { email: 'throttle@x.org', password: 'bad' }, undefined, { 'X-Forwarded-For': '10.0.0.' + i });
  assert.equal(last.status, 429);
  await th.close();
});
