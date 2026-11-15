const assert = require('node:assert/strict');
const R = require('../shared/rules.js');

test('TC-R01 request: only pending can move (NFR-009)', () => {
  assert.equal(R.canTransitionRequest('pending', 'accepted'), true);
  assert.equal(R.canTransitionRequest('pending', 'declined'), true);
  assert.equal(R.canTransitionRequest('pending', 'withdrawn'), true);
  assert.equal(R.canTransitionRequest('accepted', 'declined'), false);
  assert.equal(R.canTransitionRequest('declined', 'accepted'), false);
});
test('TC-R02 request: recipient accepts, sender withdraws', () => {
  const req = { from: 'A', to: 'B' };
  assert.equal(R.canActOnRequest('accepted', req, 'B'), true);
  assert.equal(R.canActOnRequest('accepted', req, 'A'), false);
  assert.equal(R.canActOnRequest('withdrawn', req, 'A'), true);
  assert.equal(R.canActOnRequest('withdrawn', req, 'B'), false);
});
test('TC-R03 allowance: used, remaining, blocked; returned requests free allowance', () => {
  const plan = { allowance: 2 };
  let s = R.allowanceSummary(plan, [{ status: 'pending' }, { status: 'completed' }]);
  assert.deepEqual([s.used, s.remaining, s.blocked], [2, 0, true]);
  s = R.allowanceSummary(plan, [{ status: 'pending' }, { status: 'declined' }, { status: 'withdrawn' }]);
  assert.deepEqual([s.used, s.remaining, s.blocked], [1, 1, false]);
  assert.equal(R.allowanceSummary(null, []).blocked, true);
});
test('TC-R04 compensation: weighted bonus', () => {
  const r = R.calcCompensation({ base: 400, completed: 5, target: 10, feedback: [5, 5, 5], active: true });
  // 300 * (0.7*0.5 + 0.3*1) = 195
  assert.equal(r.bonus, 195);
  assert.equal(r.total, 595);
  assert.equal(r.needsReview, false);
});
test('TC-R05 compensation: ratio capped at 1', () => {
  const r = R.calcCompensation({ base: 0, completed: 50, target: 10, feedback: [5, 5, 5], active: true });
  assert.equal(r.bonus, 300);
});
test('TC-R06 compensation: <3 feedback or inactive -> bonus 0 and flagged', () => {
  const a = R.calcCompensation({ base: 400, completed: 10, target: 10, feedback: [5, 5], active: true });
  assert.equal(a.bonus, 0); assert.equal(a.needsReview, true);
  const b = R.calcCompensation({ base: 400, completed: 10, target: 10, feedback: [5, 5, 5], active: false });
  assert.equal(b.bonus, 0); assert.equal(b.needsReview, true);
  assert.equal(b.total, 400);
});
test('TC-R07 compensation: missing target flagged, never silent', () => {
  const r = R.calcCompensation({ base: 100, completed: 1, target: 0, feedback: [4, 4, 4], active: true });
  assert.equal(r.needsReview, true);
  assert.equal(r.bonus, 0);
});
test('TC-R08 statement: cannot be paid without approval', () => {
  assert.equal(R.canTransitionStatement('draft', 'paid'), false);
  assert.equal(R.canTransitionStatement('awaiting_approval', 'paid'), false);
  assert.equal(R.canTransitionStatement('approved', 'paid'), true);
  assert.equal(R.canTransitionStatement('approved', 'payout_failed'), true);
  assert.equal(R.canTransitionStatement('paid', 'approved'), false);
});
test('TC-R09 filterAndPage: search, skills, pagination', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ t: 'Item ' + i, s: i % 2 ? ['NLP'] : ['Stats'] }));
  const hay = (x) => x.t, sk = (x) => x.s;
  const p1 = R.filterAndPage(items, {}, 1, 10, hay, sk);
  assert.equal(p1.total, 25); assert.equal(p1.pages, 3); assert.equal(p1.items.length, 10);
  assert.equal(R.filterAndPage(items, {}, 3, 10, hay, sk).items.length, 5);
  assert.equal(R.filterAndPage(items, { q: 'item 2' }, 1, 10, hay, sk).total, 6);
  assert.equal(R.filterAndPage(items, { skills: ['nlp'] }, 1, 50, hay, sk).total, 12);
  assert.equal(R.filterAndPage(items, {}, 99, 10, hay, sk).page, 3);
});
test('TC-R10 field visibility (FR-005)', () => {
  assert.equal(R.canViewField('private', 'B', 'A', true), false);
  assert.equal(R.canViewField('private', 'A', 'A', false), true);
  assert.equal(R.canViewField('team', 'B', 'A', true), true);
  assert.equal(R.canViewField('team', 'B', 'A', false), false);
  assert.equal(R.canViewField('public', 'B', 'A', false), true);
});
test('TC-R11 notifications: essential bypass pause and category off', () => {
  const now = Date.now(), prefs = { pausedUntil: new Date(now + 3600e3).toISOString(), categories: { projects: false } };
  assert.equal(R.shouldDeliverNotification({ essential: true, category: 'projects' }, prefs, now), true);
  assert.equal(R.shouldDeliverNotification({ essential: false, category: 'requests' }, prefs, now), false);
  assert.equal(R.shouldDeliverNotification({ essential: false, category: 'projects' }, { categories: { projects: false } }, now), false);
  assert.equal(R.shouldDeliverNotification({ essential: false, category: 'requests' }, {}, now), true);
});
