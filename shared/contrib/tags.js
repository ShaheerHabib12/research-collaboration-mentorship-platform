'use strict';
/**
 * Team contribution A - normaliseTags(input)
 * Owner: _____________________ (write your name and student number here)
 * Used for: skill and topic tags on projects and profiles, so "Machine  Learning" and "machine learning" are one tag.
 *
 * Rules (the tests in tests/contrib/tags.test.js check every one):
 *  1. input is an array of strings OR one comma-separated string. Anything else gives [].
 *  2. Each tag is trimmed, made lower case, and runs of spaces inside it become one space.
 *  3. Empty tags are dropped. Tags longer than 30 characters (after cleaning) are dropped.
 *  4. Duplicates are removed (keep the first). Non-string items in an array are ignored.
 *  5. At most 8 tags are returned (the first 8).
 *  6. The input is never changed.
 */
function normaliseTags(input) {
  // TODO (member A): write your code here, then follow docs/CONTRIBUTING_STEPS.md.
  throw new Error('normaliseTags is not written yet');
}

module.exports = { normaliseTags };
