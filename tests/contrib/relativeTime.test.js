'use strict';
/** Team contribution C tests. TEAM: when your function is ready, change `describe.skip` to `describe` on the next line. */
const assert = require('node:assert/strict');
const { relativeTime } = require('../../shared/contrib/relativeTime');
const suite = describe.skip;

const NOW = new Date('2026-11-15T12:00:00Z');
const ago = (seconds) => new Date(NOW.getTime() - seconds * 1000);

suite('TC-CC: relativeTime (team contribution C)', () => {
  test('TC-CC-01 under a minute, and any time in the future, is "just now"', () => {
    assert.equal(relativeTime(ago(30), NOW), 'just now');
    assert.equal(relativeTime(ago(-300), NOW), 'just now');
  });
  test('TC-CC-02 minutes (rounded down, singular at 1)', () => {
    assert.equal(relativeTime(ago(60), NOW), '1 minute ago');
    assert.equal(relativeTime(ago(125), NOW), '2 minutes ago');
    assert.equal(relativeTime(ago(3599), NOW), '59 minutes ago');
  });
  test('TC-CC-03 hours (rounded down, singular at 1)', () => {
    assert.equal(relativeTime(ago(3600), NOW), '1 hour ago');
    assert.equal(relativeTime(ago(5 * 3600), NOW), '5 hours ago');
    assert.equal(relativeTime(ago(24 * 3600 - 1), NOW), '23 hours ago');
  });
  test('TC-CC-04 24 to 47 hours is "yesterday"', () => {
    assert.equal(relativeTime(ago(24 * 3600), NOW), 'yesterday');
    assert.equal(relativeTime(ago(47 * 3600), NOW), 'yesterday');
  });
  test('TC-CC-05 two to 29 days', () => {
    assert.equal(relativeTime(ago(48 * 3600), NOW), '2 days ago');
    assert.equal(relativeTime(ago(29 * 86400), NOW), '29 days ago');
  });
  test('TC-CC-06 30 days or more gives the date as YYYY-MM-DD', () => {
    assert.equal(relativeTime(ago(30 * 86400), NOW), '2026-10-16');
    assert.equal(relativeTime('2025-01-02T23:59:00Z', NOW), '2025-01-02');
  });
  test('TC-CC-07 accepts a Date, an ISO string or milliseconds', () => {
    assert.equal(relativeTime(ago(7200), NOW), '2 hours ago');
    assert.equal(relativeTime('2026-11-15T10:00:00Z', NOW), '2 hours ago');
    assert.equal(relativeTime(NOW.getTime() - 7200000, NOW.getTime()), '2 hours ago');
  });
  test('TC-CC-08 an invalid date gives empty text', () => {
    assert.equal(relativeTime('not a date', NOW), '');
    assert.equal(relativeTime(undefined, NOW), '');
  });
});
