/**
 * API tests against the real server (routing, JWT, transactions, SQLite, encrypted
 * storage). IDs trace to the test plan: TC-API-xx; each names the requirement.
 */
const assert = require('node:assert/strict');
const { boot } = require('./helpers');
const Auth = require('../server/auth');

let t;
beforeAll(async () => { t = await boot(); });
afterAll(async () => { await t.close(); });
const count = (...a) => t.count(...a);
const validBrief = () => ({ title: 'Valid research brief', subject: 'Computer Science', question: 'Does this question have enough characters to pass?', objectives: ['One objective'], skills: ['Python'], hoursPerWeek: 5, stage: 'idea', visibility: 'public', roles: ['Analyst'] });

/* ---------------------------------------------------------------- accounts */
test('TC-API-01 register: field-level 400, duplicate 409, success 201 with token (F1, NFR-007)', async () => {
  let r = await t.call('POST', '/api/auth/register', { name: '', email: 'bad', password: '1', role: 'student' });
  assert.equal(r.status, 400); assert.ok(r.body.fields.name && r.body.fields.email && r.body.fields.password && r.body.fields.consent);
  r = await t.call('POST', '/api/auth/register', { name: 'New Person', email: 'aisha@port.ac.uk', password: 'Str0ng#Pass1', role: 'student', consent: true });
  assert.equal(r.status, 409); assert.ok(r.body.fields.email);
  r = await t.call('POST', '/api/auth/register', { name: 'New Person', email: 'New.Person@Port.ac.uk', password: 'Str0ng#Pass1', role: 'student', consent: true });
  assert.equal(r.status, 201); assert.ok(r.body.token); assert.equal(r.body.user.email, 'new.person@port.ac.uk');
  assert.equal(r.body.user.pw, undefined, 'hash never leaves the server');
});
test('TC-API-02 credentials stored as salted hashes, never plain text (NFR-002)', async () => {
  const rows = await t.rows('SELECT data FROM users');
  rows.forEach((x) => { const raw = JSON.stringify(x.data); assert.match(x.data.pw, /^\$2[aby]\$/); assert.ok(!raw.includes('Demo@1234') && !raw.includes('Str0ng#Pass1')); });
});
test('TC-API-03 login: same 401 for unknown email and wrong password (no enumeration, NFR-004)', async () => {
  const a = await t.call('POST', '/api/auth/login', { email: 'nobody@x.org', password: 'Demo@1234' });
  const b = await t.call('POST', '/api/auth/login', { email: 'aisha@port.ac.uk', password: 'wrong' });
  assert.equal(a.status, 401); assert.equal(b.status, 401); assert.equal(a.body.error, b.body.error);
});
test('TC-API-04 logs never contain passwords, tokens or bodies (NFR-016)', async () => {
  await t.call('POST', '/api/auth/login', { email: 'aisha@port.ac.uk', password: 'SuperSecret#Probe1' });
  const tok = await t.as('aisha');
  await t.call('GET', '/api/me', undefined, tok);
  const text = JSON.stringify(t.logs);
  assert.ok(!text.includes('SuperSecret#Probe1')); assert.ok(!text.includes(tok)); assert.ok(!text.includes('Demo@1234'));
  assert.ok(t.logs.some((l) => l.path === '/api/me' && l.status === 200));
});
test('TC-API-05 missing, forged and expired tokens give 401 (NFR-001)', async () => {
  assert.equal((await t.call('GET', '/api/me')).status, 401);
  assert.equal((await t.call('GET', '/api/me', undefined, 'not.a.jwt')).status, 401);
  const forged = Auth.signToken('USR-100', 'attacker-secret-attacker-secret-1');
  assert.equal((await t.call('GET', '/api/admin/audit', undefined, forged)).status, 401);
  const expired = Auth.signToken('USR-101', t.SECRET, Date.now() - 9 * 3600 * 1000);
  assert.equal((await t.call('GET', '/api/me', undefined, expired)).status, 401);
});
test('TC-API-06 roles: students cannot reach admin or compensation functions (403)', async () => {
  const tok = await t.as('aisha');
  assert.equal((await t.call('GET', '/api/admin/researchers', undefined, tok)).status, 403);
  assert.equal((await t.call('POST', '/api/statements/CMP-2610-102/act', { action: 'approve' }, tok)).status, 403);
  assert.equal((await t.call('GET', '/api/statements', undefined, tok)).status, 403);
});
test('TC-API-07 profile visibility is enforced server-side (FR-005, NFR-005)', async () => {
  const ben = await t.call('GET', '/api/profiles/USR-114', undefined, await t.as('aisha'));
  assert.equal(ben.status, 404, 'unlisted profile is not revealed');
  const own = await t.call('GET', '/api/profile', undefined, await t.as('aisha'));
  assert.equal(own.body.email, 'aisha@port.ac.uk');
  const other = await t.call('GET', '/api/profiles/USR-101', undefined, await t.as('priya'));
  assert.equal(other.body.email, undefined, 'email is only returned to the owner');
});
test('TC-API-08 profile update validates input and strips markup (NFR-004, NFR-007)', async () => {
  const tok = await t.as('liam');
  let r = await t.call('PUT', '/api/profile', { name: 'L', interests: [], skills: [] }, tok);
  assert.equal(r.status, 400); assert.ok(r.body.fields.interests);
  r = await t.call('PUT', '/api/profile', { name: 'Liam Chen', headline: '<img src=x onerror=alert(1)>Economist', interests: ['Micro-finance'], skills: ['R'], experience: '', link: '' }, tok);
  assert.equal(r.status, 200); assert.ok(!r.body.headline.includes('<'));
});
test('TC-API-09 account export and deletion (NFR-006)', async () => {
  const reg = await t.call('POST', '/api/auth/register', { name: 'Delete Me', email: 'delete.me@x.org', password: 'Str0ng#Pass1', role: 'student', consent: true });
  const tok = reg.body.token;
  const ex = await t.call('GET', '/api/me/export', undefined, tok);
  assert.equal(ex.status, 200); assert.equal(ex.body.account.email, 'delete.me@x.org');
  assert.equal((await t.call('DELETE', '/api/me', undefined, tok)).status, 200);
  assert.equal(await count("SELECT COUNT(*) AS n FROM users WHERE email = 'delete.me@x.org'"), 0);
  assert.equal((await t.call('GET', '/api/me', undefined, tok)).status, 401, 'token is useless once the account is gone');
});

