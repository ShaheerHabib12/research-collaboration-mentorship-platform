# Test plan and results

Team 02 - M35376 Coursework 2. Requirement IDs (FR/NFR/UC/F) are those of the Coursework 1 specification. Every test case below exists as executable code; the IDs in this document are the same IDs in the test titles, so the plan and the automated tests cannot drift apart without a visible mismatch.

## 1. Scope - the units under test

| Unit | Code | What it must guarantee |
|---|---|---|
| U1 Input validation | `shared/validators.js` (shared by browser and server) | Reject invalid input, neutralise markup, with exact limits |
| U2 Domain rules | `shared/rules.js` | State machines, allowance, compensation formula, visibility, filtering |
| U3 Security primitives | `server/auth.js`, `server/storage.js` | Password hashing, JWT, file encryption |
| U4 Database layer | `server/db.js`, `server/pool.js`, `server/backup.js` | Constraints, transactions, rollback, serialisation, backup |
| U5 Business services | `server/services.js` | Each use case incl. authorisation and error paths |
| U6 HTTP gateway | `server/app.js` | Routing, JWT check, limits, headers, error mapping |
| U8 Help assistant (Scout) | `server/assistant.js`, `client/src/components/Scout.jsx`, `POST /api/assistant` | Answers only from the curated knowledge base, declines off-topic questions, never echoes input, honest identity, rate limited, keyboard accessible (TC-AS-01..09, TC-AS-API-01..07, TC-E2E-12..13) |
| U7 Web client | `client/src` (React pages, components, hooks, `lib/api.js`) | Rendering, forms, XSS safety, mobile layout: automated in Chromium (TC-E2E-01..11, 12..13 for Scout); offline/expiry/failure demos checked manually (section 6) |

## 2. Methodology: how test cases were chosen

1. **Equivalence partitioning.** For each input the domain was split into classes that the specification treats identically (valid, too short, too long, wrong type, empty, hostile). One test per class at least; classes are listed in section 3.
2. **Boundary value analysis.** For every numeric or length limit we test the value on each side of the boundary: task title 2/3/20/21 characters, description 250/251, tags 3/4, file size 1 byte, 10 MiB, 10 MiB + 1, 0 bytes, project title and milestone title limits.
3. **State-transition testing.** Request (pending -> accepted/declined/withdrawn), statement (draft -> awaiting_approval -> approved -> paid / payout_failed), support request, project (draft/open/closed). Each legal edge has a test, and every illegal edge is tested to give 409 (TC-R01, R02, R08, API-14, API-17, API-33).
4. **Decision tables** for rules that combine conditions: compensation (feedback count x active x target present, TC-R04-R07), allowance (plan x used x returned, TC-R03), notification delivery (essential x category x pause, TC-R11), visibility (field level x viewer relationship, TC-R10).
5. **Negative and security testing** derived from NFR-001..004: no token, forged token, expired token, wrong role, non-member, SQL-injection text, script injection, path traversal ids, logs free of secrets.
6. **Failure injection** for the specification's exception flows E1-E4: database failure, storage failure, session expiry, edit conflict - exercised through the same switches the demo uses (TC-API-26..28, API-18, API-53).
7. **Concurrency tests** for F4/NFR-009: accept and withdraw at the same moment (TC-API-16), 12 simultaneous writers (TC-D11), 50-user load (`tests/load.js`).
8. **Integration without mocks.** The API tests start the real server against a real PostgreSQL database created per test file, so SQL, constraints, transactions and the HTTP layer are all genuinely exercised. A mock would not have found the read-only-transaction defect described in the report (section 3.3C of the implementation discussion).

## 3. Input partitions (evidence of complete partition coverage)

Each row is an equivalence class; "TC" names the test that exercises it.

### U1 validators

| Input | Class | Example | Expected | TC |
|---|---|---|---|---|
| Task title | empty / whitespace | `"  "` | error | TC-V01 |
| | below minimum (boundary) | 2 chars | error | TC-V01 |
| | minimum | 3 chars | ok | TC-V01 |
| | maximum | 20 chars | ok | TC-V01, API-20 |
| | above maximum (boundary) | 21 chars | error, nothing saved | TC-V01, API-20 |
| | contains markup | `<b>x</b>` | tags removed | TC-V01, API-08 |
| Description | 0 / 250 / 251 chars | | ok / ok / error | TC-V02 |
| Tags | 0-3 valid tags | | ok | TC-V03 |
| | 4 tags (boundary) | | error | TC-V03, API-20 |
| | duplicate / invalid characters | | error | TC-V03 |
| File | exactly 10 MiB | | accepted | TC-V04, API-22 |
| | 10 MiB + 1 byte (10.1 MB) | | 413, no record | TC-V04, API-22 |
| | zero bytes | | rejected | TC-V05, API-23 |
| | unsupported type (`.exe`) | | rejected | TC-V05, API-23 |
| | path in name (`../../x.pdf`) | | sanitised | TC-V06 |
| Email | valid / no `@` / no domain / uppercase | | ok / error / error / lower-cased | TC-V08, API-01 |
| Password | weak / short / no digit / strong | | strength + errors | TC-V09, API-01 |
| Free text | script injection | `<script>` | escaped | TC-V07 |

### U2 rules

| Rule | Class | TC |
|---|---|---|
| Request transition | pending -> accepted by recipient; pending -> withdrawn by sender; any other mover or non-pending source | TC-R01, R02, API-17 |
| Allowance | free plan 0; plus plan n used of N; returned request frees one; limit reached | TC-R03, API-31 |
| Compensation | feedback >= 3 and active; < 3 feedback; inactive; missing target; ratio > 1 capped | TC-R04-R07 |
| Statement payment | unapproved cannot be paid; flagged needs exception; paid is final; payout failure | TC-R08, API-33, API-34 |
| Search | empty query; text match; skill filter; page beyond last | TC-R09, API-10, API-11 |
| Visibility | public / team / private field x owner / member / stranger | TC-R10, API-07 |
| Notifications | essential / category off / paused / normal | TC-R11 |

### U3 security primitives

