/**
 * requirements-register.js - single source of truth for the Requirement Status Register.
 * `node scripts/requirements-register.js` writes docs/REQUIREMENTS_STATUS.md and fails if any
 * Coursework 1 requirement ID (14 UR, 56 FR, 18 NFR) is missing, or a cited test ID does not exist in tests/.
 * Statuses: Implemented | Partial | Simulated | Deferred | Not met (see "Change and rationale").
 */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const pad = (n) => String(n).padStart(3, '0');
const R = {}; // id -> [text, status, change, unit, tests, ripple]
const add = (id, text, st, ch, unit, tests, rip) => { R[id] = [text, st, ch || '-', unit, tests, rip || '-']; };
const I = 'Implemented', P = 'Partial', S = 'Simulated', D = 'Deferred';

// ---- User requirements ----
add('UR-001', 'Maintain a profile of interests, skills, experience, availability, visibility', I, '-', 'C3 profile; client/src/pages/Profile.jsx', 'TC-API-07, 08; TC-R10', '-');
add('UR-002', 'Create, edit and close a research brief', I, 'Objectives are captured by the research question and methods fields; no separate objectives field', 'C4 projects; client/src/pages/ProjectNew.jsx', 'TC-API-12, 13, 14', 'FR-008 Partial');
add('UR-003', 'Search projects and profiles with criteria; refine', I, '-', 'C4/C3 search; client/src/pages/Discover.jsx', 'TC-API-10, 11; TC-R09', '-');
add('UR-004', 'Express interest or invite; see pending/accepted/declined/withdrawn', I, '-', 'C4 requests', 'TC-API-15, 16, 17, 43; TC-R01, R02', '-');
add('UR-005', 'Find a mentor by topic, submit goals; mentors review requests', I, 'Mentorship is guidance only, not supervision (disclaimer on screen)', 'C5 mentorship', 'TC-API-39, 45', '-');
add('UR-006', 'Agree roles, contributions, deadlines, communication, authorship; review revisions', I, '-', 'C4 agreement; client/src/pages/Agreement.jsx', 'TC-API-18, 41, 42', '-');
add('UR-007', 'Coordinate tasks, milestones, due dates, progress and files privately', I, '-', 'C6 workspace', 'TC-API-19..26, 44', '-');
add('UR-008', 'Tasks: 3-20 character title, description <= 250, <= 3 tags', I, '-', 'validators.js (shared by C1 and C6)', 'TC-V01..V03; TC-API-20', '-');
add('UR-009', 'Controlled access: nothing exposed to unauthorised people', I, '-', 'C2 gateway; C3-C6 membership checks', 'TC-API-05, 06, 13, 19, 24, 35; TC-E2E-02', '-');
add('UR-010', 'Status notifications; moderator handles reports', I, '-', 'C7 notifications and moderation', 'TC-API-37, 38, 48, 49, 50; TC-R11', '-');
add('UR-011', 'Optional paid mentoring with transparent terms', D, 'Out of scope for the subscription-funded release, as stated in Coursework 1', '-', '-', 'FR-022, FR-039..041 Deferred');
add('UR-012', 'Responsive, understandable, accessible, reliable, safe', P, 'Automated checks and the axe-core audit pass; real-user sessions are not done', 'C1; all tiers', 'TC-E2E-06, 08, 10; TC-D07, D10', 'NFR-013, NFR-014 Partial');
add('UR-013', 'Subscribe to a tiered plan with a support allowance', S, 'Sandbox payment: no real provider is connected', 'C10 subscription', 'TC-API-31, 32, 47; TC-R03', 'FR-040, FR-046 Simulated');
add('UR-014', 'Admin manages researchers, assignment, eligibility, bonuses, payments', S, 'Payouts are simulated; no real money moves', 'C10 compensation; client/src/pages/Compensation.jsx', 'TC-API-33..36; TC-R04..R08', 'FR-056 Simulated');

