# Phase 1 status

Verified by 61 unit/integration tests against Postgres and 110 end-to-end HTTP checks (also run with the app connected as the restricted `betvanta_app` role) against a production build (`tests/e2e/smoke.mjs`), with payment and Discord APIs replaced by local stand-ins.

| # | Requirement | Status | Evidence / note |
| --- | --- | --- | --- |
| 1 | Premium responsive homepage | Done | Hero with Get Premium Picks and Join Discord, live statistics, four sport categories, this week's picks, member reviews, community band; every homepage link checked by the e2e suite |
| 2 | Registration, login, authentication | Done | auth tests, e2e |
| 3 | User dashboard | Done | overview filtered by favourite leagues, predictions, history, billing, settings |
| 4 | Sports and league selection | Done | `/sports` and `/sports/{american-football, soccer, basketball, baseball}`, favourites, "My leagues". Real data feed: soccer (API-Football). Other sports use labelled sample leagues until their feeds are connected; predictions are soccer-only because the model is built for soccer scoring |
| 5 | Fixtures, schedules, scores, statistics | Done | `/fixtures` (schedule, live, results), `/leagues/[id]` table, match stats and head to head |
| 6 | AI match analysis and predictions | Done, AI needs key | Poisson engine always on; OpenAI analysis grounded on stored numbers when `OPENAI_API_KEY` is set |
| 7 | Membership plans | Done | Free account plus five client-confirmed paid plans: Monthly $50, 3 Month $100, 6 Month $150, 1 Year $300 (best value), Lifetime $600. Access is by plan level; VIP-exclusive picks from 6 Month. See "Plan features" below |
| 8 | USD subscription checkout | Done, needs keys | Stripe (cards) is the default; Paystack optional depending on merchant entity; prices are client-confirmed |
| 9 | Crypto payment architecture (BTC, ETH, USDT) | Built, OFF by default | NOWPayments invoices + signed IPN + API confirmation; enable with `CRYPTO_PAYMENTS_ENABLED=true` only after legal and provider approval |
| 10 | Other approved payment methods | Done | Paystack card/bank in USD |
| 11 | Prediction history and performance | Done | settles from final scores; record starts empty (no back-filled history) |
| 12 | Email notifications | Done, needs key | verify, reset, password changed, receipt, cancellation, expiry reminder; logged in Admin > Emails until `RESEND_API_KEY` is set |
| 13 | Discord community | Done, needs invite + keys | Join Discord buttons (hero, community band, footer, /community) open `DISCORD_INVITE_URL` in a new tab, or /community until it is set; only discord.gg / discord.com/invite links are accepted. OAuth link, auto roles, announcements |
| 14 | Complete admin dashboard | Done | overview, predictions, sports data, users, subscriptions, payments, plans, emails, messages, audit |
| 15 | User and subscription management | Done | roles, suspend, grant/extend/revoke access (audited) |
| 16 | Prediction publishing and management | Done | drafts, tier choice, publish, discard, settle, AI analysis |
| 17 | Responsive mobile and desktop | Done | screenshots at 390px and 1280px, light and dark |
| Sportsbook | Integration points only, disabled | Done | separate schema, DB guard, disabled operator adapter, US state licensing table and geolocation/jurisdiction interfaces, tests |

## Needs your credentials before it runs against the real service

GitHub push access, a Postgres database, API-Football key, Stripe test keys (and/or Paystack USD, NOWPayments), Resend key and domain, Discord app + bot + role ids, OpenAI key (optional).

## Placeholders to replace before going live

- Giveaway and lotto features need a legal review before launch (see "Plan features").
- Terms, privacy and responsible-gambling pages are drafts for legal review.
- Legal entity and merchant registration jurisdiction are not confirmed yet; payment processors, terms and privacy depend on them (see `docs/COMPLIANCE.md`).
- Crypto stays off until legal sign-off for that jurisdiction and the US states served, plus provider approval.

## Not built in Phase 1

Live odds (needs a licensed feed), real-money betting, wallets, deposits and withdrawals (deliberately disabled), recurring auto-renew, MFA, testimonials, analytics charts, native apps.

## Plan features

Plans are ordered levels 1 to 5; each includes everything below it. Subscriptions store level, price paid, currency, duration and lifetime flag. Lifetime ends at Postgres `infinity`, is never expired or reminded, and cannot be cancelled.

| Feature | From plan | How it is delivered |
| --- | --- | --- |
| Expert analysed picks, AI-powered daily analysis | Monthly | In the app (server-side gating) |
| Discord community access | Monthly | In the app (Discord role sync) |
| VIP-exclusive picks | 6 Month | In the app (VIP content tier) |
| Premium VIP status, Lifetime VIP status | 1 Year, Lifetime | In the app (VIP Discord role, plan level) |
| Advanced AI insights | 3 Month | Listed per plan; AI reports need `OPENAI_API_KEY`. Separate gating of AI vs model analysis is a follow-up |
| Giveaways, lotto selections, live and private video, bankroll strategies and consultations, priority support, custom strategies | Various | Delivered by the BETVANTA team (Discord, email, calls). The app shows each member which of these they are entitled to; it does not run them |

Legal review needed before launch: in the US, giveaways tied to a paid subscription can fall under state sweepstakes and lottery rules (typically requiring a free alternative entry and official rules), and "lotto selections" marketing should be checked against state lottery advertising rules.

## Homepage statistics and testimonials

- Statistics come straight from the database: active member accounts, settled predictions (won, lost, void), sports with fixtures in the feed. The win rate stays hidden ("Building") until at least 20 picks have settled. When any figure includes sample data, a "Sample data" label is shown under the panel.
- Testimonials: no reviews are seeded. Only signed-in members can submit, they must tick an explicit publication consent (stored with the review), an admin must approve, and the member can withdraw at any time. Reviews from suspended or deleted accounts are hidden. Paid members are labelled "Verified subscriber".

## Supabase

Code, migrations and checks are ready (`docs/SUPABASE.md`). **Not yet verified against the live Supabase project**: that happens when the "Supabase check" workflow runs with the project's secrets.

## Customer support

Email betvanta098@gmail.com, phone (314) 343-6703 (`SUPPORT_EMAIL`, `SUPPORT_PHONE`). Shown on the contact page, footer, FAQ, terms and privacy pages, in every email footer, and in the site's structured data. Emails are sent with Reply-To set to the support address. Contact-form messages are stored for admins and forwarded to the support inbox with Reply-To set to the customer.

## Build and migrations

`npm run build` / Vercel runs `next build` only and needs no database (verified by building with no environment variables and with unreachable database URLs). Migrations are a separate step: the Supabase check workflow or `npm run db:migrate`.
