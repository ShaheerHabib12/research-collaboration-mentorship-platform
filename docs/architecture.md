# Architecture and changes from the Coursework 1 design

The system follows the Coursework 1 design: a **closed three-layer modular monolith** (each layer calls only the layer below) built on the claimed stack: React 18 + Vite, Node.js 24 LTS + Express 5, PostgreSQL 16 through `pg`, bcrypt, helmet, cors, JWT, Jest + Supertest, Cypress + axe-core, OWASP ZAP, k6, Docker Compose and GitHub Actions.

## Three tiers

```
 Browser (tier 1)                  Node + Express (tier 2)                        Database (tier 3)
 ┌─────────────────────┐  HTTPS  ┌───────────────────────────────────────────┐  ┌────────────────────┐
 │ React 18 SPA (Vite) │  JSON   │ app.js      C2 gateway: helmet CSP, cors,  │  │ PostgreSQL 16      │
 │ react-router, lazy  │ ──────► │             throttles, JWT, error mapping, │  │ 19 tables, FKs,    │
 │ pages, shared rules │ ◄────── │             serves client/dist             │──│ UNIQUE + CHECK     │
 │ (validators, rules, │         │ services.js C3-C7, C10 business logic      │  │ constraints, RLS   │
 │  constants - UMD)   │         │ auth.js     bcrypt + JWT (C2)              │  │                    │
 └─────────────────────┘         │ db.js       Unit of Work, transactions     │  │                    │
                                 │ pool.js     pg connection pool             │  │                    │
                                 │ storage.js  C9 AES-256-GCM file store ─────┼─►│ data/files/*.bin   │
                                 │ mailer.js   sign-up PIN and reset e-mail   │  │ (encrypted)        │
                                 │ backup.js   NFR-008 (pg_dump + verify)     │  └────────────────────┘
                                 └───────────────────────────────────────────┘
```

| Report component | Where it lives |
|---|---|
| C1 Web client | `client/src` (pages, components, hooks, lib), built by Vite into `client/dist` |
| C2 API gateway / auth | `server/app.js`, `server/auth.js` |
| C3 Accounts and profiles | `services.js` (register, login, e-mail PIN, profiles, export, delete) |
| C4 Projects, requests, agreement | `services.js` |
| C5 Mentorship and researcher support | `services.js` |
| C6 Workspace | `services.js` (tasks, milestones, files) |
| C7 Administration and moderation | `services.js` (researchers, reports, contact inbox, audit) |
| C9 Encrypted file storage | `server/storage.js` |
| C10 Subscription and compensation | `services.js` + `shared/rules.js` (pure formula); sandbox payment provider |
| Notifications | `services.js` (`notify`, preferences) |
| E-mail (sign-up PIN, reset link) | `server/mailer.js` (HTTPS API client for Brevo or Resend), PIN rules in `auth.js`; `docs/EMAIL_SETUP.md` |
| Scout assistant | `server/assistant.js`, `client/src/components/Scout.jsx` |

**Request pipeline:** helmet headers → HTTPS redirect (optional) → CORS → throttles → JSON body → verify JWT → route → *one* database transaction → JSON response. The response is only sent after `COMMIT`, so "saved" is never reported for data that was not stored (NFR-010). Any thrown error rolls the whole request back.

**Single-page client.** Express serves `client/dist` and falls back to `index.html` for client routes. A 301 redirect maps legacy `/page.html` links (kept in seed data, notifications and e-mails) to the clean routes (`/page`).

**Shared rules.** `shared/validators.js`, `rules.js` and `constants.js` are loaded by both the browser (instant feedback) and the server (authority). The server never trusts the browser: every limit is re-checked, and the database repeats the most important ones as `CHECK`/`UNIQUE` constraints. `shared/contrib/` holds three small pure functions (`normaliseTags`, `matchScore`, `relativeTime`) written by team members; they are not called by the app yet and have their own tests in `tests/contrib` (`docs/CONTRIBUTING_STEPS.md`).

## Changes from the Coursework 1 design (for report section 3.2)

The first implementation drifted from Coursework 1 (vanilla JavaScript, `node:http`, a home-made PostgreSQL driver, scrypt, `node:test`). That has been reversed; the implementation now matches the claimed stack. What differs or was added:

| Item | Coursework 1 | Built | Why / impact |
|---|---|---|---|
| Scout help assistant | not in the design | retrieval assistant over a curated knowledge base (`assistant.js`) | Added to help new users; not an LLM, sends no user text to a third party. New component, no change to the layers. |
| Public pricing and contact pages | not in the design | `/pricing`, `/contact`, thank-you page, administrator inbox (Messages tab) | Added so visitors can see plans and reach the team. Table `contact_messages`, endpoints `/api/contact` and `/api/admin/messages`. |
| E-mail PIN verification | FR-001 registration | optional 6-digit PIN by e-mail (HMAC-stored, 10 min, 5 tries) when a mail provider is configured | Stronger sign-up; off when no provider is set so a local run needs no e-mail account. |
| Hosting target | not specified | Render (Express serves the built client); Supabase PostgreSQL through the Session pooler (`?sslmode=require`) | Vercel is unsuitable for a long-running Express server. |
| Real administrator account | not specified | `muhammad.habib@myport.ac.uk`, created on first start with its own password | Separates the real admin from demo accounts. |
| Payment provider (C10) | external provider | **sandbox** outcome selector (success / failed / pending) | No provider test-mode account was available; entitlements change only on confirmed success. |
| TLS (NFR-003) | HTTPS | provided by the host or reverse proxy; the app redirects and sends HSTS with `RCMP_FORCE_HTTPS=1` | Node does not terminate TLS itself in this design. |
| Cypress, k6, ZAP, Docker, GitHub Actions | specified | files written (`cypress/`, `k6/`, `.zap/`, `Dockerfile`, `.github/workflows/ci.yml`) | Cypress, k6 and ZAP run in GitHub Actions (links in `EVIDENCE.md`). Docker could not be run in the build sandbox; Playwright + axe-core and a Node load test were also run locally for the same checks (see `TEST_PLAN.md`). |

