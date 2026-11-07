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

Code, migrations and checks are ready (`docs/SUPABASE.md`). Production logged `relation "users" does not exist`: the production database has not been migrated. The **Supabase check** workflow now has a read-only `inspect` mode and a guarded `apply` mode, and `/api/health/deep` runs the app's real queries. **Not yet verified against the live Supabase project**: that happens when the workflow runs with the project's secrets.

## Customer support

Email betvanta098@gmail.com, phone (314) 343-6703 (`SUPPORT_EMAIL`, `SUPPORT_PHONE`). Shown on the contact page, footer, FAQ, terms and privacy pages, in every email footer, and in the site's structured data. Emails are sent with Reply-To set to the support address. Contact-form messages are stored for admins and forwarded to the support inbox with Reply-To set to the customer.

## Build and migrations

`npm run build` / Vercel runs `next build` only and needs no database (verified by building with no environment variables and with unreachable database URLs). Migrations are a separate step: the Supabase check workflow or `npm run db:migrate`.

## Homepage hero and statistics (migration 010)
- Hero: original stadium artwork rendered by `scripts/artwork/render-stadium.cjs` (no third-party image licence involved), dark scrim, overlay header, Explore Predictions and Join Our Community.
  To use a licensed photo instead, replace `public/images/hero/stadium-wide.webp` (desktop, about 2560x1440) and `stadium-tall.webp` (mobile, about 1200x2000). Do not use photos of identifiable players or crowds without a model release.
- Statistics: four slots in `homepage_stats`, edited in Admin > Homepage. Client figures (2,000 Happy Members, 75% Win Rate, 12,500 Winning Picks, 10 Sports Covered; migrations 012 and 013) are shown as entered with the note "Figures provided by BETVANTA; not independently verified. Past results do not guarantee future outcomes." They are kept separate from live platform statistics (Performance page, admin) and are never replaced by empty records. An admin can edit, hide, mark verified (with evidence) or switch a slot to the live figure. An admin can switch a slot to the live figure from BETVANTA's records, or mark it verified, which requires a written note on how it was verified (also enforced by a database constraint). Every change is in the audit log.
- Production needs migration 010: run Supabase check in `inspect`, then `apply`. Until then the homepage shows live figures only and logs `homepage_stats table is missing`.

## Payment assistant ("Chat with us", migration 011)
- Checkout shows every method: BTC, ETH, USDT, PayPal, Venmo, Chime, Apple Pay, Other. Choosing one opens the assistant (also `?method=usdt` in the checkout URL, and the "Chat with us" button).
- Crypto: shows the client-confirmed wallet, a QR code, the plan, the amount and the network, a copy button and step-by-step instructions. The wallets live in code (`manual-payments/methods.ts`) so changing where money goes needs a reviewed deploy; a unit test checks each address's checksum.
- Networks: BTC is Bitcoin (a bc1 address exists only there). ETH and USDT use 0x addresses that work on several chains, so the network shows as "Not confirmed yet", the customer is told to confirm it with BETVANTA, and must state the network they used. Set `CRYPTO_ETH_NETWORK` / `CRYPTO_USDT_NETWORK` once confirmed.
- Crypto collection is off until `CRYPTO_PAYMENTS_ENABLED=true` (the standing rule: not before legal and provider approval). With it off, crypto shows "Coming soon" and no address.
- PayPal, Venmo, Chime, Apple Pay, Other: no account details are shown. The assistant sends the customer to BETVANTA on Discord (`DISCORD_SUPPORT_URL`, else `DISCORD_INVITE_URL`, else /community), then accepts their payment details or proof.
- Every submission records full name, email, Discord username, the customer's transaction or payment reference, an optional proof (PNG, JPG, WebP or PDF up to 4 MB, type checked from the file bytes, stored in Postgres, viewable by admins only) and a BETVANTA reference (BV-M-XXXXXXXX). Status: pending verification.
- Admin > Manual payments: review queue with proof, block-explorer link when the network is known, approve (grants the plan in the same transaction, emails a receipt, syncs the Discord role) or reject with a reason the member sees. Decisions are final (database trigger), audited, and nothing grants access before approval.
- Separate from provider payments (`payments`) and from sportsbook wallets (`sportsbook` schema).

## Homepage sections (current)
Hero (centred, stadium background: headline, Get Premium Picks to /pricing, Join Discord, Create a free account, glass statistics panel), platform section (four sports, four features, Get Started Now to /register and View Predictions), upcoming matches, predictions and match analysis, Premium Picks plans (all five, each to checkout or registration), how it works, member dashboard preview (example data, labelled), testimonials, FAQ, community and footer (contact, Discord, legal). Phones get a Menu button listing every page. The e2e suite checks every section and that all homepage links resolve.

## Subscription journey (payment assistant)
Every "Subscribe Now" button (pricing page and homepage plans) opens the payment assistant on the same page: welcome, plan and price, payment method (card when a provider is configured, Bitcoin, Ethereum, USDT, PayPal, Venmo, Chime, Apple Pay, Other), instructions with the verified wallet address and QR code, an Upload payment proof button, and the status: Pending, Confirmed or Rejected (with the reason). Signed-out visitors can read the instructions and are sent to create an account or log in, then returned to the same plan and method. The old /checkout/<plan> URL redirects to the assistant. A plan is activated only when an admin approves the payment after checking it (Admin > Manual payments); the member then gets a "Payment confirmed" email. Uploads never activate anything on their own.
