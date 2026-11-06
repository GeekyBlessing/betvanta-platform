# Connecting BETVANTA to Supabase

BETVANTA uses Supabase as its **PostgreSQL database**. Login, sessions and roles are BETVANTA's own (tested) code running on the server; the browser never talks to Supabase and no Supabase key is shipped to it.

## How access is locked down

| Role | Used by | Access |
| --- | --- | --- |
| `postgres` (admin) | migrations only (`MIGRATION_DATABASE_URL`, session pooler :5432) | owns the schema |
| `betvanta_app` | the running app (`DATABASE_URL`, transaction pooler :6543) | only the grants and RLS policies in `db/migrations/009_rls_and_app_role.sql`: no DDL, no TRUNCATE, cannot delete users or payments, cannot edit the audit log, can delete only *draft* predictions, read-only on the sportsbook schema |
| `anon`, `authenticated` | Supabase Data API (anon / publishable key) | **nothing**: every privilege revoked, now and for future tables; RLS on with no policies |

RLS is enabled on every table in `public` and `sportsbook`. The test suite fails if a future table is added without it.

## One-time setup (about 10 minutes)

1. **Admin connection string.** Supabase dashboard > Connect > **Session pooler** URI (host `aws-0-us-east-1.pooler.supabase.com`, port 5432, user `postgres.<project-ref>`). Put your database password in it. Do not use the direct `db.<ref>.supabase.co` host; it is IPv6-only and GitHub runners cannot reach it.
2. **App role password.** Generate a long random one on your Mac: `openssl rand -hex 24` (hex avoids characters that need URL-escaping).
3. **Project URL and anon key.** Dashboard > Project Settings > API: the Project URL and the anon/publishable key. They are used **only by the check** to prove the public API cannot read BETVANTA data. The app does not use them.
4. *(Optional, recommended)* **CA certificate.** Dashboard > Database settings > SSL Configuration > Download certificate. Paste the PEM text as a secret to make connections verify the server certificate.
5. **GitHub secrets.** Repository > Settings > Secrets and variables > Actions > New repository secret:

   | Secret | Value |
   | --- | --- |
   | `SUPABASE_ADMIN_DB_URL` | step 1 |
   | `APP_DB_PASSWORD` | step 2 |
   | `SUPABASE_URL` | step 3, Project URL |
   | `SUPABASE_ANON_KEY` | step 3, anon/publishable key |
   | `DATABASE_CA_CERT` | step 4 (optional) |

6. **Run the check.** Actions > **Supabase check** > Run workflow. It applies migrations, enables `betvanta_app` login, then reports PASS/FAIL for: connection as `betvanta_app`, TLS, migrations, RLS on every table, app-role restrictions, anon/authenticated privileges, the Supabase REST API returning no rows for `users`, `payments`, `sessions`, `plans`, and an auth round-trip (create user, verify password, resolve session, write audit row) inside a transaction that is rolled back.

## Dashboard hardening

- Database > SSL Configuration: **Enforce SSL on incoming connections**.
- Authentication > Sign In / Providers: turn **off** "Allow new users to sign up" (BETVANTA does not use Supabase Auth, so nobody should be able to create Supabase auth users with the public key).
- Never copy the `service_role` / secret key into BETVANTA, GitHub or Vercel. Nothing needs it.
- Optional: Data API settings, remove `public` from exposed schemas (RLS already blocks it; this removes the surface entirely).

## Vercel (when deploying)

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `postgresql://betvanta_app.<ref>:<APP_DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres` |
| `MIGRATION_DATABASE_URL` | the admin session-pooler URI from step 1 (build runs migrations with it) |
| `DATABASE_CA_CERT` | optional, as above |

Neither is prefixed `NEXT_PUBLIC_`, so they stay on the server. CI also scans the built browser bundle and fails if any secret value or connection string appears in it (`scripts/check-client-bundle.mjs`).
