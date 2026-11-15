/** Exact-value tests for the compensation formula, flags, statement states and search paging. TC-R12..R18 (raise the mutation score). */
const assert = require('node:assert/strict');
const R = require('../shared/rules.js');
const ok = { base: 1000, completed: 8, target: 10, feedback: [5, 4, 3], active: true };

test('TC-R12 bonus formula: 300 x (0.7 x ratio + 0.3 x average/5), parts and total rounded to pence', () => {
  const r = R.calcCompensation(ok);
  assert.equal(r.completedRatio, 0.8); assert.equal(r.feedbackAvg, 4); assert.equal(r.requestsPart, 168); assert.equal(r.feedbackPart, 72); assert.equal(r.bonus, 240); assert.equal(r.total, 1240); assert.deepEqual(r.flags, []); assert.equal(r.needsReview, false); assert.equal(r.feedbackCount, 3);
});
test('TC-R13 only ratings 1 to 5 count: 0 and 6 are ignored, not averaged in', () => {
  const r = R.calcCompensation({ ...ok, feedback: [5, 5, 5, 0, 6, -1] }); assert.equal(r.feedbackCount, 3); assert.equal(r.feedbackAvg, 5);
  assert.equal(R.calcCompensation({ ...ok, feedback: [1, 5, 1, 5] }).feedbackAvg, 3);
});
test('TC-R14 each missing input raises its own flag, and the statement needs review', () => {
  assert.ok(R.calcCompensation({ ...ok, base: null }).flags.includes('Missing agreed base compensation'));
  assert.ok(R.calcCompensation({ ...ok, base: NaN }).flags.includes('Missing agreed base compensation')); assert.equal(R.calcCompensation({ ...ok, base: null }).total, R.calcCompensation({ ...ok, base: null }).bonus);
  for (const t of [null, 0, -3]) assert.ok(R.calcCompensation({ ...ok, target: t }).flags.includes('Missing contribution target'), String(t));
  assert.equal(R.calcCompensation({ ...ok, target: null }).bonus, 0);
  assert.ok(R.calcCompensation({ ...ok, active: false }).flags.includes('Researcher inactive in period - bonus not applied')); assert.equal(R.calcCompensation({ ...ok, active: false }).bonus, 0);
  const few = R.calcCompensation({ ...ok, feedback: [5, 5] }); assert.ok(few.flags.includes('Fewer than 3 feedback responses - bonus not applied')); assert.equal(few.bonus, 0); assert.equal(few.needsReview, true);
  assert.equal(R.calcCompensation({ ...ok, feedback: [5, 5, 5] }).flags.length, 0, 'exactly the minimum is enough');
});
test('TC-R15 completed work above the target is capped at a ratio of 1, so the bonus cannot exceed the cap', () => {
  const r = R.calcCompensation({ ...ok, completed: 50, feedback: [5, 5, 5] }); assert.equal(r.completedRatio, 1); assert.equal(r.bonus, 300);
  assert.equal(R.calcCompensation({ ...ok, completed: 0, feedback: [5, 5, 5] }).bonus, 90);
});
test('TC-R16 a custom configuration is honoured (weights, cap, minimum feedback)', () => {
  const r = R.calcCompensation(ok, { weightRequests: 0.5, weightFeedback: 0.5, bonusCap: 100, minFeedback: 2 }); assert.equal(r.bonus, 100 * (0.5 * 0.8 + 0.5 * 0.8));
  assert.ok(R.calcCompensation({ ...ok, feedback: [5] }, { weightRequests: 0.7, weightFeedback: 0.3, bonusCap: 300, minFeedback: 2 }).flags.some((f) => f.startsWith('Fewer than 2')));
  assert.equal(R.calcCompensation({ base: 5, completed: 1, target: 1, active: true }).feedbackCount, 0, 'missing feedback list');
});
test('TC-R17 statement states: every legal move allowed, every other refused (cannot be paid without approval)', () => {
  const legal = [['draft', 'awaiting_approval'], ['awaiting_approval', 'approved'], ['awaiting_approval', 'draft'], ['approved', 'paid'], ['approved', 'payout_failed'], ['payout_failed', 'approved']];
  const all = ['draft', 'awaiting_approval', 'approved', 'payout_failed', 'paid', 'nonsense'];
  for (const f of all) for (const t of all) assert.equal(R.canTransitionStatement(f, t), legal.some(([a, b]) => a === f && b === t), f + ' -> ' + t);
});
test('TC-R18 request moves and who may make them: recipient accepts or declines, sender withdraws', () => {
  assert.equal(R.canActOnRequest('withdrawn', { from: 'A', to: 'B' }, 'A'), true); assert.equal(R.canActOnRequest('withdrawn', { from: 'A', to: 'B' }, 'B'), false);
  for (const to of ['accepted', 'declined']) { assert.equal(R.canActOnRequest(to, { from: 'A', to: 'B' }, 'B'), true); assert.equal(R.canActOnRequest(to, { from: 'A', to: 'B' }, 'A'), false); }
  assert.equal(R.canTransitionRequest('pending', 'accepted'), true); assert.equal(R.canTransitionRequest('pending', 'pending'), false); assert.equal(R.canTransitionRequest('x', 'accepted'), false);
});
test('TC-R19 allowance: declined, rejected and withdrawn requests give the allowance back; other statuses use it', () => {
  const reqs = ['pending', 'accepted', 'answered', 'declined', 'rejected', 'withdrawn'].map((status) => ({ status }));
  const a = R.allowanceSummary({ allowance: 6 }, reqs); assert.equal(a.used, 3); assert.equal(a.remaining, 3); assert.equal(a.blocked, false);
  assert.deepEqual(R.allowanceSummary(null, []), { allowance: 0, used: 0, remaining: 0, blocked: true }); assert.equal(R.allowanceSummary({ allowance: 2 }, undefined).remaining, 2);
  assert.equal(R.allowanceSummary({ allowance: 1 }, [{ status: 'pending' }, { status: 'pending' }]).remaining, 0, 'never negative');
});
