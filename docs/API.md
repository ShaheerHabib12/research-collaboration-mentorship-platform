# REST API

Base URL `http://localhost:3000`. JSON in and out. Authenticate with `Authorization: Bearer <jwt>` (from `/api/auth/login` or `/api/auth/register`).

**Errors** are `{ "error": "message", ...extra }` with these statuses (specification Tables 7 and 13):

| Status | Meaning | Extra fields |
|---|---|---|
| 400 | validation failed | `fields: { name: "message" }` |
| 401 | not signed in / expired / account unavailable | |
| 402 | plan does not allow it | `reason: "no_plan" \| "exhausted"` |
| 403 | role or membership does not allow it | |
| 404 | not found (also used to hide records you may not see) | |
| 409 | duplicate, stale version, already decided, lost race | |
| 413 | file larger than 10 MiB | |
| 429 | too many sign-in attempts (8 failures per 10 minutes per client address) | |
| 500 | storage / database failure - **nothing was saved** | |

Searches take `?f=<url-encoded JSON filters>&page=n`. File upload is `POST /api/projects/:id/files` with the raw bytes as the body and headers `X-File-Name` (URL-encoded) and `X-File-Permission` (`team` or `owner`).

Demo-only (disabled when `NODE_ENV=production`): header `X-RCMP-Sim: {"dbFail":true,"expireNext":true,"conflictNext":true,"storageFail":true}` and `POST /api/demo/reset`. The response header `X-RCMP-Sim-Consumed` lists one-shot flags that were used.

Other: `GET /api/health`.

| Method | Path | Success |
|---|---|---|
| POST | `/api/auth/register` | 201 |
| POST | `/api/auth/login` | 200 |
| POST | `/api/auth/logout` | 200 |
| POST | `/api/auth/forgot` | 200 - same answer for known and unknown emails; `resetToken` is returned only in demo mode (production would email it) |
| POST | `/api/auth/reset` | 200 - body `{token, password}`; the link is single-use and valid 30 minutes; all older sessions are signed out |
| GET | `/api/me` | 200 |
| GET | `/api/summary` | 200 |
| GET | `/api/profile` | 200 |
| PUT | `/api/profile` | 200 |
| GET | `/api/profiles/:id` | 200 |
| GET | `/api/me/export` | 200 |
| DELETE | `/api/me` | 200 |
| GET | `/api/dashboard` | 200 |
| GET | `/api/projects/search` | 200 |
| GET | `/api/people/search` | 200 |
| GET | `/api/projects` | 200 |
| POST | `/api/projects` | 201 |
| GET | `/api/projects/:id` | 200 |
| PUT | `/api/projects/:id` | 200 |
| POST | `/api/projects/:id/status` | 200 |
| POST | `/api/projects/:id/interest` | 201 |
| POST | `/api/projects/:id/invitations` | 201 |
| GET | `/api/requests` | 200 |
| POST | `/api/requests/:id/act` | 200 |
| GET | `/api/projects/:id/agreement` | 200 |
| PUT | `/api/projects/:id/agreement` | 200 |
| POST | `/api/projects/:id/agreement/acknowledge` | 200 |
| POST | `/api/projects/:id/agreement/proposals` | 200 |
| POST | `/api/projects/:id/agreement/proposals/:id` | 200 |
| GET | `/api/projects/:id/workspace` | 200 |
| POST | `/api/projects/:id/tasks` | 201 |
| PUT | `/api/projects/:id/tasks/:id` | 200 |
| POST | `/api/projects/:id/tasks/:id/move` | 200 |
| DELETE | `/api/projects/:id/tasks/:id` | 200 |
| POST | `/api/projects/:id/milestones` | 201 |
| POST | `/api/projects/:id/milestones/:id/toggle` | 200 |
| GET | `/api/projects/:id/files/:id` | 200 |
| GET | `/api/projects/:id/files/:id/content` | 200 |
| DELETE | `/api/projects/:id/files/:id` | 200 |
| GET | `/api/mentors/search` | 200 |
| PUT | `/api/mentors/accepting` | 200 |
| POST | `/api/mentorship-requests` | 201 |
| GET | `/api/mentorship-requests` | 200 |
| POST | `/api/mentorship-requests/:id/act` | 200 |
| POST | `/api/support` | 201 |
| GET | `/api/support` | 200 |
| POST | `/api/support/:id/act` | 200 |
| POST | `/api/support/:id/feedback` | 200 |
| GET | `/api/subscription` | 200 |
| POST | `/api/subscription` | 200 |
| POST | `/api/subscription/settle` | 200 |
| DELETE | `/api/subscription` | 200 |
| GET | `/api/statements` | 200 |
| POST | `/api/statements/:id/act` | 200 |
| GET | `/api/admin/overview` | 200 |
| GET | `/api/admin/researchers` | 200 |
| PATCH | `/api/admin/researchers/:id` | 200 |
| POST | `/api/reports` | 201 |
| GET | `/api/admin/reports` | 200 |
| POST | `/api/admin/reports/:id/act` | 200 |
| GET | `/api/admin/audit` | 200 |
| GET | `/api/notifications` | 200 |
| POST | `/api/assistant` | 200 `{reply, links, chips, topic, inScope}` - public (a valid token only adds a personal sentence); 400 empty or over 300 characters; 429 over 30 questions a minute per client. Never writes. |
| POST | `/api/notifications/:id/read` | 200 |
| GET | `/api/notification-prefs` | 200 |
| PUT | `/api/notification-prefs` | 200 |

All `/api/*` responses carry `Cache-Control: no-store`. Cross-origin access is closed by default outside demo mode; set `corsOrigin` in `createApp` to allow one origin. With `RCMP_FORCE_HTTPS=1` plain HTTP is redirected (308) and `Strict-Transport-Security` is sent; set `RCMP_TRUST_PROXY=1` only behind a proxy you control (it makes the login throttle use `X-Forwarded-For`).

## Contact (added in Iteration 2)

| Method and path | Auth | Purpose | Status codes |
|---|---|---|---|
| `POST /api/contact` | public | Send the team a message (name, email, topic, subject 3-100, message 10-1000, hidden `website` honeypot). Rate limit 5 per 10 minutes per client. | 201, 400 (field messages), 429 |
| `GET /api/admin/contact` | admin | Inbox, newest first | 200, 401, 403 |
| `POST /api/admin/contact/:id/status` | admin | Mark `new`, `read` or `answered`; audited | 200, 400, 401, 403, 404 |


## Email verification (only when e-mail is configured)

| Method and path | Purpose | Success | Errors |
|---|---|---|---|
| `POST /api/auth/register` | Creates the account. With verification on it returns `{pending:true,email,resendSeconds,emailSent?}` and no token. | 201 | 400 fields, 409 email taken, 429 too soon |
| `POST /api/auth/verify` `{email,pin}` | Confirms the 6-digit PIN and signs the user in `{token,user}`. | 200 | 400 wrong, malformed or expired PIN (`fields.pin`), 429 five wrong tries |
| `POST /api/auth/resend` `{email}` | Sends a new PIN. Same answer for unknown and known emails. | 200 | 429 client limit |
| `POST /api/auth/login` | An unconfirmed account gets 403 with `code: "email_unverified"`. | | |
