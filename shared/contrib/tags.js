'use strict';

/**
 * Team contribution A - normaliseTags(input)
 * Owner: Muhammad Rameel Khan (Up2601145)
 * Used for: skill and topic tags on projects and profiles, so "Machine Learning" and "machine learning" are one tag.
 *
 * Rules (the tests in tests/contrib/tags.test.js check every one):
 * 1. input is an array of strings OR one comma-separated string. Anything else gives [].
 * 2. Each tag is trimmed, made lower case, and runs of spaces inside it become one space.
 * 3. Empty tags are dropped. Tags longer than 30 characters (after cleaning) are dropped.
 * 4. Duplicates are removed (keep the first). Non-string items in an array are ignored.
 * 5. At most 8 tags are returned (the first 8).
 * 6. The input is never changed.
 */
function normaliseTags(input) {
  const list = typeof input === 'string' ? input.split(',') : Array.isArray(input) ? input : [];
  const out = [];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!t || t.length > 30 || out.includes(t)) continue;
    out.push(t);
    if (out.length === 8) break;
  }
  return out;
}

module.exports = { normaliseTags };
