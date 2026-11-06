# MVP status

Verified by 27 unit/integration tests against Postgres and 55 end-to-end HTTP checks against a production build.

## Working and tested

| Feature | Evidence |
| --- | --- |
| Registration (18+ and terms required), login, logout, sessions | auth tests, e2e |
| Email verification, password reset, password change, profile and notification settings, account deletion (anonymisation) | auth tests, e2e |
| Roles (member, analyst, admin), suspension, admin role assignment via `ADMIN_EMAILS` | auth tests, e2e (403/401 checks) |
| Sports data sync with idempotent upserts, team stats and form rebuilt from results | prediction tests, e2e |
| Poisson prediction engine (1X2, BTTS, Over/Under 2.5) with probabilities, confidence bands and limitations text | engine unit tests |
| Draft, review, publish, lock at kickoff (DB trigger), automatic settlement | prediction tests, e2e |
| Server-side gating of Premium/VIP content | prediction tests, e2e |
| Plans (Premium/VIP x monthly/quarterly/annual), admin-editable prices | e2e |
| Paystack checkout, server verification, signed webhooks, idempotent activation, flagged mismatches, renewals extend, cancellation keeps access to period end, expiry and reminders | billing tests and e2e against a Paystack API stand-in |
| Public site, member dashboard, admin console (users, payments, plans, predictions, data, emails, messages, audit) | e2e page checks, screenshots |
| Security controls listed in SECURITY.md | tests + e2e (CSRF, signatures, rate limits, headers) |
| CI workflow (typecheck, lint, tests, audit, e2e) | `.github/workflows/ci.yml` (runs once pushed) |

## Depends on your credentials (code complete, not yet exercised against the real service)

| Feature | Needs | Until then |
| --- | --- | --- |
| Real Paystack test checkout | `PAYSTACK_SECRET_KEY=sk_test_...` and webhook URL in the Paystack dashboard | Checkout shows "not switched on yet" |
| Email delivery | `RESEND_API_KEY`, verified domain | Emails are logged in Admin > Emails, not delivered, so members cannot verify |
| Real fixtures and stats | `API_FOOTBALL_KEY` (check your plan covers the season) | Labelled sample league with fictional teams |
| AI analysis | `OPENAI_API_KEY` | Model-generated analysis text only |

## Not built yet

- Live in-play scores and odds (no licensed odds feed)
- Flutterwave and Stripe (Paystack only)
- Recurring auto-renew billing, proration, coupons
- MFA, session/device list, social login
- Testimonials moderation, broadcast notifications, analytics charts
- Native apps

## Placeholders to replace before live payments

- Plan prices (NGN 10,000 / 27,000 / 96,000 Premium; 25,000 / 67,500 / 240,000 VIP) are placeholders.
- Terms, privacy and responsible-gambling pages are drafts for legal review.
- The performance record starts empty: settled results only appear after real published picks finish. No historical record was back-filled.
