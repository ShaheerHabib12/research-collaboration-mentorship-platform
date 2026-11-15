# Security notes

This file lists what RCMP does to protect its users and data, which tests check each point, and what is left over. It describes the code as it is, not a wish list.

## Controls in the code

| Area | What the code does | Where |
|---|---|---|
| Passwords | Hashed with bcrypt, 12 rounds. Strength rules are shared by browser and server. | `server/auth.js`, `shared/validators.js` |
| Sessions | JWT signed with HS256, valid for 8 hours. Claims carry a password version (`pv`) and a purpose, so a password change or a reset token cannot be reused as a login. | `server/auth.js` |
| Rate limits | Sign-in 8 per 10 minutes, auth routes 12 per 10 minutes, contact form 5 per 10 minutes, assistant 30 per minute. | `server/app.js` |
| Access control | Every route checks role and ownership on the server. The browser never decides. | `server/services.js` |
| Input | Validated on the server with the same rules the forms use. Queries are parameterised. | `shared/validators.js`, `server/db.js` |
| Output | React escapes everything it renders. Messages typed by users are shown as text. | `client/src` |
| Headers | helmet with a strict Content-Security-Policy (`script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`). | `server/app.js` |
| Files | Uploads are limited to 10 MiB, file names are cleaned, and the stored bytes are encrypted with AES-256-GCM. | `server/storage.js` |
| Hidden files | Any URL with a dot-folder or file (such as `/.env` or `/.git/config`) and any project folder (`/data`, `/server`, `/shared`, `/tests`, `/docs`, `/scripts`, `/node_modules`) returns 404, not the app page. | `server/app.js` |
| Secrets | Production refuses to start without `RCMP_JWT_SECRET`, `RCMP_FILE_KEY` and `DATABASE_URL`. `.env` is git-ignored and `.env.example` holds placeholders only. | `server/index.js`, `.env.example` |
| Demo tools | Demo accounts, simulation headers and reset only work when the server is not in production mode. | `server/app.js` |
| Demo accounts in production | When `NODE_ENV=production`, the sample accounts are seeded with a random password nobody knows, so the sample projects are visible but nobody can sign in as a demo user. `RCMP_DEMO_LOGIN=1` restores the public demo password. | `server/seed.js` (`demoSecret`), TC-A06 |
| Reporting | `/security.txt` gives the address to report a problem to. `robots.txt` keeps crawlers away from the API and the signed-in pages. | `client/public` |

## How it is tested

| Check | Test |
|---|---|
| Injection, broken access, token attacks, headers, oversized and malformed input, file-name tricks | `tests/security.test.js` (TC-SEC-01 to TC-SEC-11) |
| Hidden files and project folders return 404, `robots.txt` and `security.txt` are served | TC-SEC-11 |
| Dependencies | `npm audit --omit=dev` (0 known vulnerabilities when last run) |
| Static scan of the running app | OWASP ZAP baseline in `.zap` and CI. First run on GitHub Actions: 0 FAIL, 7 WARN, 63 PASS. Fixed in code: Permissions-Policy, Cross-Origin-Embedder-Policy, no inline styles in the CSP, fonts bundled with the app instead of an outside font link. Ignored with a reason in `.zap/rules.tsv`: 10049 (API answers are `no-store` on purpose), 10109 (single-page-app note), 90005 (the scanner leaves out Sec-Fetch-Dest), 10094 (Base64 Disclosure: the bundled font stylesheet has no base64 data; a search of the built file found none). Commit `c6654e9`: 0 FAIL, 1 WARN (10094), 66 PASS, 4 ignored. Commits `1d0729f` and `f1b2b17`, after ignoring 10094: **0 FAIL, 0 WARN, 66 PASS, 5 ignored** on every run |

## Known limits

- The session token is kept in `localStorage`, so a cross-site scripting hole would expose it. The strict CSP and React's escaping are the defences. Moving to an HttpOnly cookie would also need CSRF protection and is listed as future work.
- Payments and the e-mail provider are simulated. No card data is ever collected or stored.
- Rate limits are held in memory. With more than one server process they would need a shared store such as Redis.
- Run `git log -p | grep -i -E "password|secret|key"` on your own repository before submitting, to confirm no real secret was ever committed.

## Reporting a problem

E-mail muhammad.habib@myport.ac.uk with the page, the steps and what you saw. Please do not test against other people's accounts.