| Input | Class | TC |
|---|---|---|
| Password | correct / wrong / empty / unknown account | TC-A01, A02, API-03 |
| JWT | valid / expired / forged signature / malformed / wrong algorithm | TC-A03, A04, API-05 |
| Stored file | round trip / tampered ciphertext / hostile id | TC-A05, API-24 |

### U4 database

| Constraint or behaviour | Valid class | Invalid class | TC |
|---|---|---|---|
| `users.email` unique, case-insensitive | new | same, other case | TC-D01 |
| role / status / visibility CHECK | allowed values | unknown value | TC-D02 |
| `files.size` CHECK 1..10485760 | 1, 10485760 | 0, 10485761 | TC-D03 |
| pending request uniqueness | first pending; history rows | second pending | TC-D04 |
| one statement per researcher+period | first | second | TC-D05 |
| Unit of Work | insert / update / delete / order | - | TC-D06 |
| Rollback | exception in code; constraint violation at commit | - | TC-D07, D08 |
| Membership table | add, remove, cascade | - | TC-D09 |
| Concurrency | 12 simultaneous writers | - | TC-API-54 | account recovery: no enumeration, single-use link, weak password refused, old sessions revoked (FR-002) | `tests/api2.test.js` |
| TC-API-55 | an expired reset link is refused | `tests/api2.test.js` |
| TC-API-56 | pagination: 500 records, pages of at most 20, every page reachable (NFR-015) | `tests/api2.test.js` |
| TC-API-57 | API responses never cached; CORS closed outside demo mode (NFR-001, NFR-003) | `tests/api2.test.js` |
| TC-API-58 | HTTPS enforcement: plain HTTP gets 308, proxied HTTPS passes (NFR-003) | `tests/api2.test.js` |
| TC-API-59 | login throttle holds even with a forged X-Forwarded-For (NFR-004) | `tests/api2.test.js` |
| TC-E2E-09 | forgot and reset password in the browser, then sign in (FR-002) | `tests/e2e/e2e.test.js` |
| TC-E2E-10 | axe-core audit (WCAG 2.1 A/AA, serious and critical) of 24 routes at 360, 768 and 1280 px (NFR-013) | `tests/e2e/e2e.test.js` |
| TC-E2E-10b | structure on every route: lang, title, one h1, labelled controls, named links, alt (NFR-013) | `tests/e2e/e2e.test.js` |
| TC-E2E-11 | no screen claims data is kept only in the browser (content accuracy) | `tests/e2e/e2e.test.js` |
| TC-E2E-01 | sign in: bad password stays on page with an error; good password reaches dashboard | `tests/e2e/e2e.test.js` |
| TC-E2E-02 | protected page without a session redirects to sign in | `tests/e2e/e2e.test.js` |
| TC-E2E-03 | register form: inline errors, nothing created | `tests/e2e/e2e.test.js` |
| TC-E2E-04 | workspace: 21-character title refused, valid task saved and shown (F7) | `tests/e2e/e2e.test.js` |
| TC-E2E-05 | markup in a task is shown as text, never executed (NFR-004) | `tests/e2e/e2e.test.js` |
| TC-E2E-06 | responsive: no horizontal scroll at 360, 768 and 1280 px on key pages (NFR-011) | `tests/e2e/e2e.test.js` |
| TC-E2E-07 | every page loads for its role without console errors | `tests/e2e/e2e.test.js` |
| TC-E2E-08 | keyboard: Tab reaches a control on the login page | `tests/e2e/e2e.test.js` |
| TC-D11 |
| Read-only transaction | read | attempted write | TC-D12 |
| Backup | verify ok | tampered file | TC-D10 |
| Driver | typed values, parameters, errors, pool | wrong password, bad SQL, dead host | TC-PG01-08 |

### U5/U6 API (per endpoint family)

For every endpoint the following classes are covered at least once across the API tests: no token (401), forged/expired token (401), wrong role (403), non-member (403), unknown id (404), invalid body (400 with `fields`), valid request (200/201), duplicate or illegal state (409). The matrix is in the traceability table: accounts API-01..09, discovery API-10..11, projects API-12..17, agreement API-18, 41, 42, workspace API-19..26, 44, resilience API-26..30, 52, 53, subscription API-31, 32, 47, compensation API-33..35, administration API-36, 37, 48, 49, notifications API-38, 50, mentorship API-39, 45, support API-40, 46, dashboard API-51.

## 3a. Non-functional requirement matrix (every NFR in the Coursework 1 specification)

"Automated" means a test in this repository; "manual" means a procedure that a person must carry out. Gaps are stated, not hidden.

| NFR | Requirement (short) | Automated evidence | Manual / not covered |
|---|---|---|---|
| NFR-001 | Role and membership permissions | TC-API-05, 06, 13, 19, 24, 25, 35, TC-E2E-02 | - |
| NFR-002 | Salted password hashing, no raw passwords in logs | TC-A01, A02, API-02, API-04, API-54 | - |
| NFR-003 | HTTPS/TLS in deployed environments | TC-API-58 (308 redirect), TC-API-57 (HSTS header) | TLS itself is terminated by a proxy and is not tested here |
| NFR-004 | Injection, XSS, broken access control | TC-V07, API-03, 10, 30, 59, E2E-05 | OWASP ZAP baseline runs in `ci.yml` on every push; its results are in the table of section 4 and in `docs/EVIDENCE.md` |
| NFR-005 | Privacy notice, data minimisation | TC-API-07 (field visibility) | Field-purpose review table: manual, with the privacy notice |
| NFR-006 | Account deletion, review and update of profile | TC-API-08, 09 | 30-day retention is documented, not time-tested |
| NFR-007 | Validation with understandable errors | TC-V01-V09, API-01, 08, 20, E2E-03, E2E-04 | - |
| NFR-008 | Backup and restore, RPO 24 h / RTO 4 h | TC-D10 (restore, counts, checksum, elapsed time) | Scheduled job is a documented cron entry, not exercised |
| NFR-009 | Only legitimate request transitions; concurrent loser rejected | TC-R01, R02, D04, API-15, 16, 17 | - |
| NFR-010 | Honest save feedback, rollback on failure | TC-D07, D08, API-26, 27, 53 | - |
| NFR-011 | Responsive at 360, 768, 1280 px | TC-E2E-06 | Real devices not tried |
| NFR-012 | Consistent language and status labels | TC-CS-01..03 | Wording review by a person |
| NFR-013 | Keyboard, focus, labels, contrast | TC-E2E-08, E2E-10 (axe-core, WCAG 2.1 A/AA, serious and critical impacts, every route at 360, 768 and 1280 px), E2E-10b (structure) | axe-core does not cover everything (screen-reader use, reading order); WCAG 2.2 AA not separately checked; Cypress + cypress-axe specs written, not yet run |
| NFR-014 | Core workflows tested with representative users | - | `docs/USER_TESTING.md` is the protocol; sessions must be run by the team |
| NFR-015 | Pagination | TC-API-10, API-56 (500 records, <= 20 per page) | - |
| NFR-016 | Logs free of passwords, tokens, file contents | TC-API-04 | - |
| NFR-017 | Separable modules with tests per module | Account TC-API-01-09, 54; projects 12-17; requests 15-17; workspace 19-26, 44; mentorship 39, 45; subscription 31, 32, 47; compensation 33-35; plus unit suites | - |
| NFR-018 | 50 users; 95 % of core requests within 2 s | `tests/load.js` (2,000 requests, p95 about 200 ms, in process), `k6/load.js` (50 users, 15 min, p95 < 2 s) | The k6 1-minute run in CI (commit `c6654e9`, 50 users, 12,172 requests, 0 % failed, p95 10.41 ms) met the target. The 15-minute run and monthly availability have **not been measured** |