## Data model (tables)

`users`, `projects`, `project_members`, `requests`, `agreements`, `tasks`, `files`, `activity`, `mentor_requests`, `support_requests`, `subscriptions`, `billing_events`, `statements`, `reports`, `contact_messages`, `audit_log`, `notifications`, `notification_prefs`, `meta`.

Integrity enforced by the database itself:

- `users.email` UNIQUE (case-insensitive); role and status `CHECK`
- one *pending* request per sender/project/recipient/type (partial unique index) - NFR-009
- request/statement/task status values `CHECK`
- `files.size` between 1 byte and 10 MiB `CHECK` - FR-029
- one statement per researcher and period `UNIQUE` - FR-054
- `project_members` primary key (project, user); cascade delete from project and user

Each row also holds the full entity as JSONB in `data`, next to the constrained columns above. This keeps the domain code simple and is why the **Unit of Work** exists:

1. A request starts a transaction: `BEGIN` (writes) or `BEGIN ISOLATION LEVEL REPEATABLE READ` (reads).
2. Writers take `pg_advisory_xact_lock(727001)`, so two writers never interleave. This is what stops lost updates (test TC-D11: 12 concurrent increments, none lost; TC-API-16: accept vs withdraw race gives exactly one 200 and one 409).
3. All collections are loaded with one `UNION ALL` query into plain objects; the business code in `services.js` mutates them synchronously.
4. At commit the snapshot is diffed and only changed rows are written as parameterised `INSERT/UPDATE/DELETE`, sent sequentially in the same transaction. Foreign keys are `DEFERRABLE INITIALLY DEFERRED`, so parents and children can be written in one commit and violations surface at `COMMIT`.
5. Any exception means `ROLLBACK` (the demo conflict simulation is the one deliberate exception).
6. Read-only requests that try to change data fail with a 500 and are caught in testing (TC-D12). `GET /agreement` is the one GET that lazily creates a record, so it runs as a write transaction.

## Security measures (NFR-001 - 004, 016)

- Passwords: bcrypt (12 rounds), constant-time compare; an unknown e-mail costs the same work (no timing oracle); identical 401 message (no account enumeration).
- Sessions: HS256 JWT (`jsonwebtoken`), 8 h expiry, verified on every request; suspended accounts are rejected even with a valid token. Each token carries a fingerprint of the password hash (`pv`) and a `purpose` claim, so changing the password signs out every older session and a reset token cannot be used as a session.
- Account recovery (FR-002): signed, single-use, 30-minute reset token; the forgot endpoint answers identically for known and unknown e-mails. Without a mail provider the link is shown only in demo mode.
- E-mail PIN: CSPRNG 6 digits, stored only as an HMAC, 10-minute life, 5 attempts, 60 s resend gap, 5 sends per hour.
- HTTP hardening: `helmet` (CSP with `script-src 'self'`, no inline or eval scripts; `frame-ancestors 'none'`; `nosniff`); API responses `no-store`; `cors` closed unless configured; HSTS and a redirect behind `RCMP_FORCE_HTTPS=1`; `X-Forwarded-For` ignored by throttles unless `RCMP_TRUST_PROXY=1`.
- Throttles: login 8 failures / 10 min, registration + verify + resend 12 / 10 min, contact 5 / 10 min, assistant 30 / min (HTTP 429).
- Authorisation: role check and membership check in every service; non-members get 403 for private content, admins do **not** get private workspaces; unknown or hidden records return 404.
- Files: AES-256-GCM, random IV per file, opaque storage ids (no path traversal), downloads served as an attachment with `nosniff`.
- Output: React escapes all text; inputs are sanitised on the server; all SQL is parameterised.
- Logs: method, path, status, duration, user id only; never bodies, passwords or tokens (tested).
- Demo switches (`X-RCMP-Sim`, `/api/demo/reset`) exist only when `NODE_ENV` is not `production`.
- Database: row-level security is enabled in the Supabase script (`supabase/`); the application connects with its own role.

## Known limitations (honest list for the "issues" discussion)

1. **Writers are serialised by one advisory lock and every request loads whole collections.** Fine for the target of 50 concurrent users (`npm run load`, `k6/load.js`); beyond a few hundred users the Unit of Work must be replaced by indexed per-entity queries.
2. **JWT in `localStorage`.** An XSS bug would expose it; mitigated by escaping and a strict CSP, not eliminated. An `HttpOnly` cookie with CSRF protection is the stronger design.
3. **No logout revocation or refresh tokens.** Tokens expire after 8 h; changing the password revokes all of them.
4. **The CSP is strict for scripts and styles** (`'self'` only, no `'unsafe-inline'`, no other origins). React sets styles through the browser's style object, which the policy allows. `Cross-Origin-Embedder-Policy: require-corp` is sent because nothing is loaded from another origin.
5. **Throttles are in memory**, per process; use a shared store for several instances.
6. **No malware scanning** of uploads; type and size are validated only.
7. **Payments and payouts are sandbox simulations**; no real provider is called.
8. **Browser tests run in Chromium locally; Firefox and WebKit run only in GitHub Actions** (with one retry on a timing failure). Real Safari and real phones are untested.
9. **Docker and the 15-minute k6 run have not been executed yet** by the team (see `TEST_PLAN.md`).
10. **No real-user usability study yet** (NFR-014).
