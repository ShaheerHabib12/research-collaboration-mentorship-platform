'use strict';
/**
 * Email verification with a 6-digit PIN, and the mailer. Real server, real PostgreSQL; only the outgoing
 * e-mail is captured instead of sent. TC-VF-01..12 (supports FR-001 registration and NFR-001/NFR-004 security).
 */
const assert = require('node:assert/strict');
const { boot } = require('./helpers');
const { createMailer } = require('../server/mailer');

const sent = [];
let failNext = false;
const mailer = { configured: true, enabled: true, send: async (m) => { if (failNext) { failNext = false; throw new Error('provider down'); } sent.push(m); } };
let t;
beforeAll(async () => { t = await boot({ app: { verifyEmail: true, mailer, publicUrl: 'https://rcmp.example', authLimit: 500 } }); });
afterAll(async () => { await t.close(); });

const body = (n) => ({ name: 'Sam Student', email: 'sam' + n + '@uni.ac.uk', password: 'Strong#Pass1', role: 'student', consent: true });
const pinOf = (m) => /code is (\d{6})/.exec(m.text)[1];
const last = () => sent[sent.length - 1];
async function withClock(ms, fn) { const real = Date.now; Date.now = () => real() + ms; try { return await fn(); } finally { Date.now = real; } }

test('TC-VF-01 registering sends one 6-digit PIN, returns no token and stores only a hash', async () => {
  sent.length = 0;
  const r = await t.call('POST', '/api/auth/register', body(1));
  assert.equal(r.status, 201); assert.equal(r.body.pending, true); assert.equal(r.body.token, undefined); assert.equal(r.body.email, 'sam1@uni.ac.uk');
  assert.equal(sent.length, 1); assert.equal(sent[0].to, 'sam1@uni.ac.uk'); assert.match(sent[0].text, /code is \d{6}/);
  const pin = pinOf(sent[0]);
  const row = (await t.rows("SELECT data::text AS d FROM users WHERE email = 'sam1@uni.ac.uk'"))[0].d;
  assert.ok(!row.includes(pin), 'the PIN must not be stored in plain text');
  assert.ok(!JSON.stringify(r.body).includes('verify'));
});

test('TC-VF-02 an unverified account cannot sign in and is told why', async () => {
  const r = await t.call('POST', '/api/auth/login', { email: 'sam1@uni.ac.uk', password: 'Strong#Pass1' });
  assert.equal(r.status, 403); assert.equal(r.body.code, 'email_unverified');
  const wrong = await t.call('POST', '/api/auth/login', { email: 'sam1@uni.ac.uk', password: 'Wrong#Pass1' });
  assert.equal(wrong.status, 401, 'a wrong password must not reveal that the account is unverified');
});

test('TC-VF-03 the correct PIN verifies the account, signs the user in, and cannot be used twice', async () => {
  const pin = pinOf(last());
  const v = await t.call('POST', '/api/auth/verify', { email: 'sam1@uni.ac.uk', pin });
  assert.equal(v.status, 200); assert.ok(v.body.token); assert.equal(v.body.user.email, 'sam1@uni.ac.uk'); assert.equal(v.body.user.pw, undefined);
  const me = await t.call('GET', '/api/me', undefined, v.body.token); assert.equal(me.status, 200);
  assert.equal((await t.call('POST', '/api/auth/login', { email: 'sam1@uni.ac.uk', password: 'Strong#Pass1' })).status, 200);
  assert.equal((await t.call('POST', '/api/auth/verify', { email: 'sam1@uni.ac.uk', pin })).status, 400, 'a used PIN is dead');
});

test('TC-VF-04 five wrong PINs lock the code; even the right PIN then fails until a new one is sent', async () => {
  await t.call('POST', '/api/auth/register', body(2)); const pin = pinOf(last());
  const wrong = pin === '000000' ? '111111' : '000000';
  for (let i = 1; i <= 5; i++) { const r = await t.call('POST', '/api/auth/verify', { email: 'sam2@uni.ac.uk', pin: wrong }); assert.equal(r.status, 400); assert.match(r.body.error, /not correct/); }
  const locked = await t.call('POST', '/api/auth/verify', { email: 'sam2@uni.ac.uk', pin }); assert.equal(locked.status, 429, 'tries must persist even though each request failed');
  const n = sent.length;
  await withClock(61000, async () => { await t.call('POST', '/api/auth/resend', { email: 'sam2@uni.ac.uk' }); });
  assert.equal(sent.length, n + 1, 'a new code is issued after the cooldown');
  const ok = await withClock(61000, () => t.call('POST', '/api/auth/verify', { email: 'sam2@uni.ac.uk', pin: pinOf(last()) }));
  assert.equal(ok.status, 200);
});

test('TC-VF-05 a PIN expires after 10 minutes; malformed PINs are rejected without using a try', async () => {
  await t.call('POST', '/api/auth/register', body(3)); const pin = pinOf(last());
  for (const bad of ['12345', '1234567', 'abcdef', '']) assert.equal((await t.call('POST', '/api/auth/verify', { email: 'sam3@uni.ac.uk', pin: bad })).status, 400);
  const late = await withClock(10 * 60000 + 1000, () => t.call('POST', '/api/auth/verify', { email: 'sam3@uni.ac.uk', pin }));
  assert.equal(late.status, 400); assert.match(late.body.error, /expired/);
  const edge = await withClock(9 * 60000, () => t.call('POST', '/api/auth/verify', { email: 'sam3@uni.ac.uk', pin }));
  assert.equal(edge.status, 200, 'still valid just before expiry');
});