<!-- REQ-MATRIX:START -->
## 3b. Functional requirement to test matrix (generated)

Every user (UR) and functional (FR) requirement of Coursework 1 with its status and the automated test cases that cover it. The non-functional matrix is section 3a. Generated by `npm run docs` from `scripts/requirements-register.js`, which fails if a cited test does not exist.

| Requirement | Summary | Status | Automated test cases |
|---|---|---|---|
| UR-001 | Maintain a profile of interests, skills, experience, availability, visibility | Implemented | TC-API-07, 08; TC-R10 |
| UR-002 | Create, edit and close a research brief | Implemented | TC-API-12, 13, 14 |
| UR-003 | Search projects and profiles with criteria; refine | Implemented | TC-API-10, 11; TC-R09 |
| UR-004 | Express interest or invite; see pending/accepted/declined/withdrawn | Implemented | TC-API-15, 16, 17, 43; TC-R01, R02 |
| UR-005 | Find a mentor by topic, submit goals; mentors review requests | Implemented | TC-API-39, 45 |
| UR-006 | Agree roles, contributions, deadlines, communication, authorship; review revisions | Implemented | TC-API-18, 41, 42 |
| UR-007 | Coordinate tasks, milestones, due dates, progress and files privately | Implemented | TC-API-19..26, 44 |
| UR-008 | Tasks: 3-20 character title, description <= 250, <= 3 tags | Implemented | TC-V01..V03; TC-API-20 |
| UR-009 | Controlled access: nothing exposed to unauthorised people | Implemented | TC-API-05, 06, 13, 19, 24, 35; TC-E2E-02 |
| UR-010 | Status notifications; moderator handles reports | Implemented | TC-API-37, 38, 48, 49, 50; TC-R11 |
| UR-011 | Optional paid mentoring with transparent terms | Deferred | Not tested: excluded from the release in Coursework 1 |
| UR-012 | Responsive, understandable, accessible, reliable, safe | Partial | TC-E2E-06, 08, 10; TC-D07, D10 |
| UR-013 | Subscribe to a tiered plan with a support allowance | Simulated | TC-API-31, 32, 47; TC-R03 |
| UR-014 | Admin manages researchers, assignment, eligibility, bonuses, payments | Simulated | TC-API-33..36; TC-R04..R08 |
| FR-001 | Register | Implemented | TC-API-01; TC-E2E-03, 19; TC-V08, V09; TC-VF-01..12 |
| FR-002 | Login, logout, account recovery | Implemented | TC-API-03, 05, 54, 55; TC-E2E-09; TC-A02..A04 |
| FR-003 | Create/edit profile: interests, skills, experience, institution/department | Implemented | TC-API-08 |
| FR-004 | Availability, preferred roles, languages, assistance types | Implemented | TC-API-08 |
| FR-005 | Profile visibility controls applied when displaying | Implemented | TC-R10; TC-API-07 |
| FR-006 | CV/portfolio/publication links subject to privacy | Partial | TC-API-08 |
| FR-007 | Create project brief: title, description, question, subject | Implemented | TC-API-12 |
| FR-008 | Objectives, stage, methods, skills, roles, time commitment | Partial | TC-API-12 |
| FR-009 | Project visibility and what prospective collaborators see | Implemented | TC-API-13 |
| FR-010 | Edit, pause or close a listing | Implemented | TC-API-12, 14 |
| FR-011 | Basic timeline, milestones, deliverables, resources | Partial | TC-API-44 |
| FR-012 | Search or browse projects and profiles | Implemented | TC-API-10, 11; TC-R09 |
| FR-013 | Filters: skills, interests, experience, role, language, availability | Implemented | TC-API-11; TC-R09 |
| FR-014 | Express interest with a message | Implemented | TC-API-15 |
| FR-015 | Owner invites a user | Implemented | TC-API-43 |
| FR-016 | Record request status | Implemented | TC-R01, R02; TC-D04; TC-API-16, 17 |
| FR-017 | Notify on request status change | Implemented | TC-API-38, 50 |
| FR-018 | Browse mentors by subject, topic, expertise | Implemented | TC-API-45 |
| FR-019 | Mentor qualifications and verification status | Partial | TC-API-45 |
| FR-020 | Submit a mentorship request: goals, stage, guidance | Implemented | TC-API-39 |
| FR-021 | Mentors manage request status and availability | Implemented | TC-API-39, 45 |
| FR-022 | Session booking (future option) | Deferred | Not tested: excluded from the release in Coursework 1 |
| FR-023 | Team agreement template | Implemented | TC-API-41 |
| FR-024 | Authorised members view the current agreement | Implemented | TC-API-18, 41 |
| FR-025 | Record acknowledgements or revisions | Implemented | TC-API-41, 42 |
| FR-026 | State that an agreement does not replace institutional rules | Implemented | TC-E2E-07 |
| FR-027 | Workspace for authorised members only | Implemented | TC-API-19; TC-E2E-02 |
| FR-028 | Create/update tasks, milestones, due dates, progress | Implemented | TC-API-20, 21, 44 |
| FR-029 | Upload/access files with permissions and limits | Implemented | TC-API-22..25; TC-V04..V06; TC-D03; TC-A05 |
| FR-030 | Display task and milestone status clearly | Implemented | TC-E2E-04 |
| FR-031 | Timestamps and basic history of important updates | Implemented | TC-API-21, 48 |
| FR-032 | Prevent unauthorised access to private workspace content | Implemented | TC-API-19, 24; TC-E2E-02 |
| FR-033 | Notifications for invitations, requests, status changes | Implemented | TC-API-38, 50 |
| FR-034 | Manage non-essential notification preferences | Implemented | TC-R11; TC-API-38, 50 |
| FR-035 | Notifications do not expose confidential detail | Implemented | TC-API-38 |
| FR-036 | Admins review reports and apply policy actions | Implemented | TC-API-37, 49 |
| FR-037 | Record and display credential-verification status | Partial | TC-API-48 |
| FR-038 | Audit record of sensitive administrative actions | Implemented | TC-API-34, 36, 48 |
| FR-039 | Paid mentoring terms shown before booking (future) | Deferred | Not tested: excluded from the release in Coursework 1 |
| FR-040 | Approved payment provider; no raw card details | Simulated | TC-API-32 |
| FR-041 | Communicate booking/payment status (future) | Deferred | Not tested: excluded from the release in Coursework 1 |
| FR-042 | Task title 3-20 characters | Implemented | TC-V01; TC-API-20 |
| FR-043 | Optional task description <= 250 characters | Implemented | TC-V02; TC-API-20 |
| FR-044 | At most three tags per task | Implemented | TC-V03; TC-API-20 |
| FR-045 | Variable subscription plans with fixed period, rate, allowance | Simulated | TC-API-31; TC-R03 |
| FR-046 | Store subscription status and billing events | Simulated | TC-API-32, 47 |
| FR-047 | Apply the request restriction of the current plan | Implemented | TC-API-31; TC-R03 |
| FR-048 | Researchers pay no fee and take no direct student payments | Implemented | TC-API-46 |
| FR-049 | Admins approve researchers, log expertise and availability, set status | Implemented | TC-API-36, 48 |
| FR-050 | Forward eligible requests to researchers by expertise, availability and workload | Implemented | TC-API-40, 46 |
| FR-051 | Document assignments and transitions; count only eligible completions | Implemented | TC-API-40; TC-R06 |
| FR-052 | Record feedback and link to researcher and period | Implemented | TC-API-40 |
| FR-053 | Configurable bonus formula: 70% requests, 30% feedback, caps, minimum feedback | Implemented | TC-R04, R05, R06 |
| FR-054 | Eligibility and inactivity assessment | Implemented | TC-R06, R07 |
| FR-055 | Keep base pay, bonus rules, period and statement | Implemented | TC-D05; TC-API-33 |
| FR-056 | Payment approvals, payout status, failed payouts, audit trail | Simulated | TC-API-33, 34; TC-R08 |
<!-- REQ-MATRIX:END -->

