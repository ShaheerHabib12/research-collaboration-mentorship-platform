'use strict';
/** Team contribution A tests. TEAM: when your function is ready, change `describe` to `describe` on the next line. */
const assert = require('node:assert/strict');
const { normaliseTags } = require('../../shared/contrib/tags');
const suite = describe;

suite('TC-CA: normaliseTags (team contribution A)', () => {
  test('TC-CA-01 trims and lower-cases every tag', () => {
    assert.deepEqual(normaliseTags(['  Machine Learning ', 'NLP']), ['machine learning', 'nlp']);
  });
  test('TC-CA-02 accepts one comma-separated string and squeezes inner spaces', () => {
    assert.deepEqual(normaliseTags('AI, ethics ,  Data    Science'), ['ai', 'ethics', 'data science']);
  });
  test('TC-CA-03 removes duplicates whatever the case, keeping the first', () => {
    assert.deepEqual(normaliseTags(['AI', 'ai', ' Ai ', 'ml']), ['ai', 'ml']);
  });
  test('TC-CA-04 drops empty tags', () => {
    assert.deepEqual(normaliseTags(['', '   ', 'x']), ['x']);
    assert.deepEqual(normaliseTags('a,,b, ,c'), ['a', 'b', 'c']);
  });
  test('TC-CA-05 drops tags longer than 30 characters but keeps exactly 30', () => {
    assert.deepEqual(normaliseTags(['a'.repeat(31), 'b'.repeat(30)]), ['b'.repeat(30)]);
  });
  test('TC-CA-06 returns at most 8 tags (the first 8)', () => {
    const ten = Array.from({ length: 10 }, (_, i) => 't' + (i + 1));
    assert.deepEqual(normaliseTags(ten), ten.slice(0, 8));
  });
  test('TC-CA-07 anything that is not an array or a string gives an empty list; non-string items are ignored', () => {
    for (const bad of [null, undefined, 42, {}, true]) assert.deepEqual(normaliseTags(bad), []);
    assert.deepEqual(normaliseTags([1, null, 'ok', {}]), ['ok']);
  });
  test('TC-CA-08 does not change the array it is given', () => {
    const input = [' A ', 'a'];
    normaliseTags(input);
    assert.deepEqual(input, [' A ', 'a']);
  });
});
