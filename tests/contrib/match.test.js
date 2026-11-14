'use strict';
/** Team contribution B tests. TEAM: when your function is ready, change `describe.skip` to `describe` on the next line. */
const assert = require('node:assert/strict');
const { matchScore } = require('../../shared/contrib/match');
const suite = describe.skip;

suite('TC-CB: matchScore (team contribution B)', () => {
  test('TC-CB-01 the same skills and tags score 100', () => {
    assert.equal(matchScore(['ml', 'nlp'], ['nlp', 'ml']), 100);
  });
  test('TC-CB-02 nothing in common scores 0', () => {
    assert.equal(matchScore(['ml'], ['biology']), 0);
  });
  test('TC-CB-03 partial overlap: 1 shared of 4 different items is 25', () => {
    assert.equal(matchScore(['ml', 'nlp', 'ethics'], ['ML', 'vision']), 25);
  });
  test('TC-CB-04 ignores case and surrounding spaces', () => {
    assert.equal(matchScore([' Python '], ['python']), 100);
  });
  test('TC-CB-05 empty lists score 0, whether one side or both', () => {
    assert.equal(matchScore([], []), 0);
    assert.equal(matchScore(['ml'], []), 0);
    assert.equal(matchScore([], ['ml']), 0);
  });
  test('TC-CB-06 repeated items count once', () => {
    assert.equal(matchScore(['ai', 'ai', 'ai'], ['ai', 'ml']), 50);
  });
  test('TC-CB-07 the score is rounded to a whole number', () => {
    assert.equal(matchScore(['a', 'b', 'c'], ['a']), 33);
    assert.equal(matchScore(['a', 'b'], ['a', 'b', 'c']), 67);
  });
  test('TC-CB-08 bad input scores 0 and empty or non-string items are ignored', () => {
    assert.equal(matchScore(null, ['a']), 0);
    assert.equal(matchScore('a', 'a'), 0);
    assert.equal(matchScore(['a', '', 5, null], ['a']), 100);
  });
});