// ---- Functional requirements ----
const fr = (n, text, st, ch, unit, tests, rip) => add('FR-' + pad(n), text, st, ch, unit, tests, rip);
fr(1, 'Register', I, 'Extended: new accounts confirm their e-mail with a 6-digit PIN when a mail provider is configured; otherwise sign-up needs no PIN', 'C3 api.register, verifyEmail, resendPin; server/mailer.js; client/src/pages/Verify.jsx', 'TC-API-01; TC-E2E-03, 19; TC-V08, V09; TC-VF-01..12', 'Two endpoints, one page, an HTTPS mail client');
fr(2, 'Login, logout, account recovery', I, 'Recovery (signed single-use link) was missing from the first build and added after an audit against Coursework 1', 'C3 login/forgot/reset; auth.js', 'TC-API-03, 05, 54, 55; TC-E2E-09; TC-A02..A04', 'New endpoints, two pages, session-revocation claim');
fr(3, 'Create/edit profile: interests, skills, experience, institution/department', I, '-', 'C3 api.updateProfile', 'TC-API-08');
fr(4, 'Availability, preferred roles, languages, assistance types', I, '-', 'C3 profile', 'TC-API-08');
fr(5, 'Profile visibility controls applied when displaying', I, '-', 'rules.js canViewField; C3', 'TC-R10; TC-API-07');
fr(6, 'CV/portfolio/publication links subject to privacy', P, 'One professional link field; no CV or portfolio upload', 'C3 profile.link', 'TC-API-08', 'Should-priority; no other artefact affected');
fr(7, 'Create project brief: title, description, question, subject', I, '-', 'C4 api.saveProject', 'TC-API-12');
fr(8, 'Objectives, stage, methods, skills, roles, time commitment', P, 'Objectives are expressed through the research question and methods; stage, skills, roles and hours are separate fields', 'C4 project fields', 'TC-API-12', 'Wording of UR-002 clarified');
fr(9, 'Project visibility and what prospective collaborators see', I, '-', 'C4; rules.js', 'TC-API-13');
fr(10, 'Edit, pause or close a listing', I, 'A closed project cannot be reopened (409); closing declines pending requests', 'C4 api.setProjectStatus', 'TC-API-12, 14', 'New state rule; test TC-API-14');
fr(11, 'Basic timeline, milestones, deliverables, resources', P, 'Milestones with due dates and completion; deliverables and resources are not separate objects', 'C6 milestones', 'TC-API-44', 'Should-priority');
fr(12, 'Search or browse projects and profiles', I, '-', 'C4/C3 search', 'TC-API-10, 11; TC-R09');
fr(13, 'Filters: skills, interests, experience, role, language, availability', I, '-', 'rules.js filterAndPage', 'TC-API-11; TC-R09');
fr(14, 'Express interest with a message', I, '-', 'C4 api.sendInterest', 'TC-API-15');
fr(15, 'Owner invites a user', I, '-', 'C4 api.sendInvitation', 'TC-API-43');
fr(16, 'Record request status', I, 'A partial unique index (ux_request_one_pending) allows one pending request per sender, project, recipient and type', 'C4; db.js', 'TC-R01, R02; TC-D04; TC-API-16, 17', 'Schema constraint added');
fr(17, 'Notify on request status change', I, '-', 'C7 after-save notification', 'TC-API-38, 50');
fr(18, 'Browse mentors by subject, topic, expertise', I, '-', 'C5 api.searchMentors', 'TC-API-45');
fr(19, 'Mentor qualifications and verification status', P, 'Mentors state qualifications; a verification badge (pending/verified) is shown and filterable. No external credential check exists', 'C5; client/src/pages/Mentors.jsx', 'TC-API-45', 'Conditional requirement');
fr(20, 'Submit a mentorship request: goals, stage, guidance', I, '-', 'C5 api.requestMentorship', 'TC-API-39');
fr(21, 'Mentors manage request status and availability', I, '-', 'C5', 'TC-API-39, 45');
fr(22, 'Session booking (future option)', D, 'Out of scope, as stated in Coursework 1', '-', '-');
fr(23, 'Team agreement template', I, '-', 'C4 agreement', 'TC-API-41');
fr(24, 'Authorised members view the current agreement', I, 'Agreement is created on first view; opening it therefore writes (read-only transaction exception)', 'C4; app.js LAZY_CREATE_GETS', 'TC-API-18, 41', 'Defect found in smoke test, see issue 1 in Chapter 3');
fr(25, 'Record acknowledgements or revisions', I, '-', 'C4', 'TC-API-41, 42');
fr(26, 'State that an agreement does not replace institutional rules', I, 'The notice is on screen; the tests prove the page loads, the wording is checked by hand (manual checklist)', 'client/src/pages/Agreement.jsx', 'TC-E2E-07');
fr(27, 'Workspace for authorised members only', I, '-', 'C6 membership check', 'TC-API-19; TC-E2E-02');
fr(28, 'Create/update tasks, milestones, due dates, progress', I, '-', 'C6', 'TC-API-20, 21, 44');
fr(29, 'Upload/access files with permissions and limits', I, 'Limit is enforced in four layers (validator, route, service, database CHECK)', 'C6; storage.js', 'TC-API-22..25; TC-V04..V06; TC-D03; TC-A05', 'Boundary cases in four test levels');
fr(30, 'Display task and milestone status clearly', I, '-', 'client/src/pages/Workspace.jsx', 'TC-E2E-04');
fr(31, 'Timestamps and basic history of important updates', I, 'History is kept on requests and agreement versions, and in the audit log', 'C4, C7 audit', 'TC-API-21, 48');
fr(32, 'Prevent unauthorised access to private workspace content', I, '-', 'C2, C6', 'TC-API-19, 24; TC-E2E-02');
fr(33, 'Notifications for invitations, requests, status changes', I, '-', 'C7', 'TC-API-38, 50');
fr(34, 'Manage non-essential notification preferences', I, '-', 'C7; rules.js', 'TC-R11; TC-API-38, 50');
fr(35, 'Notifications do not expose confidential detail', I, '-', 'C7', 'TC-API-38');
fr(36, 'Admins review reports and apply policy actions', I, '-', 'C7 moderation', 'TC-API-37, 49');
fr(37, 'Record and display credential-verification status', P, 'Shown as a badge; the admin approval of researchers is logged', 'C5/C7', 'TC-API-48', 'Conditional requirement');
fr(38, 'Audit record of sensitive administrative actions', I, '-', 'C7 audit', 'TC-API-34, 36, 48');
fr(39, 'Paid mentoring terms shown before booking (future)', D, 'Excluded from this release, as in Coursework 1', '-', '-');
fr(40, 'Approved payment provider; no raw card details', S, 'Sandbox payment form; the system never receives card numbers', 'C10', 'TC-API-32', 'Real provider integration remains future work');
fr(41, 'Communicate booking/payment status (future)', D, 'Excluded with FR-039', '-', '-');
fr(42, 'Task title 3-20 characters', I, '-', 'validators.js', 'TC-V01; TC-API-20');
fr(43, 'Optional task description <= 250 characters', I, '-', 'validators.js', 'TC-V02; TC-API-20');
fr(44, 'At most three tags per task', I, 'Tag format confirmed: letters, digits and a few symbols; duplicates ignoring case rejected', 'validators.js', 'TC-V03; TC-API-20');
fr(45, 'Variable subscription plans with fixed period, rate, allowance', S, 'Four plans (Explorer, Scholar Basic, Plus, Pro) with 0/2/6/15 requests per period', 'C10; constants.js', 'TC-API-31; TC-R03');
fr(46, 'Store subscription status and billing events', S, 'Success, failed, pending, cancel-at-period-end recorded; no real renewals', 'C10', 'TC-API-32, 47');
fr(47, 'Apply the request restriction of the current plan', I, '-', 'C10 entitlement()', 'TC-API-31; TC-R03');
fr(48, 'Researchers pay no fee and take no direct student payments', I, 'No payment path exists between students and researchers', 'C10', 'TC-API-46');
fr(49, 'Admins approve researchers, log expertise and availability, set status', I, '-', 'C3/C10 admin', 'TC-API-36, 48');
fr(50, 'Forward eligible requests to researchers by expertise, availability and workload', I, '-', 'C10 matchResearcher()', 'TC-API-40, 46');
fr(51, 'Document assignments and transitions; count only eligible completions', I, '-', 'C10', 'TC-API-40; TC-R06');
fr(52, 'Record feedback and link to researcher and period', I, '-', 'C10 api.feedbackSupport', 'TC-API-40');
fr(53, 'Configurable bonus formula: 70% requests, 30% feedback, caps, minimum feedback', I, 'Weights, cap and minimum held in constants.js (COMP_CONFIG)', 'rules.js; C10', 'TC-R04, R05, R06');
fr(54, 'Eligibility and inactivity assessment', I, '-', 'rules.js', 'TC-R06, R07');
fr(55, 'Keep base pay, bonus rules, period and statement', I, 'One statement per researcher and period is enforced by a unique index', 'C10; db.js', 'TC-D05; TC-API-33');
fr(56, 'Payment approvals, payout status, failed payouts, audit trail', S, 'Payout outcomes are simulated; a failed payout is recorded and never shown as paid', 'C10', 'TC-API-33, 34; TC-R08', 'No real payout provider');

