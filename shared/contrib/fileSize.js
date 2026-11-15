'use strict';

/**
 * Team contribution D - formatFileSize(bytes)
 * Owner: Hafiz Muhammad Abu Hurraira (Up2601139)
 * Used for: showing the size of a file a user uploaded to a project ("1.5 MB" instead of "1572864").
 *
 * Rules (the tests in tests/contrib/fileSize.test.js check every one). Sizes use 1024 steps and the units B, KB, MB, GB:
 * 1. If bytes is not a number, is not finite (NaN, Infinity) or is below 0, return '' (empty text).
 * 2. Under 1024 bytes: whole bytes, rounded down, then ' B'. Example: 512 gives '512 B'.
 * 3. From 1024 bytes: divide by 1024 until the value is under 1024 or the unit is GB.
 * 4. Round that value to one decimal place. Show '1' not '1.0'. Examples: '1 KB', '1.5 KB', '976.6 KB', '2.5 GB'.
 * 5. Anything of 1 GB or more stays in GB (so one terabyte is '1024 GB').
 */

function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return Math.floor(bytes) + ' B';
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return (Math.round(value * 10) / 10) + ' ' + units[i];
}

module.exports = { formatFileSize };
