/** build-docs.js - generates docs/source/api.rst, modules.rst and requirements.rst from the code, so the Sphinx pages cannot drift. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs', 'source');
const app = fs.readFileSync(path.join(root, 'server', 'app.js'), 'utf8');
const routes = [...app.matchAll(/add\('([A-Z]+)', '([^']+)'/g)].map((m) => [m[1], m[2]]);
const title = (t, c) => t + '\n' + c.repeat(t.length) + '\n\n';
let api = title('HTTP API reference', '=') + 'All endpoints are under ``/api``, exchange JSON and need an ``Authorization: Bearer <token>`` header except the public ones. Status codes and examples are in ``docs/API.md``.\n\n.. list-table::\n   :header-rows: 1\n   :widths: 12 88\n\n   * - Method\n     - Path\n';
for (const [m, p] of routes) api += '   * - ' + m + '\n     - ``' + p + '``\n';
fs.writeFileSync(path.join(out, 'api.rst'), api);

// Module reference: leading doc comment of each source file + its exported/declared function names
const files = ['server/app.js', 'server/services.js', 'server/auth.js', 'server/db.js', 'server/pool.js', 'server/storage.js', 'server/mailer.js', 'server/assistant.js', 'server/backup.js', 'shared/validators.js', 'shared/rules.js', 'shared/constants.js', 'client/src/lib/api.js', 'client/src/components/Scout.jsx'];
let mod = title('Module reference', '=');
for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), 'utf8'); const head = (src.match(/\/\*\*([\s\S]*?)\*\//) || ['', ''])[1].split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trim()).filter(Boolean).join(' ');
  const fns = [...new Set([...src.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]).concat([...src.matchAll(/^\s*api\.([A-Za-z]+)\s*=\s*(?:async\s+)?function/gm)].map((m) => 'api.' + m[1])))];
  mod += title('``' + f + '``', '-') + (head || 'See source.') + '\n\n' + (fns.length ? 'Functions: ' + fns.map((n) => '``' + n + '``').join(', ') + '.\n\n' : '');
}
fs.writeFileSync(path.join(out, 'modules.rst'), mod);

const reg = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'generated', 'requirements.json'), 'utf8')).rows;
let rq = title('Requirement status register', '=') + 'Generated from ``scripts/requirements-register.js``. Every Coursework 1 requirement is listed with its status, code unit and test IDs.\n\n.. list-table::\n   :header-rows: 1\n   :widths: 8 40 10 42\n\n   * - ID\n     - Requirement\n     - Status\n     - Tests\n';
for (const [id, r] of Object.entries(reg)) rq += '   * - ' + id + '\n     - ' + r[0].replace(/\*/g, '') + '\n     - ' + r[1] + '\n     - ' + r[4] + '\n';
fs.writeFileSync(path.join(out, 'requirements.rst'), rq);
console.log('docs/source written:', routes.length, 'routes,', files.length, 'modules,', Object.keys(reg).length, 'requirements');
