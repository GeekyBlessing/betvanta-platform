# Phase 1 status

Verified by 61 unit/integration tests against Postgres and 110 end-to-end HTTP checks (also run with the app connected as the restricted `betvanta_app` role) against a production build (`tests/e2e/smoke.mjs`), with payment and Discord APIs replaced by local stand-ins.

| # | Requirement | Status | Evidence / note |
| --- | --- | --- | --- |
| 1 | Homepage sports dashboard | Done | Compact intro, record counted from the database, sport filter, featured predictions, today's (or next) fixtures, recent results, performance history, plans, community; checked at desktop, tablet and phone by the e2e suite |
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
| 13 | Discord community | Done, needs invite + keys | Join Discord buttons (community band, footer, /community) open `DISCORD_INVITE_URL` in a new tab, or /community until it is set; only discord.gg / discord.com/invite links are accepted. OAuth link, auto roles, announcements |
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

## Homepage statistics (migration 010)
- The public homepage shows only figures counted from BETVANTA's own records: picks graded, hit rate (withheld until 20 picks are decided), matches in the next 7 days and leagues covered. Sample data is labelled.
- The hero statistics panel shows the figures in `homepage_stats` (Admin > Homepage), with the not-independently-verified note on client-provided figures.
- The stadium artwork is back as the hero background (original, no licence needed). Sport illustrations are originals generated by `scripts/artwork/sport-illustrations.py` into `public/images/sports`.

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
Black and red sportsbook design (tokens in globals.css; dark only). Header: logo, Home, Packages, Contact, More, search, Join Now and Log in (or My Account), then a horizontal sports bar (All, Football, Basketball, Tennis, Baseball, American Football, Ice Hockey, Boxing, MMA, Virtuals). Phones get a fixed bottom bar (Home, A-Z Sports, Virtuals, Bet Slip, Menu; Menu holds the four main items and the account).
Homepage (src/lib/services/sportsbook.ts, src/components/sportsbook): promo tiles (Discord, Packages, Virtual Sports, Instagram), a compact hero (View Packages, Join Discord, Register, Log in), quick categories (Today's Football, Starting in 3 hours, top competitions), Featured match cards, Live, Upcoming matches by competition with 1X2, O/U 2.5 and GG/NG tabs, packages with Subscribe Now, and on desktop a sports and competitions sidebar and a sticky bet slip. Sample fixtures carry a DEMO tag.
Prices: BETVANTA model prices (1 / model probability from the Poisson engine), only on markets with a published pick and only when the viewer's plan includes that pick; otherwise the market shows a locked Premium or VIP button and no price is sent to the browser (e2e checks both). They close at kickoff. They are not bookmaker odds.
Bet slip: singles or multiple, stake, total odds and potential return, remove and remove-all, kept in the visitor's browser only. Place Bet is disabled: BETVANTA does not take bets, deposits or withdrawals.
Virtual Sports (/virtuals): showcase for instant football, basketball, penalty shootout and racing, clearly marked coming soon with no provider connected. Search (/search): competitions and matches. The public /predictions page now redirects to the homepage; members keep their dashboard picks. Member reviews appear on Packages once approved. Homepage statistics (Admin > Homepage) are not shown publicly.

## Subscription journey (payment assistant)
Every "Subscribe Now" button (pricing page and homepage plans) opens the payment assistant on the same page: welcome, plan and price, payment method (card when a provider is configured, Bitcoin, Ethereum, USDT, PayPal, Venmo, Chime, Apple Pay, Other), instructions with the verified wallet address and QR code, an Upload payment proof button, and the status: Pending, Confirmed or Rejected (with the reason). Signed-out visitors can read the instructions and are sent to create an account or log in, then returned to the same plan and method. The old /checkout/<plan> URL redirects to the assistant. A plan is activated only when an admin approves the payment after checking it (Admin > Manual payments); the member then gets a "Payment confirmed" email. Uploads never activate anything on their own.

## Crypto readiness and verification (migration 014)
- A coin appears in the assistant only when it is fully set up: `CRYPTO_PAYMENTS_ENABLED=true`, and for the 0x wallets (ETH, USDT) its confirmed network in `CRYPTO_ETH_NETWORK` / `CRYPTO_USDT_NETWORK`. Until then it shows "soon" and no address or QR code is sent to the browser. Customers can no longer type their own network.
- Approval re-checks the transaction on the blockchain: Bitcoin through mempool.space; ETH and USDT on Ethereum mainnet through Etherscan (`ETHERSCAN_API_KEY`). It must pay the BETVANTA address (USDT: at least the plan price) with enough confirmations. Failed or unconfirmed checks cannot be approved. When the check cannot run (other network, no key, no hash) the admin must tick that they verified it on the blockchain and describe how. One transaction can activate only one plan (database index). Non-crypto approvals need a description of the payment found.
- Admin > Overview has a "Payment assistant setup" checklist (migrations, tables, each coin, Etherscan, ADMIN_EMAILS, APP_URL).
- ADMIN_EMAILS accounts become admin only after their email is verified (on verification or next login).

## Community and premium access
- Free: the public Discord server and Instagram (no account needed). Links come only from DISCORD_INVITE_URL and INSTAGRAM_URL; a button is hidden rather than pointing anywhere else if either is missing or not an official discord.gg / discord.com/invite or instagram.com link.
- Premium: premium picks and analysis are removed on the server before a page is sent to anyone without an active package (e2e: "locked analysis text never reaches the browser"). Private Discord channels are opened by roles that BETVANTA's bot grants when a member links Discord in Settings, and removes when the package ends (syncDiscordRole, nightly resync). This needs DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_PREMIUM_ROLE_ID and DISCORD_VIP_ROLE_ID in Vercel, and the private channels in Discord restricted to those roles.

## Crypto subscription payments (configuration)
- Wallets are fixed in code (src/lib/services/manual-payments/methods.ts, checksums tested): BTC bc1qu2pq8h060lpu3g5yg8zzc39lr85mal3vpek4dv (Bitcoin), ETH 0x283bed6B2dB8b70FB245a9734fc6479C60C59E9C (Ethereum), USDT 0x7EE5E8D5149A55c6049f7b1042834cDAEB2f246d (Ethereum, ERC-20; confirmed by the client). There are no wallet-address environment variables.
- Vercel: CRYPTO_PAYMENTS_ENABLED=true, CRYPTO_ETH_NETWORK=Ethereum, CRYPTO_USDT_NETWORK=Ethereum (ERC-20), ETHERSCAN_API_KEY (recommended), plus ADMIN_EMAILS and APP_URL. Migrations 010 to 014 must be applied.
- Verification: BTC on mempool.space (paid to the bc1 address, 2 confirmations); ETH via Etherscan (sent to the ETH address, 12 confirmations); USDT via Etherscan (a successful transfer of Tether's ERC-20 contract to the USDT address for at least the plan price, 12 confirmations). BTC and ETH dollar value is not checked automatically, so approval also needs the admin to confirm and record it.
- Sportsbook deposits: none. The app role is read-only on the sportsbook schema and real-money play is blocked by a database constraint until a licensed operator is in place.
