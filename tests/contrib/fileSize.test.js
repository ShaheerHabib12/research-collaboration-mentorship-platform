'use strict';
/** Team contribution D tests. TEAM: when your function is ready, change `describe` to `describe` on the next line. */
const assert = require('node:assert/strict');
const { formatFileSize } = require('../../shared/contrib/fileSize');
const suite = describe;

suite('TC-CD: formatFileSize (team contribution D)', () => {
  test('TC-CD-01 under 1024 bytes shows whole bytes', () => {
    assert.equal(formatFileSize(0), '0 B');
    assert.equal(formatFileSize(512), '512 B');
    assert.equal(formatFileSize(1023), '1023 B');
  });
  test('TC-CD-02 kilobytes, with one decimal only when needed', () => {
    assert.equal(formatFileSize(1024), '1 KB');
    assert.equal(formatFileSize(1536), '1.5 KB');
  });
  test('TC-CD-03 megabytes', () => {
    assert.equal(formatFileSize(1048576), '1 MB');
    assert.equal(formatFileSize(1572864), '1.5 MB');
    assert.equal(formatFileSize(5242880), '5 MB');
  });
  test('TC-CD-04 gigabytes', () => {
    assert.equal(formatFileSize(1073741824), '1 GB');
    assert.equal(formatFileSize(2.5 * 1024 ** 3), '2.5 GB');
  });
  test('TC-CD-05 one terabyte stays in GB', () => {
    assert.equal(formatFileSize(1024 ** 4), '1024 GB');
  });
  test('TC-CD-06 rounds to one decimal place', () => {
    assert.equal(formatFileSize(1234), '1.2 KB');
    assert.equal(formatFileSize(1000000), '976.6 KB');
  });
  test('TC-CD-07 bad input gives empty text', () => {
    for (const bad of [-1, NaN, Infinity, '12', null, undefined, {}]) assert.equal(formatFileSize(bad), '');
  });
  test('TC-CD-08 part of a byte is rounded down', () => {
    assert.equal(formatFileSize(10.9), '10 B');
  });
});
