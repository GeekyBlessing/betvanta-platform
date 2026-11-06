# BETVANTA

**Smarter Insights. Better Decisions.**

BETVANTA is a sports intelligence platform: fixtures, scores and statistics, data-driven match predictions with stated confidence, an open locked-at-kickoff track record, and Free, Premium and VIP subscriptions in USD (card or crypto).

Target market: **United States**, priced in **USD**. Legal entity and merchant jurisdiction are to be confirmed; see `docs/COMPLIANCE.md`.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS |
| API | Next.js route handlers under `src/app/api` (REST, JSON, Zod validation) |
| Database | PostgreSQL (Supabase, Neon or any Postgres 14+), SQL migrations in `db/migrations` |
| Auth | Own implementation: scrypt password hashing, DB-backed sessions in an httpOnly cookie, email verification and reset tokens |
| Payments | USD only: Stripe (default), optional Paystack, and NOWPayments crypto (BTC, ETH, USDT, off until approved) behind one provider layer, all verified server-side with signed webhooks |
| Community | Discord OAuth linking, tier role sync, pick announcements |
| Sportsbook | Integration points only (`src/lib/sportsbook`, `sportsbook` schema), hard-disabled |
| Email | Resend (falls back to an admin-visible outbox) |
| Sports data | API-Football adapter, or a labelled fictional sample league |
| AI | OpenAI, optional, grounded on stored stats only |
| Hosting | Vercel (app + daily cron) |

## Run locally

```bash
cp .env.example .env.local        # fill DATABASE_URL at minimum
npm install
npm run migrate                   # applies db/migrations
node scripts/payments-stub.mjs &  # optional: local stand-in for Stripe/Paystack/NOWPayments (point *_API_BASE / PAYSTACK_BASE_URL at http://127.0.0.1:4599)
npm run dev
```

Register with an address listed in `ADMIN_EMAILS` to get the admin console at `/admin`. Then: Sports data > Sync, Predictions > Generate drafts, and publish.

## Tests

```bash
npm test                 # unit + integration against real Postgres (TEST_DATABASE_URL)
npm run build && npm start & node tests/e2e/smoke.mjs   # end-to-end over HTTP
```

## Project layout

```
db/migrations/        SQL schema, applied in order by scripts/migrate.mjs (also runs on every build)
scripts/              migrate, local Paystack stub
src/app/(site)/       public pages        src/app/(auth)/   login, register, reset, verify
src/app/dashboard/    member dashboard    src/app/admin/    admin console
src/app/api/          REST endpoints      src/middleware.ts CSRF origin check
src/lib/services/     auth, billing, paystack, entitlements, engine, predictions, ai
src/lib/sports/       provider adapters and sync
tests/                unit, integration, e2e
docs/                 architecture, security, deployment, status
```

See `docs/STATUS.md` for exactly what is working, what is configuration-dependent, and what is not built yet.
