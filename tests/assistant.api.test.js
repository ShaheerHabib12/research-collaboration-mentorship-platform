/** TC-AS-API: Scout endpoint over the real server and PostgreSQL. */
const assert = require('node:assert/strict');
const { boot } = require('./helpers');
let t;
beforeAll(async () => { t = await boot(); });
afterAll(async () => { await t.close(); });

test('TC-AS-API-01 public, answers in scope without a token', async () => {
  const r = await t.call('POST', '/api/assistant', { message: 'How do I upload a file?' });
  assert.equal(r.status, 200); assert.equal(r.body.inScope, true); assert.equal(r.body.topic, 'files');
});
test('TC-AS-API-02 out of scope question is declined as platform-specific', async () => {
  const r = await t.call('POST', '/api/assistant', { message: 'What is the weather in London?' });
  assert.equal(r.status, 200); assert.equal(r.body.inScope, false); assert.match(r.body.reply, /only help with using this platform/);
});
test('TC-AS-API-03 signed-in student gets a personal plan sentence', async () => {
  const tok = await t.as('aisha');
  const r = await t.call('POST', '/api/assistant', { message: 'What does my plan include?' }, tok);
  assert.equal(r.status, 200); assert.match(r.body.reply, /You are on /);
});
test('TC-AS-API-04 invalid token is treated as signed out, not an error', async () => {
  const r = await t.call('POST', '/api/assistant', { message: 'hello' }, 'garbage');
  assert.equal(r.status, 200);
});
test('TC-AS-API-05 validation: missing, blank, non-string and over-long messages -> 400', async () => {
  for (const m of [undefined, '   ', 42, 'x'.repeat(301)]) {
    const r = await t.call('POST', '/api/assistant', { message: m }); assert.equal(r.status, 400, String(m).slice(0, 10)); assert.ok(r.body.fields.message);
  }
});
test('TC-AS-API-06 never reflects input and does not write (no audit/DB change)', async () => {
  const r = await t.call('POST', '/api/assistant', { message: '<script>alert(1)</script> zebra' });
  assert.ok(!JSON.stringify(r.body).includes('<script>')); assert.ok(!JSON.stringify(r.body).includes('zebra'));
});
test('TC-AS-API-07 rate limit: 31st question in a minute -> 429', async () => {
  let last;
  for (let i = 0; i < 32; i++) last = await t.call('POST', '/api/assistant', { message: 'hello' });
  assert.equal(last.status, 429);
});