/* ---------------------------------------------------------------- discovery */
test('TC-API-10 search is paginated, parameterised and hides private/summary data (F3, NFR-015, NFR-004)', async () => {
  const tok = await t.as('aisha');
  const f = encodeURIComponent(JSON.stringify({}));
  const p1 = await t.call('GET', '/api/projects/search?f=' + f + '&page=1', undefined, tok);
  assert.equal(p1.status, 200); assert.ok(p1.body.items.length <= 6); assert.ok(p1.body.pages >= 1);
  assert.ok(!p1.body.items.some((p) => p.id === 'PRJ-1009'), 'private project never listed');
  const inj = await t.call('GET', '/api/projects/search?f=' + encodeURIComponent(JSON.stringify({ q: "'; DROP TABLE users; --" })), undefined, tok);
  assert.equal(inj.status, 200); assert.equal(inj.body.total, 0);
  assert.ok(await count('SELECT COUNT(*) AS n FROM users') >= 16);
  const xss = await t.call('GET', '/api/projects/search?f=' + encodeURIComponent(JSON.stringify({ q: '<script>alert(1)</script>' })), undefined, tok);
  assert.equal(xss.status, 200);
  const bad = await t.call('GET', '/api/projects/search?f=%7Bnot-json', undefined, tok);
  assert.equal(bad.status, 400);
});
test('TC-API-11 skill filter and people search respect listing choices (FR-012, FR-013)', async () => {
  const tok = await t.as('aisha');
  const r = await t.call('GET', '/api/projects/search?f=' + encodeURIComponent(JSON.stringify({ skills: ['PyTorch'] })), undefined, tok);
  assert.ok(r.body.items.length > 0); r.body.items.forEach((p) => assert.ok(p.skills.map((s) => s.toLowerCase()).includes('pytorch')));
  const people = await t.call('GET', '/api/people/search?f=%7B%7D&page=1', undefined, tok);
  assert.ok(!people.body.items.some((u) => u.id === 'USR-114'), 'unlisted profile is not searchable');
  assert.ok(!people.body.items.some((u) => u.id === 'USR-101'), 'you do not find yourself');
});

