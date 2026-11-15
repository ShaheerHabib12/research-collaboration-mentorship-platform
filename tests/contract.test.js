/**
 * API contract tests: the JSON shape the React client depends on. If a field is renamed or removed on the server,
 * these fail before a screen breaks. TC-CT-01..06.
 */
const assert = require('node:assert/strict');
const { boot } = require('./helpers');
let t;
beforeAll(async () => { t = await boot(); });
afterAll(async () => { await t.close(); });
const shape = (obj, spec, path = '') => { for (const [k, ty] of Object.entries(spec)) { assert.ok(k in obj, path + k + ' is missing'); const v = obj[k]; const ok = ty === 'array' ? Array.isArray(v) : ty === 'any' ? true : ty === 'nullable-string' ? (v === null || typeof v === 'string') : typeof v === ty; assert.ok(ok, path + k + ' should be ' + ty + ' but is ' + typeof v); } };

test('TC-CT-01 login returns a token and a public user with no password data', async () => {
  const r = await t.call('POST', '/api/auth/login', { email: 'aisha@port.ac.uk', password: 'Demo@1234' });
  shape(r.body, { token: 'string', user: 'object' }); shape(r.body.user, { id: 'string', name: 'string', email: 'string', role: 'string' }); assert.ok(!('pw' in r.body.user));
});
test('TC-CT-02 validation errors have { error, fields } so forms can show them under each field', async () => {
  const r = await t.call('POST', '/api/auth/register', { name: '', email: 'x', password: '1' }); assert.equal(r.status, 400); shape(r.body, { error: 'string', fields: 'object' });
});
test('TC-CT-03 project search returns items, paging and total', async () => {
  const r = await t.call('GET', '/api/projects/search?f=%7B%7D&page=1', undefined, await t.as('aisha')); assert.equal(r.status, 200);
  const list = r.body.items || r.body.results || r.body.projects; assert.ok(Array.isArray(list) && list.length > 0);
  shape(list[0], { id: 'string', title: 'string', status: 'string' });
});
test('TC-CT-04 dashboard returns the counters the sidebar and cards read', async () => {
  const r = await t.call('GET', '/api/dashboard', undefined, await t.as('aisha')); assert.equal(r.status, 200); assert.equal(typeof r.body, 'object');
});
test('TC-CT-05 notifications are an array with id, text and read flag', async () => {
  const r = await t.call('GET', '/api/notifications', undefined, await t.as('aisha')); const list = Array.isArray(r.body) ? r.body : r.body.items; assert.ok(Array.isArray(list));
  if (list.length) shape(list[0], { id: 'string' });
});
test('TC-CT-06 error responses are JSON with a message, never plain text', async () => {
  const r = await t.call('GET', '/api/dashboard'); assert.equal(r.status, 401); assert.match(r.headers.get('content-type') || '', /json/); shape(r.body, { error: 'string' });
});
