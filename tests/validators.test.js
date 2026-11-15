const assert = require('node:assert/strict');
const V = require('../shared/validators.js');

test('TC-V01 task title: 3-20 characters', () => {
  assert.equal(V.validateTaskTitle('ab').ok, false);
  assert.equal(V.validateTaskTitle('abc').ok, true);
  assert.equal(V.validateTaskTitle('a'.repeat(20)).ok, true);
  assert.equal(V.validateTaskTitle('a'.repeat(21)).ok, false);
});
test('TC-V02 task description: max 250 characters', () => {
  assert.equal(V.validateTaskDescription('x'.repeat(250)).ok, true);
  assert.equal(V.validateTaskDescription('x'.repeat(251)).ok, false);
  assert.equal(V.validateTaskDescription('').ok, true);
});
test('TC-V03 tags: at most 3, no duplicates, valid characters', () => {
  assert.equal(V.validateTags([]).ok, true);
  assert.equal(V.validateTags(['NLP', 'R', 'C++'].slice(0, 1).concat(['Stats', 'Python'])).ok, true);
  assert.equal(V.validateTags(['aa', 'bb', 'cc', 'dd']).ok, false);
  assert.equal(V.validateTags(['Stats', 'stats']).ok, false);
  assert.equal(V.validateTags(['bad!']).ok, false);
  assert.deepEqual(V.validateTags(['<b>']).value, []); // markup is stripped, never stored
});
test('TC-V04 file: exactly 10 MiB accepted, 10.1 MB rejected with 413', () => {
  const max = 10 * 1024 * 1024;
  assert.equal(V.validateFile({ name: 'data.csv', size: max }).ok, true);
  const big = V.validateFile({ name: 'data.csv', size: Math.round(10.1 * 1024 * 1024) });
  assert.equal(big.ok, false);
  assert.equal(big.status, 413);
});
test('TC-V05 file: unsupported type and empty file rejected', () => {
  assert.equal(V.validateFile({ name: 'run.exe', size: 10 }).ok, false);
  assert.equal(V.validateFile({ name: 'a.pdf', size: 0 }).ok, false);
  assert.equal(V.validateFile(null).ok, false);
});
test('TC-V06 file name sanitising strips paths', () => {
  assert.equal(V.sanitizeFileName('../../etc/passwd'), 'passwd');
  assert.equal(V.sanitizeFileName('a<b>.pdf'), 'a_b_.pdf');
});
test('TC-V07 escapeHtml neutralises script injection (NFR-004)', () => {
  const out = V.escapeHtml('<img src=x onerror=alert(1)>');
  assert.ok(!out.includes('<'));
  assert.ok(out.includes('&lt;'));
});
test('TC-V08 email', () => {
  assert.equal(V.validateEmail('aisha@port.ac.uk').ok, true);
  assert.equal(V.validateEmail('nope').ok, false);
  assert.equal(V.validateEmail('').ok, false);
});
test('TC-V09 password rules and strength', () => {
  assert.equal(V.validatePassword('short').ok, false);
  assert.equal(V.validatePassword('Demo@1234').ok, true);
  assert.ok(V.passwordStrength('Demo@1234') >= V.passwordStrength('abc') );
});
