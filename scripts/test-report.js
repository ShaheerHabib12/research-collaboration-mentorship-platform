/**
 * test-report.js - runs the whole Jest suite and writes the evidence the marking criteria ask for (docs/evidence/):
 *   TEST_REPORT.txt      every test case with pass/fail and duration, plus the totals
 *   COVERAGE_REPORT.txt  line/branch/function/statement coverage per server and shared file
 *   test-results.json    machine-readable results (used by the documentation build)
 *   npm run report
 */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..'), out = path.join(root, 'docs', 'evidence');
fs.mkdirSync(out, { recursive: true });
const json = path.join(out, 'test-results.json');
const r = spawnSync(process.execPath, [path.join(root, 'node_modules', 'jest', 'bin', 'jest.js'), '--runInBand', '--coverage', '--coverageReporters=text', '--coverageReporters=json-summary', '--json', '--outputFile=' + json], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
const stamp = '# Generated ' + new Date().toISOString() + ' on Node ' + process.version + '\n';
let res = null; try { res = JSON.parse(fs.readFileSync(json, 'utf8')); } catch (e) { /* jest crashed */ }
let txt = stamp;
if (res) {
  for (const f of res.testResults.sort((a, b) => a.name.localeCompare(b.name))) {
    txt += '\n' + path.relative(root, f.name) + '  (' + (f.endTime - f.startTime) + ' ms)\n';
    for (const t of f.assertionResults) txt += '  ' + (t.status === 'passed' ? 'PASS' : t.status === 'pending' ? 'SKIP' : 'FAIL') + '  ' + t.fullName + '  [' + (t.duration == null ? '-' : t.duration) + ' ms]\n';
  }
  txt += '\nTest suites: ' + res.numPassedTestSuites + ' passed, ' + res.numFailedTestSuites + ' failed, ' + res.numTotalTestSuites + ' total\n';
  txt += 'Tests:       ' + res.numPassedTests + ' passed, ' + res.numFailedTests + ' failed, ' + res.numPendingTests + ' skipped, ' + res.numTotalTests + ' total\n';
} else txt += r.stdout + r.stderr;
fs.writeFileSync(path.join(out, 'TEST_REPORT.txt'), txt);
const m = (r.stdout + r.stderr).match(/-{5,}\|[\s\S]*?\n-{5,}\|[^\n]*\n(?:[^\n]*\n)*?-{5,}\|[^\n]*\n?/);
fs.writeFileSync(path.join(out, 'COVERAGE_REPORT.txt'), stamp + (m ? m[0] : 'coverage unavailable\n' + (r.stderr || '').slice(-2000)) + '\n');
console.log('Wrote docs/evidence/TEST_REPORT.txt and COVERAGE_REPORT.txt; suite exit code ' + r.status);
process.exit(r.status || 0);
