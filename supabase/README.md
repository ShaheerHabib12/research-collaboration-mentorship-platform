# Deploying RCMP with Supabase (database) and a Node host

## 1. Is the plan correct?

| Part of your plan | Verdict |
|---|---|
| PostgreSQL on **Supabase** | Works. The server speaks the PostgreSQL protocol directly (SCRAM-SHA-256 and TLS are supported), so a Supabase database is just another PostgreSQL 16 server. |
| A "PostgreSQL file" | `supabase/schema.sql` (this folder). It is generated from the server code (`npm run schema`) and tested (TC-SQ-01 to 04). The server also creates the tables on first start, so running the file is optional but lets you check the database first. |
| Hosting on **Vercel** | **Not as it stands.** Vercel runs short-lived serverless functions. RCMP is one long-running Node server (`node server/index.js`) that (a) keeps encrypted uploads on local disk, which Vercel wipes between requests, and (b) keeps login throttling and rate limits in memory, which serverless instances do not share. |

**Recommended:** keep Supabase for the database and host the Node server on a service that runs a normal process: Render, Railway or Fly.io all work with the included `Dockerfile` or with `npm start`. Use a persistent disk for `RCMP_DATA_DIR` (uploaded files). If you must use Vercel, the code needs changes first: uploads moved to Supabase Storage, rate limits moved into the database, and the server wrapped as a function. That is a separate piece of work, so ask before starting it.

## 2. Create the database (Supabase)

1. supabase.com > New project. Choose a region near your host and save the database password.
2. SQL Editor > New query > paste `supabase/schema.sql` > Run. You should see "Success".
3. Table Editor: 19 tables, each marked "RLS enabled". This is intentional. The file turns on row level security with no policies, so the public `anon` key from Supabase cannot read or change any data. Only your server can, through its own connection.
4. Project Settings > Database > Connection string. Copy the **Session pooler** string (port 5432). It looks like `postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`. Use it because the direct connection is IPv6 only and many hosts cannot reach it. Add `?sslmode=require` at the end. If your password contains `@`, `:` or `/`, percent-encode it.
5. The transaction pooler (port 6543) also works with this server (it uses no named prepared statements), but the session pooler is the safer first choice.

## 3. Set environment variables on the host

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the string from step 2.4 |
| `RCMP_JWT_SECRET` | 32 or more random characters, for example `openssl rand -hex 32` |
| `RCMP_FILE_KEY` | exactly 64 hex characters: `openssl rand -hex 32` |
| `RCMP_ADMIN_EMAIL`, `RCMP_ADMIN_NAME` | the real administrator (defaults in `.env.example`) |
| `RCMP_ADMIN_PASSWORD` | a strong password, set as a secret. If empty, a random one is printed once in the log at the first start. |
| `RCMP_FORCE_HTTPS`, `RCMP_TRUST_PROXY` | `1` and `1` behind the host's HTTPS proxy |
| `RCMP_DATA_DIR` | path of a persistent disk, for uploads |
| `RCMP_DB_POOL` | `5` (Supabase free tier allows few connections) |

Never commit these values. In production the demo tools and `/api/demo/reset` are always disabled.

In production the sample accounts are also locked: they are seeded with a random password, so the sample projects are visible but nobody can sign in as a demo user (`RCMP_DEMO_LOGIN=1` keeps the public demo password; do not use it on a public site).

**Free hosting limits.** On Render's free plan the service sleeps after 15 minutes without visitors (about a minute to wake), its disk is wiped on every restart (uploaded files are lost) and Render's own free database expires after 30 days. Keep the database on Supabase and treat the free web service as a demo. A build command that works on Render: `npm ci --omit=dev && npm --prefix client ci --include=dev && npm run build`; set `NODE_VERSION=24`.

## 4. Start and check

Start command: `npm start`. The log shows `Seeded demo data.` on the first start and the administrator email. Open `/api/health` (or the home page), sign in as the administrator, and send a test message from the Contact page to see it in the inbox.

Note: the first start seeds the sample demo accounts as well. If you do not want demo users in a live database, delete those rows (ids other than `USR-099`) in the Table Editor.
