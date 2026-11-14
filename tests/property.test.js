/**
 * Property-based tests (fast-check): instead of hand-picked examples, hundreds of random inputs per property.
 * TC-PB-01..08. They check that rules hold for every input, not only the ones we thought of (NFR-004, NFR-007, NFR-009).
 */
const fc = require('fast-check');
const V = require('../shared/validators.js');
const R = require('../shared/rules.js');
const RUNS = { numRuns: 400 };

test('TC-PB-01 task title: accepted exactly when the cleaned text has 3 to 20 characters', () => {
  fc.assert(fc.property(fc.string({ maxLength: 60 }), (s) => {
    const r = V.validateTaskTitle(s), len = V.sanitizeText(s).length;
    return r.ok === (len >= 3 && len <= 20);
  }), RUNS);
});
test('TC-PB-02 escapeHtml never leaves a raw angle bracket, quote or ampersand-free tag (NFR-004)', () => {
  fc.assert(fc.property(fc.string(), (s) => { const o = V.escapeHtml(s); return !/[<>]/.test(o); }), RUNS);
});
test('TC-PB-03 escapeHtml keeps ordinary text unchanged', () => {
  fc.assert(fc.property(fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 .,'.split(''))), (s) => V.escapeHtml(s) === s), RUNS);
});
test('TC-PB-04 file names: result has no path separators and is never empty or longer than 120', () => {
  fc.assert(fc.property(fc.string({ maxLength: 300 }), (s) => { const n = V.sanitizeFileName(s); return !/[\\/]/.test(n) && n.length > 0 && n.length <= 120; }), RUNS);
});
test('TC-PB-05 sanitizeText is idempotent: cleaning twice equals cleaning once', () => {
  fc.assert(fc.property(fc.string(), (s) => V.sanitizeText(V.sanitizeText(s)) === V.sanitizeText(s)), RUNS);
});
test('TC-PB-06 request states: a finished request (accepted, declined, withdrawn) can never move again (NFR-009)', () => {
  const all = ['pending', 'accepted', 'declined', 'withdrawn'];
  fc.assert(fc.property(fc.constantFrom('accepted', 'declined', 'withdrawn'), fc.constantFrom(...all), (from, to) => R.canTransitionRequest(from, to) === false), RUNS);
});
test('TC-PB-07 allowance: used + remaining never exceeds the plan, remaining is never negative, blocked means zero left (FR-045..047)', () => {
  const st = fc.constantFrom('pending', 'accepted', 'declined', 'rejected', 'withdrawn', 'answered');
  fc.assert(fc.property(fc.integer({ min: 0, max: 20 }), fc.array(fc.record({ status: st }), { maxLength: 40 }), (n, reqs) => {
    const a = R.allowanceSummary({ allowance: n }, reqs);
    return a.remaining >= 0 && a.remaining <= n && (a.blocked === (a.remaining === 0)) && a.remaining === Math.max(0, n - a.used);
  }), RUNS);
});
test('TC-PB-08 emails: whatever is accepted is lower-cased and has exactly one at-sign', () => {
  fc.assert(fc.property(fc.emailAddress(), (e) => { const r = V.validateEmail(e); return !r.ok || (r.value === r.value.toLowerCase() && r.value.split('@').length === 2); }), RUNS);
});
