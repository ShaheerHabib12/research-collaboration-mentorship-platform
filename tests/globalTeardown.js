'use strict';
const fs = require('node:fs');
module.exports = async () => {
  const s = globalThis.__RCMP_PG__; if (!s) return;
  try { s.run('pg_ctl', ['-D', require('node:path').join(s.root, 'data'), '-m', 'immediate', 'stop']); fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* best effort */ }
};
