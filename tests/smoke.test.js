/** Smoke tests: the fastest "is it alive" checks, run first in CI. TC-SM-01..04. */
const assert = require('node:assert/strict');
const { boot } = require('./helpers');
let t;
beforeAll(async () => { t = await boot(); });
afterAll(async () => { await t.close(); });
test('TC-SM-01 health endpoint reports the database is reachable', async () => { const r = await t.call('GET', '/api/health'); assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.equal(r.body.db, true); });
test('TC-SM-02 the built client is served at / and unknown client routes fall back to the app shell', async () => {
  for (const p of ['/', '/pricing', '/dashboard', '/some/unknown/route']) { const r = await t.call('GET', p); assert.equal(r.status, 200, p); assert.match((r.raw || '').toString(), /<div id="root">/); }
});
test('TC-SM-03 old page.html links redirect permanently to the clean route', async () => { const r = await t.call('GET', '/pricing.html'); assert.equal(r.status, 301); assert.equal(r.headers.get('location'), '/pricing'); });
test('TC-SM-04 each demo account can sign in', async () => { for (const k of ['aisha', 'elena', 'marcus', 'admin']) assert.ok(await t.as(k)); });