// ---- Non-functional requirements ----
const nfr = (n, text, st, ch, unit, tests, rip) => add('NFR-' + pad(n), text, st, ch, unit, tests, rip);
nfr(1, 'Role and membership permissions', I, '-', 'C2, C3-C6', 'TC-API-05, 06, 13, 19, 24, 25, 35; TC-E2E-02');
nfr(2, 'Salted password hashing; no raw passwords in logs', I, 'bcrypt (12 rounds) with per-user salt', 'auth.js', 'TC-A01, A02; TC-API-02, 04');
nfr(3, 'HTTPS/TLS in deployed environments', P, 'Redirect and HSTS tested; TLS itself is terminated by a proxy and was not run', 'app.js forceHttps', 'TC-API-57, 58', 'Deployment step');
nfr(4, 'Input validation; injection, XSS, access control', I, 'No external scanner (OWASP ZAP) run', 'validators.js; pg.js; app.js', 'TC-V07; TC-API-03, 10, 30, 59; TC-PG03; TC-E2E-05');
nfr(5, 'Privacy notice; data minimisation', I, '-', 'client/src/pages/Privacy.jsx', 'TC-API-07');
nfr(6, 'Document deletion and retention; review/update profile', I, 'Export and deletion endpoints added', 'C3', 'TC-API-08, 09');
nfr(7, 'Validate input; understandable errors', I, '-', 'validators.js; api-client.js', 'TC-V01..V09; TC-API-01, 20; TC-E2E-03');
nfr(8, 'Backups; RPO 24 h, RTO 4 h; restore evidence', I, 'pg_dump with a checksummed manifest; restore into a scratch database compares row counts; scheduled job is documented, not run', 'server/backup.js', 'TC-D10');
nfr(9, 'Only legitimate transitions; concurrent loser rejected', I, '-', 'rules.js; db.js advisory lock', 'TC-R01; TC-D04, D11; TC-API-16, 17');
nfr(10, 'Report saves; communicate issues', I, '-', 'api-client.js; db.js', 'TC-D07, D08; TC-API-26, 27, 53');
nfr(11, 'Responsive layouts', I, 'Checked at 360, 768 and 1280 px in Chromium only', 'styles.css', 'TC-E2E-06');
nfr(12, 'Consistent language and status wording', P, 'Status and role wording is checked automatically; the tone of longer texts is reviewed by hand only', 'client/src/components/ui.jsx labels', 'TC-CS-01, 02, 03');
nfr(13, 'Keyboard, focus, labels, contrast', P, 'axe-core (WCAG 2.1 A/AA, serious and critical) passes on all routes at 360, 768 and 1280 px; labels, names and structure are tested; screen-reader use and WCAG 2.2-only criteria are not checked', 'client/src', 'TC-E2E-08, 10');
nfr(14, 'Test core workflows with representative users', P, 'A protocol exists (docs/USER_TESTING.md); sessions are the team\'s to run', '-', '-');
nfr(15, 'Pagination', I, '-', 'rules.js filterAndPage', 'TC-API-10, 56; TC-R09');
nfr(16, 'Logs contain no passwords, tokens or file contents', I, '-', 'app.js request log', 'TC-API-04');
nfr(17, 'Separable modules with independent tests', I, 'Modules are logical units in one process, as designed', 'server/services.js', 'see Traceability in docs/TEST_PLAN.md');
nfr(18, '50 users: 95 % within 2 s; uploads <= 10 MB; availability, RPO/RTO', P, 'Node load smoke test: 2,000 requests, p95 about 200 ms; k6 script (50 users, 15 min) written but not run; monthly availability not measured', 'tests/load.js', 'TC-API-22; load test');

