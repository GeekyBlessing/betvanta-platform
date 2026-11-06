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

## Vercel environment variables

The Vercel build (`next build`) needs **no** database and no Supabase variables. At runtime the server needs exactly one database variable:

| Variable | Needed? | Value |
| --- | --- | --- |
| `DATABASE_URL` | **Yes, server-side only** | Transaction pooler string for the app role: `postgresql://betvanta_app.<ref>:<APP_DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres` |
| `DATABASE_CA_CERT` | Optional | PEM from Supabase SSL settings (full certificate verification) |
| `MIGRATION_DATABASE_URL` | **No, remove it from Vercel** | Migrations do not run on Vercel any more |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Not used | The browser never talks to Supabase directly (BETVANTA uses its own server-side auth). Setting them is harmless because both are public by design, but nothing reads them. If set, the anon key must be the **anon/publishable** key, never `service_role`; CI fails the build check if a service_role key appears |
| Supabase `service_role` / secret key | **Never** | Not needed anywhere |

`DATABASE_URL` is never prefixed `NEXT_PUBLIC_`, so it stays on the server.

### Getting the right connection strings

In the Supabase dashboard, open your project and click **Connect** (top bar):

- **Transaction pooler** (port **6543**): use for the app's `DATABASE_URL`. Replace the user `postgres.<ref>` with `betvanta_app.<ref>` and the password with your `APP_DB_PASSWORD`.
- **Session pooler** (port **5432**, host `aws-0-us-east-1.pooler.supabase.com`): use for migrations (`SUPABASE_ADMIN_DB_URL` GitHub secret, or `MIGRATION_DATABASE_URL` when running locally), with your database password.
- **Direct connection** (`db.<ref>.supabase.co`): **do not use**. It is IPv6-only; Vercel and GitHub runners are IPv4, which is exactly what causes `connect ENETUNREACH ... :5432`.

If the password has special characters, URL-encode them (or reset it to letters and digits).

## Running migrations (separate, controlled step)

- **Recommended:** GitHub > Actions > **Supabase check** > Run workflow (with "Apply pending migrations" ticked). It migrates, then verifies the database.
- **From your Mac:** `MIGRATION_DATABASE_URL='<session pooler string>' npm run db:migrate`.
- Migrations are idempotent and serialised with an advisory lock; run them **before** deploying code that needs new tables.

If the live site shows errors, open `https://<your-site>/api/health`. It reports `db: "up"`, or a non-secret error code plus which kind of host is configured (for example `supabase direct (IPv6-only, unsupported)`).