## 4. Automated test environment and how to run

Node 24 LTS (the last full run in the build sandbox was on Node 22.23; CI uses Node 24); PostgreSQL 16 (14+ works). With `TEST_DATABASE_URL` set (CI service container, `docker compose up -d db`, your own server) each test file creates a throw-away database `rcmp_t_<random>` on that server and drops it afterwards. Without it, `tests/pgtest.js` starts a temporary PostgreSQL cluster from the installed server programs and removes it afterwards. The browser tests need Chromium (`npx playwright install chromium`; set `CHROMIUM_PATH` to use an existing binary). The React client must be built first (`npm run build`) because the browser tests load `client/dist`.

| Command | Purpose |
|---|---|
| `npm test` | all Jest suites (unit, property, database, API, security, contract, smoke, assistant, browser) |
| `npm run test:smoke` | 4 quick checks that the server is alive (run these first) |
| `npm run test:property` | property-based tests with fast-check (random inputs) |
| `npm run test:security` | OWASP-style checks: injection, forged tokens, headers, throttling |
| `npm run test:contract` | API response shapes the client depends on |
| `npm run mutation` | Stryker mutation testing of the shared rules (fails below 60 %) |
| `npm run audit:deps` | `npm audit` for the server and the client |
| `npm run e2e:firefox`, `npm run e2e:webkit` | the browser suite in Firefox or WebKit (needs `npx playwright install firefox webkit`) |
| `npm run test:unit` | U1-U3, no database needed |
| `npm run test:api` | U4-U6 with PostgreSQL |
| `npm run e2e` | U7 in real Chromium with axe-core |
| `npm run coverage` | all suites plus a coverage gate (lines >= 90 %, functions >= 85 %); fails the build if below |
| `npm run report` | writes `docs/evidence/TEST_REPORT.txt`, `COVERAGE_REPORT.txt` and `test-results.json` |
| `npm run load` | NFR-018 smoke: 50 users x 40 requests, in process |
| `npm run cypress` | Cypress specs (UC-02, UC-04, NFR-011/013) against a running server |
| `npm run k6` | NFR-018: 50 users for 15 minutes against a running server |

CI (`.github/workflows/ci.yml`) runs lint, the Vite build, unit tests, the coverage gate, the load smoke test, Cypress and the OWASP ZAP baseline on every push and pull request, and uploads the evidence files. The k6 job runs for 1 minute (50 users) on every push and for 15 minutes when started by hand.

### What has actually been run, and where