// ---- Validate ----
const need = [];
for (let n = 1; n <= 14; n++) need.push('UR-' + pad(n));
for (let n = 1; n <= 56; n++) need.push('FR-' + pad(n));
for (let n = 1; n <= 18; n++) need.push('NFR-' + pad(n));
const missing = need.filter((id) => !R[id]);
const ids = new Set(); let tests = '';
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const q = path.join(d, e.name); if (e.isDirectory()) walk(q); else if (e.name.endsWith('.js')) tests += fs.readFileSync(q, 'utf8'); } })(path.join(root, 'tests'));
for (const m of tests.matchAll(/TC-[A-Z0-9]+(?:-[A-Z0-9]+)?-?\d+/g)) ids.add(m[0]);
const prefixes = ['TC-API-', 'TC-V', 'TC-R', 'TC-D', 'TC-PG', 'TC-A', 'TC-E2E-'];
const bad = [];
for (const [id, row] of Object.entries(R)) {
  const cell = row[4]; if (cell === '-' || /^see /.test(cell)) continue;
  for (const piece of cell.split(/;\s*/)) {
    const m = piece.match(/^(TC-[A-Z0-9]+-?)(\d+)(?:\.\.(?:[A-Z]*)?(\d+))?|^(TC-[A-Z0-9]+-?)(\d+)/); void m;
    // expand "TC-API-05, 06, 13" and "TC-V01..V03"
    const head = piece.match(/^(TC-(?:API-|E2E-|CS-|CT-|VF-|SQ-|PG|V|R|D|A))/); if (!head) { if (!/load test/.test(piece)) bad.push(id + ': ' + piece); continue; }
    const pre = head[1]; const rest = piece.slice(pre.length);
    for (const part of rest.split(/,\s*/)) {
      const rg = part.match(/^(\d+)\.\.[A-Z]*(\d+)$/);
      const list = rg ? Array.from({ length: +rg[2] - +rg[1] + 1 }, (_, k) => String(+rg[1] + k)) : [part.replace(/^[A-Z]*/, '')];
      for (const num of list) {
        const w = pre === 'TC-API-' || pre === 'TC-E2E-' ? 2 : 2; const cand = pre + num.padStart(w, '0');
        if (!ids.has(cand) && !ids.has(pre + num)) bad.push(id + ' cites unknown ' + cand);
      }
    }
  }
}
if (missing.length || bad.length) { console.error('MISSING', missing, 'BAD TEST REFS', bad); process.exit(1); }