test('TC-VF-06 resend answers the same for unknown and known emails, and respects the 60-second cooldown', async () => {
  await t.call('POST', '/api/auth/register', body(4)); const n = sent.length;
  const unknown = await t.call('POST', '/api/auth/resend', { email: 'nobody@uni.ac.uk' });
  const known = await t.call('POST', '/api/auth/resend', { email: 'sam4@uni.ac.uk' });
  assert.equal(unknown.status, 200); assert.equal(known.status, 200); assert.deepEqual(unknown.body, known.body);
  assert.equal(sent.length, n, 'no mail for an unknown address, and none inside the cooldown');
  await withClock(61000, () => t.call('POST', '/api/auth/resend', { email: 'sam4@uni.ac.uk' }));
  assert.equal(sent.length, n + 1);
});

test('TC-VF-07 at most 5 codes per hour per account', async () => {
  await t.call('POST', '/api/auth/register', body(5)); const n = sent.length;
  for (let i = 1; i <= 6; i++) await withClock(i * 61000, () => t.call('POST', '/api/auth/resend', { email: 'sam5@uni.ac.uk' }));
  assert.equal(sent.length - n, 4, '1 at registration + 4 resends = 5 in the hour');
});

test('TC-VF-08 registering again with an unconfirmed email replaces it; a confirmed email is still refused', async () => {
  await t.call('POST', '/api/auth/register', body(6));
  const again = await withClock(61000, () => t.call('POST', '/api/auth/register', { ...body(6), password: 'Another#Pass2', name: 'Sam Second' }));
  assert.equal(again.status, 201);
  assert.equal(await t.count("SELECT COUNT(*) AS n FROM users WHERE email = 'sam6@uni.ac.uk'"), 1);
  const v = await withClock(61000, () => t.call('POST', '/api/auth/verify', { email: 'sam6@uni.ac.uk', pin: pinOf(last()) }));
  assert.equal(v.status, 200); assert.equal(v.body.user.name, 'Sam Second');
  assert.equal((await t.call('POST', '/api/auth/login', { email: 'sam6@uni.ac.uk', password: 'Another#Pass2' })).status, 200);
  assert.equal((await t.call('POST', '/api/auth/login', { email: 'sam6@uni.ac.uk', password: 'Strong#Pass1' })).status, 401);
  assert.equal((await t.call('POST', '/api/auth/register', body(6))).status, 409);
});

test('TC-VF-09 if the mail provider fails the account still exists and the response says the mail was not sent', async () => {
  failNext = true;
  const r = await t.call('POST', '/api/auth/register', body(7));
  assert.equal(r.status, 201); assert.equal(r.body.pending, true); assert.equal(r.body.emailSent, false);
});

test('TC-VF-10 an invalid registration sends no mail and demo accounts still sign in without a PIN', async () => {
  const n = sent.length;
  assert.equal((await t.call('POST', '/api/auth/register', { ...body(8), password: 'weak' })).status, 400);
  assert.equal(sent.length, n);
  assert.equal((await t.call('POST', '/api/auth/login', { email: 'aisha@port.ac.uk', password: 'Demo@1234' })).status, 200);
});

test('TC-VF-11 with mail enabled the password-reset link is e-mailed and never returned in the response', async () => {
  const n = sent.length;
  const r = await t.call('POST', '/api/auth/forgot', { email: 'aisha@port.ac.uk' });
  assert.equal(r.status, 200); assert.equal(r.body.resetToken, undefined);
  assert.equal(sent.length, n + 1); assert.match(last().text, /https:\/\/rcmp\.example\/reset\.html\?token=/);
});

test('TC-VF-12 the mailer calls the Brevo API correctly, reports refusals, and names missing settings', async () => {
  const calls = [];
  const env = { RCMP_MAIL_PROVIDER: 'brevo', RCMP_MAIL_API_KEY: 'k-123', RCMP_MAIL_FROM: 'no-reply@uni.ac.uk', __fetch: async (u, o) => { calls.push({ u, o }); return { ok: true, status: 201 }; } };
  const m = createMailer(env);
  assert.equal(m.enabled, true); assert.deepEqual(m.problems(), []);
  await m.send({ to: 'a@b.co', subject: 'S', text: 'T' });
  assert.equal(calls[0].u, 'https://api.brevo.com/v3/smtp/email'); assert.equal(calls[0].o.headers['api-key'], 'k-123');
  const sentBody = JSON.parse(calls[0].o.body); assert.equal(sentBody.to[0].email, 'a@b.co'); assert.equal(sentBody.sender.email, 'no-reply@uni.ac.uk');
  const bad = createMailer({ ...env, __fetch: async () => ({ ok: false, status: 401, text: async () => 'unauthorised' }) });
  await assert.rejects(bad.send({ to: 'a@b.co', subject: 'S', text: 'T' }), /HTTP 401/);
  assert.deepEqual(createMailer({ RCMP_MAIL_PROVIDER: 'brevo' }).problems(), ['RCMP_MAIL_API_KEY is not set', 'RCMP_MAIL_FROM is not set']);
  assert.equal(createMailer({}).enabled, false); assert.equal(createMailer({ RCMP_MAIL_PROVIDER: 'console' }).enabled, false);
});