| Tool | Status |
|---|---|
| Jest + Supertest, database, unit, property, security, contract, smoke, assistant | **Run**: 224 of 224 pass on Node 22.23 (local sandbox, real PostgreSQL 16); the 200 tests that need no browser also pass on Node 24 |
| Stryker mutation testing | **Run**: 766 mutants, 92.1 % killed (first run 48 %, raised by adding `validators2` and `rules2`) |
| `npm audit` | **Run**: 0 vulnerabilities in server and client after upgrading react-router to v7 |
| Playwright + axe-core (browser tests) | **Run**: pass; axe finds no serious or critical violation on 24 routes at 3 widths |
| Node load smoke test | **Run**: 50 users, 2,000 requests, p95 about 200 ms, 0 server errors (in process, not over the network) |
| ESLint | **Run**: 0 errors |
| Cypress specs | **Run in GitHub Actions.** Passed on both runs of `c6654e9`, `f1b2b17` and `109ec2c`, and on the pull-request run of `1d0729f`. One width check on `/notifications` read 15 px too wide on the push run of `1d0729f` while the page was settling; it now waits and retries for 4 s |
| k6 test | **Run in GitHub Actions** with 50 virtual users for 1 minute. Commit `c6654e9`: 12,172 requests, 0 % failed, p95 10.41 ms, 12,168 of 12,168 checks passed. Later runs: p95 10.12 ms (`1d0729f`), 27.22 ms (`f1b2b17`), 11.34 ms (`109ec2c`). All met the 2 s limit. The 15-minute run is manual and **not run yet** |
| OWASP ZAP baseline | **Run in GitHub Actions.** First run: 0 FAIL, 7 WARN, 63 PASS. After the fixes: 0 FAIL, 0 WARN, 67 PASS, 4 ignored. After bundling fonts: one false Base64 warning, now ignored with a reason (rule 10094). Commits `1d0729f`, `f1b2b17` and `109ec2c`: **0 FAIL, 0 WARN, 66 PASS, 5 ignored** on every run |
| Docker image and Compose | Written; **not run** (no Docker in the sandbox); the CI service container uses the same PostgreSQL 16 image |
| Firefox and WebKit browser tests | **Run in GitHub Actions** (the same 24 tests as Chromium; key routes only for axe; one retry). Firefox passed on every run since `30ff8a7`. WebKit: heading wait raised from 8 s to 20 s (`c6654e9`); TC-E2E-10 then ran past its 300 s limit on one slow pull-request run (`f1b2b17`), so each axe run is now capped at 60 s and tried twice and the test limit is 900 s on Firefox and WebKit. **Both passed on both runs of `109ec2c`** |
| Team contribution tests | 32 tests (`tests/contrib`: A tags, B match, C relativeTime, D fileSize, 8 each), run by `npm run contrib` and by a CI step: **skipped, 0 failed** (24 on `109ec2c`; piece D adds 8). They stay skipped until each member writes their piece (`docs/CONTRIBUTING_STEPS.md`) |
| GitHub Actions workflow | Run on 14 and 15 Nov 2026 (every run link is in `docs/EVIDENCE.md`). **Latest completed run (commit `109ec2c`): all 12 checks green** (push and pull request). Earlier red runs and their causes are in `docs/EVIDENCE.md`. The first k6 run used 1 virtual user because k6 reads `K6_DURATION` itself; the variable is now `LOAD_DURATION` |

## 5. Results (last run: see timestamps inside the evidence files)

- **224 tests, 224 passed, 0 failed, 0 skipped** (`docs/evidence/TEST_REPORT.txt`), 20 suites. The 32 contribution tests (`npm run contrib`) and the four files they test (`shared/contrib`) are counted apart: they are left out of this total and of the coverage figure until each member writes their piece (`docs/CONTRIBUTING_STEPS.md`, step 8).
- **Mutation testing** (`docs/evidence/mutation/index.html`): Stryker changed the shared rules in 766 small ways; the tests caught 92.1 %. The first run caught only 48 %, which showed the early tests were weaker than their coverage figure suggested.
- **Coverage of source files** (`docs/evidence/COVERAGE_REPORT.txt`, test files excluded, server and shared code): **97.80 % lines, 82.63 % branches, 93.39 % functions, 93.71 % statements** (an earlier run of the same code gave 97.88 % lines and 93.56 % functions; a few timing-dependent lines in the rate limiter and backup code are not hit on every run). Lowest line coverage: `backup.js` 90 %, `mailer.js` 88 % (provider error paths), `assistant.js` 94 %. The React client is exercised by the browser tests but is not part of the coverage figure.
- **Accessibility** (TC-E2E-10): axe-core with the WCAG 2.0/2.1 A and AA rule sets, 24 routes (9 public, 13 signed-in student, 2 administrator) at 360, 768 and 1280 px: no serious or critical violation after fixing the issues the first run found (avatar contrast, a mismatched accessible name, missing link underlines, a progressbar without a name, an unlabelled field, nested interactive controls, scrollable regions without keyboard access).
- **Load** (50 users x 40 requests, 70 % reads / 30 % writes, real PostgreSQL, in-process HTTP stack): 2,000 requests, p50 about 110 ms, p95 about 200 ms, max about 360 ms (two runs gave 108, 195, 350 and 119, 216, 372 ms), 0 server errors; NFR-018 asks for p95 < 2 s. The 15-minute k6 run was not executed.
- **Backup/restore** (NFR-008): `TC-D10` takes a `pg_dump`, checks the SHA-256, restores into a scratch database, compares per-table row counts with the manifest and detects a tampered dump.
- **Honest reading of coverage.** Branch coverage is lower (82 %) because defensive branches in `services.js` and `validators.js` (type checks on malformed input) are not individually driven. Line coverage shows each use case ran; the partition tables in section 3 show which input classes were chosen.

## Traceability: every automated test case (plan -> test)