const count = {}; Object.values(R).forEach((r) => { count[r[1]] = (count[r[1]] || 0) + 1; });
const byType = (p) => Object.entries(R).filter(([id]) => id.startsWith(p));
const esc = (s) => String(s).replace(/\|/g, '\\|');
let md = '# Requirement Status Register (Coursework 2)\n\nGenerated by `node scripts/requirements-register.js` from the Coursework 1 specification (14 user, 56 functional, 18 non-functional requirements). The script fails if an ID is missing or a cited test ID does not exist, so this table cannot drift from the code.\n\n';
md += '**Status counts:** ' + Object.entries(count).map(([k, v]) => k + ' ' + v).join(', ') + ' (total ' + need.length + ').\n\n';
md += 'Implemented = built and tested as specified. Partial = built with a stated gap. Simulated = built end to end against a sandbox, not a real provider. Deferred = excluded in Coursework 1 and still excluded.\n';
for (const [title, p] of [['User requirements', 'UR-'], ['Functional requirements', 'FR-'], ['Non-functional requirements', 'NFR-']]) {
  md += '\n## ' + title + '\n\n| ID | Requirement (short) | Status | Change and rationale | Code unit | Test IDs | Ripple effect |\n|---|---|---|---|---|---|---|\n';
  for (const [id, r] of byType(p)) { if (p === 'FR-' && id.startsWith('FR-') === false) continue; md += '| ' + id + ' | ' + esc(r[0]) + ' | ' + r[1] + ' | ' + esc(r[2]) + ' | ' + esc(r[3]) + ' | ' + esc(r[4]) + ' | ' + esc(r[5]) + ' |\n'; }
}
fs.writeFileSync(path.join(root, 'docs', 'REQUIREMENTS_STATUS.md'), md);
fs.writeFileSync(path.join(root, 'docs', 'generated', 'requirements.json'), JSON.stringify({ counts: count, rows: R }, null, 1));
console.log('Register written:', JSON.stringify(count));

// ---- Requirement -> test matrix inside the test plan (every functional requirement appears; generated, never hand-edited) ----
{
  const tp = path.join(root, 'docs', 'TEST_PLAN.md'); let t = fs.readFileSync(tp, 'utf8');
  const rows = Object.entries(R).filter(([id]) => /^(UR|FR)-/.test(id)).map(([id, r]) => '| ' + id + ' | ' + r[0] + ' | ' + r[1] + ' | ' + (r[4] === '-' ? 'Not tested: ' + (r[1] === 'Deferred' ? 'excluded from the release in Coursework 1' : 'see change column') : r[4]) + ' |').join('\n');
  const block = '<!-- REQ-MATRIX:START -->\n## 3b. Functional requirement to test matrix (generated)\n\nEvery user (UR) and functional (FR) requirement of Coursework 1 with its status and the automated test cases that cover it. The non-functional matrix is section 3a. Generated by `npm run docs` from `scripts/requirements-register.js`, which fails if a cited test does not exist.\n\n| Requirement | Summary | Status | Automated test cases |\n|---|---|---|---|\n' + rows + '\n<!-- REQ-MATRIX:END -->\n';
  if (t.includes('<!-- REQ-MATRIX:START -->')) t = t.replace(/<!-- REQ-MATRIX:START -->[\s\S]*?<!-- REQ-MATRIX:END -->\n/, block);
  else t = t.replace('## 4. Automated test environment and how to run', block + '\n## 4. Automated test environment and how to run');
  fs.writeFileSync(tp, t);
}
