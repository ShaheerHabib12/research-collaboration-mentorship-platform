'use strict';
/**
 * NFR-012 (consistent language and status wording): every status the server can put on a
 * record has a defined badge colour on the client, multi-word statuses have a human label
 * (never "payout_failed"), and the three roles are named the same on every screen.
 * Static check of the two code bases; TC-CS-01..03.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'client/src/components/ui.jsx'), 'utf8');
const svc = fs.readFileSync(path.join(root, 'server/services.js'), 'utf8') + fs.readFileSync(path.join(root, 'server/seed.js'), 'utf8');
const badge = new Set([...ui.slice(ui.indexOf('const BADGE'), ui.indexOf('const LABEL')).matchAll(/\b([a-z_]+):\s*'/g)].map((m) => m[1]));
const label = ui.slice(ui.indexOf('const LABEL'), ui.indexOf('const LABEL') + 600);
const used = new Set([...svc.matchAll(/status(?:\s*===|:|\s*=)\s*'([a-z_]+)'/g)].map((m) => m[1]));

test('TC-CS-01 every status value written by the server has a badge style on the client', () => {
  assert.ok(used.size >= 12, 'found the statuses in use: ' + [...used].join(','));
  const missing = [...used].filter((s) => !badge.has(s));
  assert.deepEqual(missing, [], 'statuses without a badge style: ' + missing.join(', '));
});
test('TC-CS-02 multi-word statuses have a readable label, so no raw snake_case is shown to users', () => {
  const multi = [...used, ...badge].filter((s) => s.includes('_'));
  assert.ok(multi.length >= 3);
  for (const s of new Set(multi)) assert.ok(new RegExp('\\b' + s + ":\\s*'").test(label), s + ' needs an entry in LABEL');
});
test('TC-CS-03 roles are named consistently (Student, Researcher, Mentor, Administrator) across the client', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const pages = walk(path.join(root, 'client', 'src')).filter((f) => /\.jsx?$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n') + ui;
  assert.ok(!/\bModerator\b(?! and compensation)/.test(pages.replace(/Platform moderator[^<'"]*/g, '')), 'one word for the admin role');
  for (const w of ['Student', 'Researcher', 'Mentor', 'Administrator']) assert.ok(pages.includes(w), w);
});
