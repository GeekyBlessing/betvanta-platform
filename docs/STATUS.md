# Phase 1 status

Verified by 35 unit/integration tests against Postgres and 73 end-to-end HTTP checks against a production build (`tests/e2e/smoke.mjs`), with payment and Discord APIs replaced by local stand-ins.

| # | Requirement | Status | Evidence / note |
| --- | --- | --- | --- |
| 1 | Premium responsive homepage | Done | e2e page checks, desktop/mobile/dark screenshots |
| 2 | Registration, login, authentication | Done | auth tests, e2e |
| 3 | User dashboard | Done | overview filtered by favourite leagues, predictions, history, billing, settings |
| 4 | Sports and league selection | Done | `/sports`, favourites API, "My leagues" filters. Only football has a data feed; other sports are listed as not connected |
| 5 | Fixtures, schedules, scores, statistics | Done | `/fixtures` (schedule, live, results), `/leagues/[id]` table, match stats and head to head |
| 6 | AI match analysis and predictions | Done, AI needs key | Poisson engine always on; OpenAI analysis grounded on stored numbers when `OPENAI_API_KEY` is set |
| 7 | Free, Premium, VIP tiers | Done | server-side gating tests |
| 8 | USD subscription checkout | Done, needs keys | Stripe (cards), Paystack (USD, needs approval); prices are USD placeholders |
| 9 | Crypto payment architecture (BTC, ETH, USDT) | Done, needs keys | NOWPayments invoices + signed IPN + API confirmation; legal check required before enabling |
| 10 | Other approved payment methods | Done | Paystack card/bank in USD |
| 11 | Prediction history and performance | Done | settles from final scores; record starts empty (no back-filled history) |
| 12 | Email notifications | Done, needs key | verify, reset, password changed, receipt, cancellation, expiry reminder; logged in Admin > Emails until `RESEND_API_KEY` is set |
| 13 | Discord community | Done, needs keys | OAuth link, auto role by tier (incl. expiry), pick announcements, invite link |
| 14 | Complete admin dashboard | Done | overview, predictions, sports data, users, subscriptions, payments, plans, emails, messages, audit |
| 15 | User and subscription management | Done | roles, suspend, grant/extend/revoke access (audited) |
| 16 | Prediction publishing and management | Done | drafts, tier choice, publish, discard, settle, AI analysis |
| 17 | Responsive mobile and desktop | Done | screenshots at 390px and 1280px, light and dark |
| Sportsbook | Integration points only, disabled | Done | separate schema, DB guard, disabled operator adapter, tests |

## Needs your credentials before it runs against the real service

GitHub push access, a Postgres database, API-Football key, Stripe test keys (and/or Paystack USD, NOWPayments), Resend key and domain, Discord app + bot + role ids, OpenAI key (optional).

## Placeholders to replace before going live

- USD plan prices (Premium $19 / $49 / $179, VIP $49 / $129 / $449).
- Terms, privacy and responsible-gambling pages are drafts for legal review.
- Crypto acceptance needs legal confirmation for your markets (Nigeria: SEC and CBN rules).

## Not built in Phase 1

Live odds (needs a licensed feed), real-money betting, wallets, deposits and withdrawals (deliberately disabled), recurring auto-renew, MFA, testimonials, analytics charts, native apps.
