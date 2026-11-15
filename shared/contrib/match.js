'use strict';
/**
 * Team contribution B - matchScore(skills, tags)
 * Owner: Rana Muhammad Sami Noon (Up2601149)
 * Used for: ranking projects on the Discover page by how well they fit a person's skills.
 *
 * Rules (the tests in tests/contrib/match.test.js check every one):
 *  1. skills and tags are arrays of strings. Compare them trimmed and in lower case, ignoring empty and non-string items.
 *  2. Repeated items count once (a set).
 *  3. score = round(100 x shared / total), where shared = items in both sets and total = items in either set.
 *  4. If there are no items at all, or either input is not an array, the score is 0.
 *  5. The result is a whole number from 0 to 100.
 */
const clean = (a) => new Set(
  Array.isArray(a)
    ? a.filter((x) => typeof x === 'string').map((x) => x.trim().toLowerCase()).filter(Boolean)
    : []
);
function matchScore(skills, tags) {
  if (!Array.isArray(skills) || !Array.isArray(tags)) return 0;
  const a = clean(skills);
  const b = clean(tags);
  const all = new Set([...a, ...b]);
  if (!all.size) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return Math.round((100 * shared) / all.size);
}
module.exports = { matchScore };
