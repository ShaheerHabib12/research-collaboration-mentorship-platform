'use strict';
/**
 * Team contribution B - matchScore(skills, tags)
 * Owner: _____________________ (write your name and student number here)
 * Used for: ranking projects on the Discover page by how well they fit a person's skills.
 *
 * Rules (the tests in tests/contrib/match.test.js check every one):
 *  1. skills and tags are arrays of strings. Compare them trimmed and in lower case, ignoring empty and non-string items.
 *  2. Repeated items count once (a set).
 *  3. score = round(100 x shared / total), where shared = items in both sets and total = items in either set.
 *  4. If there are no items at all, or either input is not an array, the score is 0.
 *  5. The result is a whole number from 0 to 100.
 */
function matchScore(skills, tags) {
  // TODO (member B): write your code here, then follow docs/CONTRIBUTING_STEPS.md.
  throw new Error('matchScore is not written yet');
}

module.exports = { matchScore };