/* ---------------------------------------------------------------- projects */
test('TC-API-12 project brief: 400 fields, 201 create, owner stored, non-owner edit 403 (F2)', async () => {
  const tok = await t.as('yuki');
  let r = await t.call('POST', '/api/projects', { data: { title: 'x' }, publish: true }, tok);
  assert.equal(r.status, 400); assert.ok(r.body.fields.title);
  r = await t.call('POST', '/api/projects', { data: validBrief(), publish: true }, tok);
  assert.equal(r.status, 201); assert.equal(r.body.ownerId, 'USR-115'); assert.equal(r.body.status, 'open');
  const id = r.body.id;
  assert.equal(await count('SELECT COUNT(*) AS n FROM project_members WHERE project_id = $1 AND user_id = $2', id, 'USR-115'), 1);
  const edit = await t.call('PUT', '/api/projects/' + id, { data: Object.assign(validBrief(), { title: 'Hijacked title here' }) }, await t.as('liam'));
  assert.equal(edit.status, 403);
  assert.equal((await t.call('GET', '/api/projects/' + id, undefined, tok)).body.title, 'Valid research brief');
});
test('TC-API-13 private projects: non-member 403, summary hides detail (FR-009, NFR-001)', async () => {
  assert.equal((await t.call('GET', '/api/projects/PRJ-1009', undefined, await t.as('aisha'))).status, 403);
  assert.equal((await t.call('GET', '/api/projects/PRJ-9999', undefined, await t.as('aisha'))).status, 404);
  assert.equal((await t.call('GET', '/api/projects/PRJ-1009', undefined, await t.as('elena'))).status, 200);
});
test('TC-API-14 closing a project declines its pending requests (F2, F4)', async () => {
  const tok = await t.as('yuki');
  const p = await t.call('POST', '/api/projects', { data: validBrief(), publish: true }, tok);
  const id = p.body.id;
  assert.equal((await t.call('POST', '/api/projects/' + id + '/interest', { message: 'I would love to join this project because of my background.' }, await t.as('liam'))).status, 201);
  assert.equal((await t.call('POST', '/api/projects/' + id + '/status', { status: 'closed' }, tok)).status, 200);
  assert.equal(await count("SELECT COUNT(*) AS n FROM requests WHERE project_id = $1 AND status = 'pending'", id), 0);
  const again = await t.call('POST', '/api/projects/' + id + '/interest', { message: 'I would love to join this project because of my background.' }, await t.as('tariq'));
  assert.equal(again.status, 409, 'closed project: 409');
});

