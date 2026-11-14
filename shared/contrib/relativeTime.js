'use strict';
/**
 * Team contribution C - relativeTime(date, now)
 * Owner: _____________________ (write your name and student number here)
 * Used for: the activity lists ("2 hours ago") instead of long date strings.
 *
 * date and now may each be a Date, an ISO string or a number of milliseconds. now defaults to the current time.
 * Rules (the tests in tests/contrib/relativeTime.test.js check every one). Let d = now - date:
 *  1. An invalid date gives '' (empty text).
 *  2. d under 60 seconds, or a date in the future: 'just now'
 *  3. under 60 minutes: '1 minute ago', '2 minutes ago' ... (whole minutes, rounded down)
 *  4. under 24 hours:   '1 hour ago', '2 hours ago' ...
 *  5. 24 hours up to (not including) 48 hours: 'yesterday'
 *  6. under 30 days:    '2 days ago' ... '29 days ago'
 *  7. 30 days or more:  the date as YYYY-MM-DD (UTC), for example '2026-10-16'
 */
function relativeTime(date, now) {
  // TODO (member C): write your code here, then follow docs/CONTRIBUTING_STEPS.md.
  throw new Error('relativeTime is not written yet');
}

module.exports = { relativeTime };