| ID | Test | File |
|---|---|---|
| TC-V01 | task title: 3-20 characters | `tests/validators.test.js` |
| TC-CA-01..08 | team piece A `normaliseTags`: trim and lower case, comma string, duplicates, empty, 30-character limit, 8-tag limit, bad input, input not changed (skipped until written) | `tests/contrib/tags.test.js` |
| TC-CB-01..08 | team piece B `matchScore`: identical, disjoint, partial, case, empty lists, repeats, rounding, bad input (skipped until written) | `tests/contrib/match.test.js` |
| TC-CD-01..08 | team piece D `formatFileSize`: bytes, KB, MB, GB, one terabyte stays GB, one-decimal rounding, bad input, part of a byte (skipped until written) | `tests/contrib/fileSize.test.js` |
| TC-CC-01..08 | team piece C `relativeTime`: just now, minutes, hours, yesterday, days, date after 30 days, input types, invalid date (skipped until written) | `tests/contrib/relativeTime.test.js` |
| TC-V02 | task description: max 250 characters | `tests/validators.test.js` |
| TC-V03 | tags: at most 3, no duplicates, valid characters | `tests/validators.test.js` |
| TC-V04 | file: exactly 10 MiB accepted, 10.1 MB rejected with 413 | `tests/validators.test.js` |
| TC-V05 | file: unsupported type and empty file rejected | `tests/validators.test.js` |
| TC-V06 | file name sanitising strips paths | `tests/validators.test.js` |
| TC-V07 | escapeHtml neutralises script injection (NFR-004) | `tests/validators.test.js` |
| TC-V08 | email | `tests/validators.test.js` |
| TC-V09 | password rules and strength | `tests/validators.test.js` |
| TC-R01 | request: only pending can move (NFR-009) | `tests/rules.test.js` |
| TC-R02 | request: recipient accepts, sender withdraws | `tests/rules.test.js` |
| TC-R03 | allowance: used, remaining, blocked; returned requests free allowance | `tests/rules.test.js` |
| TC-R04 | compensation: weighted bonus | `tests/rules.test.js` |
| TC-R05 | compensation: ratio capped at 1 | `tests/rules.test.js` |
| TC-R06 | compensation: <3 feedback or inactive -> bonus 0 and flagged | `tests/rules.test.js` |
| TC-R07 | compensation: missing target flagged, never silent | `tests/rules.test.js` |
| TC-R08 | statement: cannot be paid without approval | `tests/rules.test.js` |
| TC-R09 | filterAndPage: search, skills, pagination | `tests/rules.test.js` |
| TC-R10 | field visibility (FR-005) | `tests/rules.test.js` |
| TC-R11 | notifications: essential bypass pause and category off | `tests/rules.test.js` |
| TC-A01 | password hash is salted bcrypt, never the raw password (NFR-002) | `tests/auth.test.js` |
| TC-A02 | verifyPassword accepts the right password and rejects others | `tests/auth.test.js` |
| TC-A03 | JWT round trip carries the subject and expiry (8 h) | `tests/auth.test.js` |
| TC-A04 | expired, forged and malformed tokens are rejected (401 path) | `tests/auth.test.js` |
| TC-A05 | encrypted storage: round trip, ciphertext differs, tamper detected, ids are safe | `tests/auth.test.js` |
| TC-A06 | Production seeding gives demo accounts a random password; development and RCMP_DEMO_LOGIN=1 keep the public one | `tests/auth.test.js` |
| TC-D01 | UNIQUE email, case-insensitive (F1, NFR-009) | `tests/db.test.js` |
| TC-D02 | CHECK constraints reject impossible roles, statuses and visibility | `tests/db.test.js` |
| TC-D03 | file size is capped at 10 MiB by the database itself (FR-029) | `tests/db.test.js` |
| TC-D04 | only one pending request per sender/project/recipient/type (F4) | `tests/db.test.js` |
| TC-D05 | one statement per researcher and period (FR-055) | `tests/db.test.js` |
| TC-D06 | Unit of Work: inserts, updates, deletes and ordering are persisted in one commit | `tests/db.test.js` |
| TC-D07 | an error rolls back EVERYTHING - no partial record (NFR-009, NFR-010) | `tests/db.test.js` |
| TC-D08 | a constraint failure at commit time also rolls back the whole request | `tests/db.test.js` |
| TC-D09 | project membership table follows project.members and cascades on delete | `tests/db.test.js` |
| TC-D10 | backup + restore: record counts and checksums match the manifest (NFR-008) | `tests/db.test.js` |
| TC-API-01 | register: field-level 400, duplicate 409, success 201 with token (F1, NFR-007) | `tests/api.test.js` |
| TC-API-02 | credentials stored as salted hashes, never plain text (NFR-002) | `tests/api.test.js` |
| TC-API-03 | login: same 401 for unknown email and wrong password (no enumeration, NFR-004) | `tests/api.test.js` |
| TC-API-04 | logs never contain passwords, tokens or bodies (NFR-016) | `tests/api.test.js` |
| TC-API-05 | missing, forged and expired tokens give 401 (NFR-001) | `tests/api.test.js` |
| TC-API-06 | roles: students cannot reach admin or compensation functions (403) | `tests/api.test.js` |
| TC-API-07 | profile visibility is enforced server-side (FR-005, NFR-005) | `tests/api.test.js` |
| TC-API-08 | profile update validates input and strips markup (NFR-004, NFR-007) | `tests/api.test.js` |
| TC-API-09 | account export and deletion (NFR-006) | `tests/api.test.js` |
| TC-API-10 | search is paginated, parameterised and hides private/summary data (F3, NFR-015, NFR-004) | `tests/api.test.js` |
| TC-API-11 | skill filter and people search respect listing choices (FR-012, FR-013) | `tests/api.test.js` |
| TC-API-12 | project brief: 400 fields, 201 create, owner stored, non-owner edit 403 (F2) | `tests/api.test.js` |
| TC-API-13 | private projects: non-member 403, summary hides detail (FR-009, NFR-001) | `tests/api.test.js` |
| TC-API-14 | closing a project declines its pending requests (F2, F4) | `tests/api.test.js` |
| TC-API-15 | interest: duplicate 409, accept creates exactly one membership (F4, NFR-009) | `tests/api.test.js` |
| TC-API-16 | concurrent accept and withdraw: one wins, one 409, one final status (F4, NFR-009) | `tests/api.test.js` |
| TC-API-17 | only the recipient may accept, only the sender may withdraw (403) | `tests/api.test.js` |
| TC-API-18 | agreement: non-member 403; stale version 409 keeps both versions (F6) | `tests/api.test.js` |
| TC-API-19 | workspace access: non-member 403, invalid token 401, unknown project 404 (NFR-001) | `tests/api.test.js` |
| TC-API-20 | task validation boundaries: title 3-20, description 250, 3 tags (F7, NFR-007) | `tests/api.test.js` |
| TC-API-21 | kanban move and delete are members-only and logged (UC-04) | `tests/api.test.js` |
| TC-API-22 | upload boundary: exactly 10 MiB accepted, 10.1 MB rejected 413 with no record (F7, NFR-018) | `tests/api.test.js` |
| TC-API-23 | upload rejects bad types/empty files and non-members (F7) | `tests/api.test.js` |
| TC-API-24 | files are encrypted at rest and only members can download them (NFR-001) | `tests/api.test.js` |
| TC-API-25 | owner-only files are hidden from other members (FR-031) | `tests/api.test.js` |
| TC-API-26 | storage failure: 500, no record and no orphan bytes (F7, NFR-010) | `tests/api.test.js` |
| TC-API-27 | database failure rolls the whole request back and says so (NFR-010) | `tests/api.test.js` |
| TC-API-28 | simulated session expiry returns 401 once and reports the consumed flag | `tests/api.test.js` |
| TC-API-29 | malformed JSON gives 400, unknown route 404, oversize body 413 | `tests/api.test.js` |
| TC-API-30 | security headers and no static access to server code (NFR-004) | `tests/api.test.js` |
| TC-API-31 | free plan blocks support (402); allowance counts and returns on decline (FR-045-047) | `tests/api.test.js` |
| TC-API-32 | payment outcomes: failed and pending never grant the plan (UC-06) | `tests/api.test.js` |
| TC-API-33 | compensation: flagged statements need an exception; paid is final (FR-052-056) | `tests/api.test.js` |
| TC-API-34 | payout failure is recorded, never shown as paid, and audited (FR-056) | `tests/api.test.js` |
| TC-API-35 | researchers see only their own statements (NFR-001) | `tests/api.test.js` |
| TC-API-36 | researcher approval is admin-only, logged and notifies (FR-049) | `tests/api.test.js` |
| TC-API-37 | reports: any user reports, admin decides, suspension signs the user out (FR-036-038) | `tests/api.test.js` |
| TC-API-38 | notifications: list, mark read, preferences and pause (FR-033-035) | `tests/api.test.js` |
| TC-API-39 | mentorship: validation 400, allowance 402 for free plan, duplicate 409, mentor-only actions (UC-05) | `tests/api.test.js` |
| TC-API-40 | support lifecycle: assign, start, complete, rate, reopen (UC-07) | `tests/api.test.js` |
| TC-API-41 | agreement lifecycle: template, validation, publish, acknowledge, stale 409 (UC-05) | `tests/api2.test.js` |
| TC-API-42 | agreement revision proposals: validate, propose, resolve once | `tests/api2.test.js` |
| TC-API-43 | invitations: owner only, validation, duplicates, existing member, accept (UC-04) | `tests/api2.test.js` |
| TC-API-44 | milestones: add (boundaries), toggle, unknown id, non-member | `tests/api2.test.js` |
| TC-API-45 | mentor search filters, accepting toggle and request listing | `tests/api2.test.js` |
| TC-API-46 | support list is role-scoped; mentors refused | `tests/api2.test.js` |
| TC-API-47 | subscription cancel needs an active plan | `tests/api2.test.js` |
| TC-API-48 | admin overview, researcher approval and audit trail | `tests/api2.test.js` |
| TC-API-49 | content reports: validate, moderate once, warn/dismiss | `tests/api2.test.js` |
| TC-API-50 | notifications and preferences round-trip | `tests/api2.test.js` |
| TC-API-51 | dashboard has role-specific blocks | `tests/api2.test.js` |
| TC-API-52 | platform: health, 404, bad JSON, bad token, security headers | `tests/api2.test.js` |
| TC-API-53 | demo simulation: db failure saves nothing; reset restores the seed | `tests/api2.test.js` |
| TC-D11 | concurrent writers are serialised: no lost updates (NFR-010) | `tests/db.test.js` |
| TC-D12 | a read-only transaction cannot change data | `tests/db.test.js` |
| TC-D13 | wipe() empties every table | `tests/db.test.js` |
| TC-PG01 | parseUrl: host, port, encoded credentials, sslmode | `tests/pg.test.js` |
| TC-PG02 | parameterised query returns typed rows | `tests/pg.test.js` |
| TC-PG03 | SQL-injection text is data, never executed (NFR-004) | `tests/pg.test.js` |
| TC-PG04 | server errors surface as PgError with SQLSTATE and constraint | `tests/pg.test.js` |
| TC-PG05 | failed statement does not poison the pooled connection | `tests/pg.test.js` |
| TC-PG06 | wrong password rejected (SCRAM); unreachable host fails | `tests/pg.test.js` |
| TC-PG07 | pool queues work beyond its size | `tests/pg.test.js` |
| TC-PG08 | withClient keeps session state; multi-statement exec | `tests/pg.test.js` |
| TC-AS-01 | Scout: every knowledge-base entry is reachable and answered | `tests/assistant.test.js` |
| TC-AS-02 | Scout: representative questions route to the right topic (equivalence classes: one per topic) | `tests/assistant.test.js` |
| TC-AS-03 | Scout: off-topic and injection-style input is declined as platform-specific | `tests/assistant.test.js` |
| TC-AS-04 | Scout: identity question answered honestly (not an LLM) | `tests/assistant.test.js` |
| TC-AS-05 | Scout: boundaries (empty, blank, 5000 chars, null, number, symbols, emoji, NUL) never throw | `tests/assistant.test.js` |
| TC-AS-06 | Scout: reply never echoes user text | `tests/assistant.test.js` |
| TC-AS-07 | Scout: links only to local pages | `tests/assistant.test.js` |
| TC-AS-08 | Scout: personalisation only when signed in | `tests/assistant.test.js` |
| TC-AS-09 | Scout: plan prices come from shared constants | `tests/assistant.test.js` |
| TC-CT-01 | Contact: anyone sends a message; stored; admin inbox shows it | `tests/contact.test.js` |
| TC-CT-02 | Contact: each invalid field rejected; boundaries 3/100 and 10/1000 accepted | `tests/contact.test.js` |
| TC-CT-03 | Contact: markup stored as inert text (NFR-004) | `tests/contact.test.js` |
| TC-CT-04 | Contact: honeypot stores nothing | `tests/contact.test.js` |
| TC-CT-05 | Contact: only administrators read or change messages | `tests/contact.test.js` |
| TC-CT-06 | Contact: read, answered, unknown id/status, audit entry | `tests/contact.test.js` |
| TC-CT-07 | Contact: admins notified; per-client rate limit 429 | `tests/contact.test.js` |
| TC-CT-08 | Real administrator account exists, demo password rejected, receives contact notifications | `tests/contact.test.js` |
| TC-CT-09 | Administrator password reset script: weak, non-admin and unknown targets refused; old password stops working | `tests/contact.test.js` |
| TC-CS-01 | Every server status has a badge style on the client (NFR-012) | `tests/consistency.test.js` |
| TC-CS-02 | Multi-word statuses have readable labels | `tests/consistency.test.js` |
| TC-CS-03 | Roles named consistently across the client | `tests/consistency.test.js` |
| TC-E2E-14 | Phone navigation: hamburger, all links, Esc, no horizontal scroll | `tests/e2e/e2e.test.js` |
| TC-E2E-15 | Pricing page, 3-D globe canvas, single favicon/logo on every page, disclaimer removed | `tests/e2e/e2e.test.js` |
| TC-E2E-16 | Contact page end to end: validation, send, admin Messages tab | `tests/e2e/e2e.test.js` |
| TC-E2E-17 | Contact form: red errors clear field by field as input becomes valid; form card does not tilt | `tests/e2e/e2e.test.js` |
| TC-E2E-18 | Landing footer contact strip and company column; hero depth badges; no monospace labels | `tests/e2e/e2e.test.js` |
| TC-E2E-19 | E-mail verification on: register, code page, wrong code refused, right code signs in | `tests/e2e/e2e.test.js` |
| TC-E2E-20 | Terms, Cookies and Privacy pages: own title and meta description; footer link reaches Terms; Contact page shows the mailto link | `tests/e2e/e2e.test.js` |
| TC-E2E-21 | Dark theme: toggle switches, choice survives a reload, axe colour contrast passes on all 9 public pages | `tests/e2e/e2e.test.js` |
| TC-E2E-22 | Scroll progress bar grows and the back-to-top button returns to the top | `tests/e2e/e2e.test.js` |
| TC-E2E-23 | Sidebar: menu button hides it on a wide screen, edge tab restores it, choice survives a reload | `tests/e2e/e2e.test.js` |
| TC-AS-API-01..07 | Scout endpoint: public, off-topic, personalised, bad token, validation (empty/blank/number/301 chars), no reflection, rate limit 429 | `tests/assistant.api.test.js` |
| TC-E2E-12 | Scout in Chromium: hover vibration, open, answer, refusal, Esc and second click close | `tests/e2e/e2e.test.js` |
| TC-E2E-13 | Scout signed in: personalised, markup not rendered, fits a 390 px phone | `tests/e2e/e2e.test.js` |
| TC-V10..V22 | exact boundaries of every validator (email, password, name, task, tags, file, file name, message, brief, mentorship request, profile, feedback) | `tests/validators2.test.js` |
| TC-R12..R19 | compensation formula and flags, statement states, request actors, allowance give-back | `tests/rules2.test.js` |
| TC-PB-01..08 | property-based: title length, HTML escaping, file names, idempotent cleaning, final request states, allowance, e-mail | `tests/property.test.js` |
| TC-SEC-01..11 | security: SQL injection, forged tokens, wrong roles, headers, bad JSON, stored markup, path tricks, hash leakage, throttle, JSON 404, hidden files and project folders return 404 | `tests/security.test.js` |
| TC-CT-01..06 | API contract: login, validation errors, search, dashboard, notifications, error shape | `tests/contract.test.js` |
| TC-SM-01..04 | smoke: health, built client, old links, demo sign-in | `tests/smoke.test.js` |

