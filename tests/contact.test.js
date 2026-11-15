'use strict';
/**
 * Contact form and admin inbox. Real server, real PostgreSQL, no mocks.
 * TC-CT-01..09 (public contact page, supports UR-010 moderation of user messages and NFR-004 input handling).
 */
const assert = require('node:assert/strict');
const { boot } = require('./helpers');

process.env.RCMP_ADMIN_PASSWORD = 'Admin-Test#2026x'; // read when the seed is built
let t;
beforeAll(async () => { t = await boot({ app: { contactLimit: 50 } }); });
afterAll(async () => { await t.close(); });

const good = { name: 'Priya Nair', email: 'priya@uni.ac.uk', topic: 'subscription', subject: 'Question about plans', message: 'Can I change plan in the middle of a month?' };

test('TC-CT-01 anyone can send a message without signing in; it is stored and the id is returned', async () => {
  const r = await t.call('POST', '/api/contact', good);
  assert.equal(r.status, 201); assert.match(r.body.id, /^MSG-\d+$/);
  const list = await t.call('GET', '/api/admin/contact', undefined, await t.as('admin'));
  assert.equal(list.status, 200);
  const m = list.body.find((x) => x.id === r.body.id);
  assert.ok(m); assert.equal(m.status, 'new'); assert.equal(m.email, 'priya@uni.ac.uk'); assert.equal(m.topic, 'subscription');
});

test('TC-CT-02 each invalid field is rejected with a field message (equivalence partitions and boundaries)', async () => {
  const bad = async (patch, field) => { const r = await t.call('POST', '/api/contact', { ...good, ...patch }); assert.equal(r.status, 400, field); assert.ok(r.body.fields && r.body.fields[field], 'field ' + field); };
  await bad({ name: '' }, 'name'); await bad({ email: 'nope' }, 'email'); await bad({ topic: 'other' }, 'topic');
  await bad({ subject: 'ab' }, 'subject'); await bad({ subject: 'x'.repeat(101) }, 'subject');
  await bad({ message: 'too short' }, 'message'); await bad({ message: 'x'.repeat(1001) }, 'message');
  assert.equal((await t.call('POST', '/api/contact', { ...good, subject: 'abc', message: 'x'.repeat(10) })).status, 201, 'lower boundary');
  assert.equal((await t.call('POST', '/api/contact', { ...good, subject: 'x'.repeat(100), message: 'y'.repeat(1000) })).status, 201, 'upper boundary');
});

test('TC-CT-03 markup in a message is stored as inert text (NFR-004)', async () => {
  const r = await t.call('POST', '/api/contact', { ...good, subject: 'Hello <script>alert(1)</script>', message: 'Please look at <img src=x onerror=alert(1)> this' });
  assert.equal(r.status, 201);
  const m = (await t.call('GET', '/api/admin/contact', undefined, await t.as('admin'))).body.find((x) => x.id === r.body.id);
  assert.ok(!/<script|<img/i.test(m.subject + m.message));
});

test('TC-CT-04 the hidden honeypot field makes bots look successful but stores nothing', async () => {
  const before = (await t.call('GET', '/api/admin/contact', undefined, await t.as('admin'))).body.length;
  const r = await t.call('POST', '/api/contact', { ...good, website: 'http://spam.example' });
  assert.equal(r.status, 201);
  assert.equal((await t.call('GET', '/api/admin/contact', undefined, await t.as('admin'))).body.length, before);
});

test('TC-CT-05 only administrators can read or change messages', async () => {
  assert.equal((await t.call('GET', '/api/admin/contact')).status, 401);
  assert.equal((await t.call('GET', '/api/admin/contact', undefined, await t.as('aisha'))).status, 403);
  const id = (await t.call('POST', '/api/contact', good)).body.id;
  assert.equal((await t.call('POST', '/api/admin/contact/' + id + '/status', { status: 'read' }, await t.as('aisha'))).status, 403);
});

test('TC-CT-06 admin marks a message read then answered; unknown id and status are rejected; actions are audited', async () => {
  const admin = await t.as('admin'), id = (await t.call('POST', '/api/contact', good)).body.id;
  const a = await t.call('POST', '/api/admin/contact/' + id + '/status', { status: 'read' }, admin); assert.equal(a.status, 200); assert.equal(a.body.status, 'read');
  assert.equal((await t.call('POST', '/api/admin/contact/' + id + '/status', { status: 'answered' }, admin)).body.status, 'answered');
  assert.equal((await t.call('POST', '/api/admin/contact/' + id + '/status', { status: 'bogus' }, admin)).status, 400);
  assert.equal((await t.call('POST', '/api/admin/contact/MSG-NOPE/status', { status: 'read' }, admin)).status, 404);
  const audit = (await t.call('GET', '/api/admin/audit', undefined, admin)).body;
  assert.ok(audit.some((x) => /Contact message/.test(x.action)));
});

test('TC-CT-07 administrators are notified of a new message; sending is rate limited per client', async () => {
  const admin = await t.as('admin'); await t.call('POST', '/api/contact', { ...good, subject: 'Notify admins please' });
  const n = (await t.call('GET', '/api/notifications', undefined, admin)).body;
  assert.ok(n.some((x) => /New contact message: Notify admins please/.test(x.title)));
  const lim = await boot({ app: { contactLimit: 2 } });
  try {
    assert.equal((await lim.call('POST', '/api/contact', good)).status, 201); assert.equal((await lim.call('POST', '/api/contact', good)).status, 201);
    assert.equal((await lim.call('POST', '/api/contact', good)).status, 429);
  } finally { await lim.close(); }
});

test('TC-CT-08 the real administrator account exists, is not a demo account, and receives contact notifications', async () => {
  const login = (email, password) => t.call('POST', '/api/auth/login', { email, password });
  assert.equal((await login('muhammad.habib@myport.ac.uk', 'Demo@1234')).status, 401, 'the demo password never works for the real administrator');
  const ok = await login('muhammad.habib@myport.ac.uk', 'Admin-Test#2026x'); assert.equal(ok.status, 200); assert.equal(ok.body.user.role, 'admin');
  const token = ok.body.token; await t.call('POST', '/api/contact', { ...good, subject: 'For the real administrator' });
  const n = (await t.call('GET', '/api/notifications', undefined, token)).body;
  assert.ok(n.some((x) => /For the real administrator/.test(x.title)));
  assert.ok(!(await t.call('GET', '/api/demo/accounts')).body.some?.((a) => /myport/.test(a.email)), 'not listed as a demo account');
});
test('TC-CT-09 the administrator password can be reset with the script, the old one stops working, and weak or wrong targets are refused', async () => {
  const { setAdminPassword } = require('../scripts/set-admin-password');
  const login = (email, password) => t.call('POST', '/api/auth/login', { email, password });
  await assert.rejects(() => setAdminPassword(t.pool, 'muhammad.habib@myport.ac.uk', 'weak'), /Password refused/);
  await assert.rejects(() => setAdminPassword(t.pool, 'aisha@port.ac.uk', 'Another#Pass2026'), /not an administrator/);
  await assert.rejects(() => setAdminPassword(t.pool, 'nobody@x.ac.uk', 'Another#Pass2026'), /No account/);
  await setAdminPassword(t.pool, 'muhammad.habib@myport.ac.uk', 'Reset#Pass2026x');
  assert.equal((await login('muhammad.habib@myport.ac.uk', 'Admin-Test#2026x')).status, 401);
  assert.equal((await login('muhammad.habib@myport.ac.uk', 'Reset#Pass2026x')).status, 200);
});
