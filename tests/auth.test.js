/** Unit tests: password hashing, JWT and encrypted storage (NFR-001, NFR-002, NFR-016). */
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
process.env.RCMP_BCRYPT_ROUNDS = '4';
const Auth = require('../server/auth');
const { createStorage } = require('../server/storage');
const SECRET = 'unit-test-secret-unit-test-secret';

test('TC-A01 password hash is salted bcrypt, never the raw password (NFR-002)', async () => {
  const a = await Auth.hashPassword('Demo@1234'), b = await Auth.hashPassword('Demo@1234');
  assert.match(a, /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
  assert.notEqual(a, b, 'same password must hash differently (random salt)');
  assert.ok(!a.includes('Demo@1234'));
});
test('TC-A02 verifyPassword accepts the right password and rejects others', async () => {
  const h = await Auth.hashPassword('Correct#Horse9');
  assert.equal(await Auth.verifyPassword('Correct#Horse9', h), true);
  assert.equal(await Auth.verifyPassword('correct#horse9', h), false);
  assert.equal(await Auth.verifyPassword('', h), false);
  assert.equal(await Auth.verifyPassword('x', null), false, 'unknown account never verifies');
  assert.equal(await Auth.verifyPassword('x', 'plaintext'), false);
});
test('TC-A03 JWT round trip carries the subject and expiry (8 h)', () => {
  const now = Date.now(), t = Auth.signToken('USR-101', SECRET, now), c = Auth.verifyToken(t, SECRET, now + 1000);
  assert.equal(c.sub, 'USR-101');
  assert.equal(c.exp - c.iat, 8 * 3600);
});
test('TC-A04 expired, forged and malformed tokens are rejected (401 path)', () => {
  const now = Date.now(), t = Auth.signToken('USR-101', SECRET, now);
  assert.equal(Auth.verifyToken(t, SECRET, now + 9 * 3600 * 1000), null, 'expired');
  assert.equal(Auth.verifyToken(t, 'another-secret-another-secret-12', now), null, 'wrong secret');
  const [h, b, s] = t.split('.');
  const forged = h + '.' + Buffer.from(JSON.stringify({ sub: 'USR-100', iat: 1, exp: 9999999999 })).toString('base64url') + '.' + s;
  assert.equal(Auth.verifyToken(forged, SECRET, now), null, 'payload tampered to admin');
  assert.equal(Auth.verifyToken('abc', SECRET), null);
  assert.equal(Auth.verifyToken('', SECRET), null);
  const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + b + '.';
  assert.equal(Auth.verifyToken(none, SECRET, now), null, 'alg=none rejected');
});
test('TC-A05 encrypted storage: round trip, ciphertext differs, tamper detected, ids are safe', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcmp-st-')), st = createStorage(dir, 'cd'.repeat(32));
  const data = Buffer.from('confidential research data '.repeat(20));
  st.put('FIL-9', data);
  const onDisk = fs.readFileSync(path.join(dir, 'FIL-9.bin'));
  assert.ok(!onDisk.includes(Buffer.from('confidential')), 'plaintext must not be on disk');
  assert.deepEqual(st.get('FIL-9'), data);
  onDisk[onDisk.length - 1] ^= 1; fs.writeFileSync(path.join(dir, 'FIL-9.bin'), onDisk);
  assert.throws(() => st.get('FIL-9'), 'GCM tag must catch tampering');
  assert.equal(st.get('missing'), null);
  assert.throws(() => st.put('../evil', data), /Invalid storage id/);
  st.remove('FIL-9'); assert.equal(st.has('FIL-9'), false);
  assert.throws(() => createStorage(dir, 'abcd'), /32 bytes/);
});
test('TC-A06 production seeding gives demo accounts a random password; development and RCMP_DEMO_LOGIN=1 keep the public one (NFR-001)', () => {
  const { demoSecret, DEMO_PASSWORD } = require('../server/seed');
  assert.equal(demoSecret({}), DEMO_PASSWORD);
  assert.equal(demoSecret({ NODE_ENV: 'development' }), DEMO_PASSWORD);
  assert.equal(demoSecret({ NODE_ENV: 'production', RCMP_DEMO_LOGIN: '1' }), DEMO_PASSWORD);
  const a = demoSecret({ NODE_ENV: 'production' }), b = demoSecret({ NODE_ENV: 'production' });
  assert.notEqual(a, DEMO_PASSWORD); assert.notEqual(a, b); assert.ok(a.length >= 32);
});
