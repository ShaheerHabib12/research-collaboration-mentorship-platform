/**
 * set-admin-password.js - give the real administrator a new password (for example when the first-start password was not copied).
 *
 *   node scripts/set-admin-password.js "MyNewPassword#2026"            (uses RCMP_ADMIN_EMAIL or the default administrator)
 *   node scripts/set-admin-password.js "MyNewPassword#2026" someone@x.ac.uk
 *
 * It uses the same database settings as the server (DATABASE_URL) and the same password rules as the register form.
 */
'use strict';
const { Pool } = require('../server/pool');
const DB = require('../server/db');
const Auth = require('../server/auth');
const V = require('../shared/validators');
const { ADMIN_EMAIL } = require('../server/seed');

async function setAdminPassword(pool, email, password) {
  const bad = V.validatePassword ? V.validatePassword(password) : null;
  if (bad && bad.error) throw new Error('Password refused: ' + bad.error);
  const hash = await Auth.hashPassword(password);
  const ctx = {};
  let found = false;
  await DB.transact(pool, ctx, async () => {
    const u = ctx.db.users.find((x) => String(x.email).toLowerCase() === String(email).toLowerCase());
    if (!u) return;
    if (u.role !== 'admin') throw new Error(email + ' is not an administrator account.');
    u.pw = hash; found = true;
  });
  if (!found) throw new Error('No account with the e-mail ' + email + '. Start the server once first so the administrator is created.');
}

async function main() {
  const password = process.argv[2], email = (process.argv[3] || ADMIN_EMAIL).toLowerCase();
  if (!password) { console.error('Usage: node scripts/set-admin-password.js "<new password>" [admin e-mail]'); process.exit(1); }
  const pool = new Pool(process.env.DATABASE_URL || 'postgres://rcmp:rcmp@localhost:5432/rcmp', 2);
  try { await setAdminPassword(pool, email, password); console.log('Password changed for ' + email + '. Sign in with the new password.'); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { await pool.end(); }
}
if (require.main === module) main();
module.exports = { setAdminPassword };