## 6. Manual UI checklist (demo script)

Run `npm start`, open http://localhost:3000, sign in with the buttons on the login page. Use **Demo tools** (bottom-right) for the failure cases.

| # | Steps | Expected |
|---|---|---|
| M1 | Register with a bad email / short password | Field errors under each input; nothing created |
| M2 | Sign in as Aisha → Discover, filter by skill, page through results | Cards update; private project absent |
| M3 | Open *Multimodal Neural Architectures* → Workspace → New task, 21-character title | Inline error, counters, nothing saved |
| M4 | Add a task with 4 tags | Fourth tag refused |
| M5 | Upload a small file, then "Try a 10.1 MB file" | First succeeds; second shows 413 |
| M6 | Download the uploaded file | Browser downloads the decrypted original |
| M7 | Demo tools → *Database save fails* → create a task | Error toast, task absent after reload |
| M8 | Demo tools → *Session expires* → click anything | Signed-out notice, redirect to sign in, returns to the page after login |
| M9 | Demo tools → *Offline* | Offline notice, nothing sent |
| M10 | Elena (owner) edits the agreement in two tabs, save in both | Second save gets 409 stale-version message |
| M11 | Priya (free plan) → Researcher support → New request | Blocked with plan-limit message |
| M12 | Priya → Subscription → choose a plan, pick *Payment fails* | No plan change |
| M13 | Admin → Compensation → flagged statement → Approve | Refused until an exception is recorded |
| M14 | Admin → Compensation → approved statement → payout, *Payout fails* | Shown as *payout failed*, never *paid* |
| M15 | Resize to 390 px, open Dashboard, Discover, Workspace | No horizontal page scroll; sidebar becomes a drawer |
| M16 | Keyboard only: Tab to a kanban card, use *Move to…* | Card moves; focus visible; toasts announced |


## 7. Not covered by automated tests

Real Safari and real phones (Firefox and WebKit run only in GitHub Actions), screen-reader use, the offline/session-expiry/edit-conflict screens (manual M7-M10), the 15-minute k6 soak, real payment-provider behaviour, TLS to the database, and multi-process concurrency (one server process was tested). Listed so that the report can state coverage honestly.
