# Architecture

## Decisions

| # | Decision | Why | Revisit when |
| --- | --- | --- | --- |
| ADR-1 | One Next.js app serves pages and the REST API (no separate FastAPI service for the MVP) | One codebase and one deployment so the MVP could ship in a day; the API is plain REST and can move to FastAPI later without changing the database | Heavy Python data or ML work, or the API needs independent scaling |
| ADR-2 | Plain SQL migrations and parameterised `pg` queries, no ORM | Full control of constraints and triggers (prediction lock, append-only audit); no SQL built from strings | Never needed so far |
| ADR-3 | Own session auth instead of a hosted auth provider | No extra vendor to set up today; scrypt, hashed session ids, single-use hashed tokens | SSO, MFA for members, or social login are required |
| ADR-4 | Paystack one-off payments per period, no auto-renew | Simpler and safer to verify; renewal reminders by email | Recurring billing is wanted (Paystack Plans/Subscriptions) |
| ADR-5 | Entitlements computed from verified subscriptions on every request | Access can never be granted by the browser or a redirect | n/a |
| ADR-6 | Poisson goals model for drafts, human publish step | Transparent, explainable, testable; no invented numbers | A richer model (Elo, xG) or more data is available |

## Request flow

Browser -> Next.js (Vercel) -> route handler -> service in `src/lib/services` -> Postgres. External calls (Paystack, Resend, API-Football, OpenAI) happen only on the server; no secret is shipped to the browser.

## Data model (core)

users, sessions, auth_tokens, plans, subscriptions, payments, webhook_events, competitions, teams, fixtures, team_stats, predictions, audit_logs, email_outbox, contact_messages, rate_limits. See `db/migrations/001_init.sql`.

Rules enforced in the database:
- a published prediction cannot change its pick after kickoff (trigger)
- audit_logs cannot be updated or deleted (trigger)
- payment references are unique; webhook events are unique per provider + event key (idempotency)

## Scheduled work

`/api/cron/daily` (Vercel Cron, 05:00 UTC, bearer `CRON_SECRET`): sync fixtures and results, settle finished predictions, generate drafts for the next 7 days, expire lapsed subscriptions, send 3-day expiry reminders, prune rate-limit rows.