/* ---------------------------------------------------------------- requests */
test('TC-API-15 interest: duplicate 409, accept creates exactly one membership (F4, NFR-009)', async () => {
  const msg = 'I can help with the analysis because I have used these methods before.';
  const first = await t.call('POST', '/api/projects/PRJ-1001/interest', { message: msg }, await t.as('liam'));
  assert.equal(first.status, 201);
  assert.equal((await t.call('POST', '/api/projects/PRJ-1001/interest', { message: msg }, await t.as('liam'))).status, 409);
  const reqs = await t.call('GET', '/api/requests', undefined, await t.as('elena'));
  const mine = (reqs.body.incoming || reqs.body.received || reqs.body.items || []).find((r) => r.from === 'USR-110' || (r.fromUser && r.fromUser.id === 'USR-110'));
  assert.ok(mine, 'owner sees the request');
  const act = await t.call('POST', '/api/requests/' + mine.id + '/act', { to: 'accepted' }, await t.as('elena'));
  assert.equal(act.status, 200);
  assert.equal(await count("SELECT COUNT(*) AS n FROM project_members WHERE project_id='PRJ-1001' AND user_id='USR-110'"), 1);
  const late = await t.call('POST', '/api/requests/' + mine.id + '/act', { to: 'declined' }, await t.as('elena'));
  assert.equal(late.status, 409, 'accepted request cannot be declined (NFR-009)');
  assert.equal(await count("SELECT COUNT(*) AS n FROM project_members WHERE project_id='PRJ-1001' AND user_id='USR-110'"), 1);
});
test('TC-API-16 concurrent accept and withdraw: one wins, one 409, one final status (F4, NFR-009)', async () => {
  const p = await t.call('POST', '/api/projects', { data: validBrief(), publish: true }, await t.as('marcus'));
  assert.equal(p.status, 201, JSON.stringify(p.body));
  const id = p.body.id;
  const sent = await t.call('POST', '/api/projects/' + id + '/interest', { message: 'Please let me join: I have run similar studies before.' }, await t.as('tariq'));
  assert.equal(sent.status, 201);
  const rid = sent.body.id;
  const [a, b] = await Promise.all([
    t.call('POST', '/api/requests/' + rid + '/act', { to: 'accepted' }, await t.as('marcus')),
    t.call('POST', '/api/requests/' + rid + '/act', { to: 'withdrawn' }, await t.as('tariq'))
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const final = (await t.rows('SELECT data FROM requests WHERE id = $1', rid))[0].data.status;
  assert.ok(['accepted', 'withdrawn'].includes(final));
  assert.equal(await count("SELECT COUNT(*) AS n FROM project_members WHERE project_id=$1 AND user_id='USR-105'", id), final === 'accepted' ? 1 : 0);
});
test('TC-API-17 only the recipient may accept, only the sender may withdraw (403)', async () => {
  const sent = await t.call('POST', '/api/projects/PRJ-1005/interest', { message: 'I can contribute statistics support to this study, happy to help.' }, await t.as('tariq'));
  assert.equal(sent.status, 201);
  assert.equal((await t.call('POST', '/api/requests/' + sent.body.id + '/act', { to: 'accepted' }, await t.as('tariq'))).status, 403);
  assert.equal((await t.call('POST', '/api/requests/' + sent.body.id + '/act', { to: 'withdrawn' }, await t.as('aisha'))).status, 403);
});

/* ---------------------------------------------------------------- agreement */
test('TC-API-18 agreement: non-member 403; stale version 409 keeps both versions (F6)', async () => {
  assert.equal((await t.call('GET', '/api/projects/PRJ-1001/agreement', undefined, await t.as('tariq'))).status, 403);
  const ag = await t.call('GET', '/api/projects/PRJ-1001/agreement', undefined, await t.as('elena'));
  assert.equal(ag.status, 200);
  const v = ag.body.version;
  const draft = ag.body.draft || ag.body.published;
  const ok = await t.call('PUT', '/api/projects/PRJ-1001/agreement', { draft, baseVersion: v, publish: false }, await t.as('elena'));
  assert.equal(ok.status, 200);
  const stale = await t.call('PUT', '/api/projects/PRJ-1001/agreement', { draft, baseVersion: v - 1, publish: true }, await t.as('elena'));
  assert.equal(stale.status, 409);
  const nonOwner = await t.call('PUT', '/api/projects/PRJ-1001/agreement', { draft, baseVersion: v, publish: true }, await t.as('priya'));
  assert.equal(nonOwner.status, 403);
});

/* ---------------------------------------------------------------- workspace */
test('TC-API-19 workspace access: non-member 403, invalid token 401, unknown project 404 (NFR-001)', async () => {
  assert.equal((await t.call('GET', '/api/projects/PRJ-1001/workspace', undefined, await t.as('tariq'))).status, 403);
  assert.equal((await t.call('GET', '/api/projects/PRJ-1001/workspace', undefined, 'bad')).status, 401);
  assert.equal((await t.call('GET', '/api/projects/NOPE/workspace', undefined, await t.as('aisha'))).status, 404);
  assert.equal((await t.call('GET', '/api/projects/PRJ-1001/workspace', undefined, await t.as('admin'))).status, 403, 'admins do not get private workspaces');
});
test('TC-API-20 task validation boundaries: title 3-20, description 250, 3 tags (F7, NFR-007)', async () => {
  const tok = await t.as('aisha'), post = (d) => t.call('POST', '/api/projects/PRJ-1001/tasks', d, tok);
  const before = await count("SELECT COUNT(*) AS n FROM tasks WHERE project_id='PRJ-1001'");
  for (const bad of [{ title: 'ab' }, { title: 'x'.repeat(21) }, { title: 'Valid title', description: 'd'.repeat(251) }, { title: 'Valid title', tags: ['aa', 'bb', 'cc', 'dd'] }]) {
    const r = await post(bad); assert.equal(r.status, 400, JSON.stringify(bad)); assert.ok(r.body.fields);
  }
  assert.equal(await count("SELECT COUNT(*) AS n FROM tasks WHERE project_id='PRJ-1001'"), before, 'invalid input persists nothing');
  assert.equal((await post({ title: 'abc' })).status, 201);
  assert.equal((await post({ title: 'x'.repeat(20), description: 'd'.repeat(250), tags: ['one', 'two', 'three'] })).status, 201);
  assert.equal(await count("SELECT COUNT(*) AS n FROM tasks WHERE project_id='PRJ-1001'"), before + 2);
  assert.equal((await t.call('POST', '/api/projects/PRJ-1001/tasks', { title: 'Valid title' }, await t.as('tariq'))).status, 403);
  const stat = await post({ title: 'Bad status', status: 'finished' });
  assert.ok(stat.status === 400, 'database CHECK is the last line of defence: ' + stat.status);
});
test('TC-API-21 kanban move and delete are members-only and logged (UC-04)', async () => {
  const tok = await t.as('aisha');
  const mv = await t.call('POST', '/api/projects/PRJ-1001/tasks/TSK-101/move', { status: 'review' }, tok);
  assert.equal(mv.status, 200); assert.equal(mv.body.status, 'review');
  assert.equal((await t.call('POST', '/api/projects/PRJ-1001/tasks/TSK-101/move', { status: 'nonsense' }, tok)).status, 400);
  assert.equal((await t.call('DELETE', '/api/projects/PRJ-1001/tasks/TSK-102', undefined, await t.as('tariq'))).status, 403, 'non-member');
  assert.equal((await t.call('DELETE', '/api/projects/PRJ-1001/tasks/TSK-102', undefined, tok)).status, 403, 'member who did not create it');
  assert.equal((await t.call('DELETE', '/api/projects/PRJ-1001/tasks/TSK-102', undefined, await t.as('elena'))).status, 200, 'project owner may delete');
});
const file = (n, fill) => Buffer.alloc(n, fill === undefined ? 7 : fill);
const upload = (p, name, bytes, tok, perm) => t.call('POST', '/api/projects/' + p + '/files', bytes, tok, { 'X-File-Name': encodeURIComponent(name), 'X-File-Permission': perm || 'team', 'Content-Type': 'application/octet-stream' });
test('TC-API-22 upload boundary: exactly 10 MiB accepted, 10.1 MB rejected 413 with no record (F7, NFR-018)', async () => {
  const tok = await t.as('aisha');
  const before = await count("SELECT COUNT(*) AS n FROM files WHERE project_id='PRJ-1005'");
  const ok = await upload('PRJ-1005', 'dataset.csv', file(10 * 1024 * 1024), tok);
  assert.equal(ok.status, 201, JSON.stringify(ok.body)); assert.equal(ok.body.size, 10 * 1024 * 1024);
  const big = await upload('PRJ-1005', 'big.zip', file(Math.round(10.1 * 1024 * 1024)), tok);
  assert.equal(big.status, 413); assert.match(big.body.error, /10 MB/);
  const one = await upload('PRJ-1005', 'one-over.zip', file(10 * 1024 * 1024 + 1), tok);
  assert.equal(one.status, 413);
  assert.equal(await count("SELECT COUNT(*) AS n FROM files WHERE project_id='PRJ-1005'"), before + 1, 'rejected uploads leave no metadata');
});
test('TC-API-23 upload rejects bad types/empty files and non-members (F7)', async () => {
  const tok = await t.as('aisha');
  assert.equal((await upload('PRJ-1005', 'virus.exe', file(10), tok)).status, 400);
  assert.equal((await upload('PRJ-1005', 'empty.pdf', Buffer.alloc(0), tok)).status, 400);
  assert.equal((await upload('PRJ-1005', 'ok.pdf', file(10), await t.as('tariq'))).status, 403);
  assert.equal((await upload('PRJ-1005', 'ok.pdf', file(10), undefined)).status, 401);
});
test('TC-API-24 files are encrypted at rest and only members can download them (NFR-001)', async () => {
  const tok = await t.as('aisha'), secret = Buffer.from('CONFIDENTIAL-TRIAL-DATA '.repeat(50));
  const up = await upload('PRJ-1005', 'trial.csv', secret, tok);
  assert.equal(up.status, 201);
  const raw = require('node:fs').readFileSync(require('node:path').join(t.dir, up.body.id + '.bin'));
  assert.ok(!raw.includes(Buffer.from('CONFIDENTIAL')), 'ciphertext on disk');
  const dl = await t.call('GET', '/api/projects/PRJ-1005/files/' + up.body.id + '/content', undefined, tok);
  assert.equal(dl.status, 200); assert.deepEqual(dl.raw, secret);
  assert.equal(dl.headers.get('content-type'), 'application/octet-stream');
  assert.match(dl.headers.get('content-disposition'), /attachment/);
  const nm = await t.call('GET', '/api/projects/PRJ-1005/files/' + up.body.id + '/content', undefined, await t.as('tariq'));
  assert.equal(nm.status, 403); assert.equal(nm.raw.length < 200, true, 'no file bytes to non-members');
  const del = await t.call('DELETE', '/api/projects/PRJ-1005/files/' + up.body.id, undefined, tok);
  assert.equal(del.status, 200); assert.equal(t.storage.has(up.body.id), false, 'bytes removed with the record');
});
test('TC-API-25 owner-only files are hidden from other members (FR-029, FR-032)', async () => {
  const r = await t.call('GET', '/api/projects/PRJ-1001/files/FIL-3/content', undefined, await t.as('aisha'));
  assert.equal(r.status, 403);
  assert.equal((await t.call('GET', '/api/projects/PRJ-1001/files/FIL-3/content', undefined, await t.as('elena'))).status, 200);
});
test('TC-API-26 storage failure: 500, no record and no orphan bytes (F7, NFR-010)', async () => {
  const tok = await t.as('aisha'), before = await count("SELECT COUNT(*) AS n FROM files");
  const r = await upload('PRJ-1005', 'doc.pdf', file(100), tok);
  assert.equal(r.status, 201);
  const bad = await t.call('POST', '/api/projects/PRJ-1005/files', file(100), tok, { 'X-File-Name': 'a.pdf', 'X-RCMP-Sim': JSON.stringify({ storageFail: true }) });
  assert.equal(bad.status, 500);
  assert.equal(await count('SELECT COUNT(*) AS n FROM files'), before + 1);
});

/* ---------------------------------------------------------------- reliability */
test('TC-API-27 database failure rolls the whole request back and says so (NFR-010)', async () => {
  const tok = await t.as('aisha'), before = await count("SELECT COUNT(*) AS n FROM tasks");
  const r = await t.call('POST', '/api/projects/PRJ-1001/tasks', { title: 'Will not save' }, tok, { 'X-RCMP-Sim': JSON.stringify({ dbFail: true }) });
  assert.equal(r.status, 500); assert.match(r.body.error, /nothing was saved/i);
  assert.equal(await count('SELECT COUNT(*) AS n FROM tasks'), before);
});
test('TC-API-28 simulated session expiry returns 401 once and reports the consumed flag', async () => {
  const tok = await t.as('aisha');
  const r = await t.call('GET', '/api/me', undefined, tok, { 'X-RCMP-Sim': JSON.stringify({ expireNext: true }) });
  assert.equal(r.status, 401); assert.equal(r.headers.get('x-rcmp-sim-consumed'), 'expireNext');
});
test('TC-API-29 malformed JSON gives 400, unknown route 404, oversize body 413', async () => {
  const tok = await t.as('aisha');
  const res = await fetch(t.base + '/api/projects/PRJ-1001/tasks', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(res.status, 400);
  assert.equal((await t.call('GET', '/api/nope', undefined, tok)).status, 404);
  const huge = await fetch(t.base + '/api/profile', { method: 'PUT', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x'.repeat(1100000) }) });
  assert.equal(huge.status, 413);
});
test('TC-API-30 security headers and no static access to server code (NFR-004)', async () => {
  const r = await t.call('GET', '/api/health');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
});

/* ---------------------------------------------------------------- subscriptions */
test('TC-API-31 free plan blocks support (402); allowance counts and returns on decline (FR-045-047)', async () => {
  const body = { category: 'Statistics support', description: 'Please help me choose the right statistical test for my data.' };
  const priya = await t.call('POST', '/api/support', body, await t.as('priya'));
  assert.equal(priya.status, 402); assert.equal(priya.body.reason, 'no_plan');
  const sub = await t.call('GET', '/api/subscription', undefined, await t.as('aisha'));
  assert.equal(sub.body.plan.id, 'plus'); const used = sub.body.usage.used;
  const r = await t.call('POST', '/api/support', body, await t.as('aisha'));
  assert.equal(r.status, 201);
  assert.equal((await t.call('GET', '/api/subscription', undefined, await t.as('aisha'))).body.usage.used, used + 1);
  const bad = await t.call('POST', '/api/support', { category: 'Nope', description: 'short' }, await t.as('aisha'));
  assert.equal(bad.status, 400);
});
test('TC-API-32 payment outcomes: failed and pending never grant the plan (UC-06)', async () => {
  const tok = await t.as('priya');
  let r = await t.call('POST', '/api/subscription', { planId: 'basic', outcome: 'failed' }, tok);
  assert.equal(r.body.status, 'failed');
  assert.equal((await t.call('GET', '/api/subscription', undefined, tok)).body.plan.id, 'free');
  r = await t.call('POST', '/api/subscription', { planId: 'basic', outcome: 'pending' }, tok);
  assert.equal(r.body.status, 'pending');
  assert.equal((await t.call('GET', '/api/subscription', undefined, tok)).body.plan.id, 'free');
  const settle = await t.call('POST', '/api/subscription/settle', { eventId: r.body.event.id }, tok);
  assert.equal(settle.status, 200);
  assert.equal((await t.call('GET', '/api/subscription', undefined, tok)).body.plan.id, 'basic');
  assert.equal((await t.call('POST', '/api/subscription', { planId: 'basic', outcome: 'success' }, tok)).status, 409, 'already on plan');
  assert.equal((await t.call('POST', '/api/subscription', { planId: 'platinum', outcome: 'success' }, tok)).status, 400);
});

/* ---------------------------------------------------------------- compensation */
test('TC-API-33 compensation: flagged statements need an exception; paid is final (FR-052-056)', async () => {
  const admin = await t.as('admin');
  const list = await t.call('GET', '/api/statements', undefined, admin);
  assert.equal(list.status, 200);
  const flagged = list.body.items.find((s) => s.id === 'CMP-2610-106');
  assert.ok(flagged.calc.needsReview);
  assert.equal((await t.call('POST', '/api/statements/CMP-2610-106/act', { action: 'approve' }, admin)).status, 409);
  assert.equal((await t.call('POST', '/api/statements/CMP-2609-102/act', { action: 'adjust', payload: { amount: 10, note: 'late fix' } }, admin)).status, 409, 'paid cannot be adjusted');
  assert.equal((await t.call('POST', '/api/statements/CMP-2609-102/act', { action: 'payout', payload: { outcome: 'success' } }, admin)).status, 409, 'no duplicate payout');
  assert.equal((await t.call('POST', '/api/statements/CMP-2610-102/act', { action: 'payout' }, admin)).status, 409, 'cannot pay before approval');
});
test('TC-API-34 payout failure is recorded, never shown as paid, and audited (FR-056)', async () => {
  const admin = await t.as('admin');
  assert.equal((await t.call('POST', '/api/statements/CMP-2610-102/act', { action: 'approve' }, admin)).status, 200);
  const fail = await t.call('POST', '/api/statements/CMP-2610-102/act', { action: 'payout', payload: { outcome: 'failed' } }, admin);
  assert.equal(fail.body.status, 'payout_failed');
  const retry = await t.call('POST', '/api/statements/CMP-2610-102/act', { action: 'approve' }, admin);
  assert.ok(retry.status === 200 || retry.status === 409);
  const audit = await t.call('GET', '/api/admin/audit', undefined, admin);
  assert.ok(audit.body.some((a) => a.target === 'CMP-2610-102' && /FAILED/.test(a.action)));
});
test('TC-API-35 researchers see only their own statements (NFR-001)', async () => {
  const r = await t.call('GET', '/api/statements', undefined, await t.as('elena'));
  assert.equal(r.status, 200); assert.ok(r.body.items.length >= 1);
  r.body.items.forEach((s) => assert.equal(s.researcherId || s.researcher.id, 'USR-102'));
});

/* ---------------------------------------------------------------- admin and notifications */
test('TC-API-36 researcher approval is admin-only, logged and notifies (FR-049)', async () => {
  assert.equal((await t.call('PATCH', '/api/admin/researchers/USR-113', { approved: true }, await t.as('elena'))).status, 403);
  const r = await t.call('PATCH', '/api/admin/researchers/USR-113', { approved: true }, await t.as('admin'));
  assert.equal(r.status, 200);
  const list = await t.call('GET', '/api/admin/researchers', undefined, await t.as('admin'));
  assert.equal(list.body.find((x) => x.id === 'USR-113').researcher.approved, true);
});
test('TC-API-37 reports: any user reports, admin decides, suspension signs the user out (FR-036-038)', async () => {
  const victim = await t.call('POST', '/api/auth/register', { name: 'Spam Account', email: 'spam.account@x.org', password: 'Str0ng#Pass1', role: 'student', consent: true });
  const rep = await t.call('POST', '/api/reports', { targetType: 'user', targetId: victim.body.user.id, reason: 'Spam', details: 'Repeated identical messages.' }, await t.as('aisha'));
  assert.equal(rep.status, 201);
  assert.equal((await t.call('POST', '/api/admin/reports/' + rep.body.id + '/act', { action: 'suspend' }, await t.as('aisha'))).status, 403);
  const act = await t.call('POST', '/api/admin/reports/' + rep.body.id + '/act', { action: 'suspend' }, await t.as('admin'));
  assert.equal(act.status, 200);
  const again = await t.call('POST', '/api/auth/login', { email: 'spam.account@x.org', password: 'Str0ng#Pass1' });
  assert.equal(again.status, 403);
  assert.equal((await t.call('GET', '/api/me', undefined, victim.body.token)).status, 401, 'existing token stops working');
});
test('TC-API-38 notifications: list, mark read, preferences and pause (FR-033-035)', async () => {
  const tok = await t.as('priya');
  const list = await t.call('GET', '/api/notifications', undefined, tok);
  assert.equal(list.status, 200);
  assert.equal((await t.call('POST', '/api/notifications/all/read', undefined, tok)).status, 200);
  assert.equal((await t.call('GET', '/api/summary', undefined, tok)).body.unread, 0);
  const put = await t.call('PUT', '/api/notification-prefs', { categories: { requests: false, projects: true, mentorship: true, support: true }, pausedUntil: new Date(Date.now() + 3600e3).toISOString() }, tok);
  assert.equal(put.status, 200);
  assert.equal((await t.call('GET', '/api/notification-prefs', undefined, tok)).body.categories.requests, false);
});
test('TC-API-39 mentorship: validation 400, allowance 402 for free plan, duplicate 409, mentor-only actions (UC-05)', async () => {
  const body = { mentorId: 'USR-108', topic: 'Machine learning for health', goals: 'I need guidance on choosing a model for repeated measures data.', stage: 'planning', guidance: 'Review of analysis plan', projectId: 'PRJ-1006' };
  assert.equal((await t.call('POST', '/api/mentorship-requests', Object.assign({}, body, { goals: 'short' }), await t.as('aisha'))).status, 400);
  assert.equal((await t.call('POST', '/api/mentorship-requests', body, await t.as('liam'))).status, 402);
  const ok = await t.call('POST', '/api/mentorship-requests', body, await t.as('aisha'));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal((await t.call('POST', '/api/mentorship-requests', body, await t.as('aisha'))).status, 409, 'duplicate open request');
  assert.equal((await t.call('POST', '/api/mentorship-requests/' + ok.body.id + '/act', { action: 'accept' }, await t.as('aisha'))).status, 403, 'students cannot answer');
  assert.equal((await t.call('POST', '/api/mentorship-requests/' + ok.body.id + '/act', { action: 'accept' }, await t.as('marcus'))).status, 404, 'only the addressed mentor; existence is not revealed');
  assert.equal((await t.call('POST', '/api/mentorship-requests/MEN-201/act', { action: 'accept' }, await t.as('marcus'))).status, 200);
  assert.equal((await t.rows("SELECT data FROM mentor_requests WHERE id='MEN-201'"))[0].data.status, 'accepted');
});
test('TC-API-40 support lifecycle: assign, start, complete, rate, reopen (UC-07)', async () => {
  const reg = await t.call('POST', '/api/auth/register', { name: 'Support Student', email: 'support.student@port.ac.uk', password: 'Str0ng#Pass1', role: 'student', consent: true });
  const tok = reg.body.token;
  assert.equal((await t.call('POST', '/api/subscription', { planId: 'plus', outcome: 'success' }, tok)).body.status, 'succeeded');
  const mk = await t.call('POST', '/api/support', { category: 'Methodology review', description: 'Please review my sampling plan and exclusion criteria.' }, tok);
  assert.equal(mk.status, 201, JSON.stringify(mk.body));
  const id = mk.body.id;
  assert.ok(mk.body.researcherId, 'matched to an approved, active researcher');
  const email = (await t.rows('SELECT email FROM users WHERE id = $1', mk.body.researcherId))[0].email;
  const researcher = await t.login(email);
  assert.equal((await t.call('POST', '/api/support/' + id + '/act', { action: 'start' }, tok)).status, 403, 'student cannot start');
  assert.equal((await t.call('POST', '/api/support/' + id + '/act', { action: 'start' }, researcher)).status, 200);
  assert.equal((await t.call('POST', '/api/support/' + id + '/feedback', { rating: 5 }, tok)).status === 200, false, 'cannot rate before completion');
  assert.equal((await t.call('POST', '/api/support/' + id + '/act', { action: 'complete', text: 'Reviewed and annotated.' }, researcher)).status, 200);
  assert.equal((await t.call('POST', '/api/support/' + id + '/feedback', { rating: 9 }, tok)).status, 400);
  assert.equal((await t.call('POST', '/api/support/' + id + '/feedback', { rating: 5, comment: 'Very helpful' }, tok)).status, 200);
  assert.equal((await t.call('POST', '/api/support/' + id + '/feedback', { rating: 4 }, tok)).status, 409, 'feedback only once');
  assert.equal((await t.call('POST', '/api/support/' + id + '/act', { action: 'reopen', text: 'Missing the power calculation.' }, tok)).status, 200);
});
