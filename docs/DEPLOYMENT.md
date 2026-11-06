# Deployment (Vercel + Postgres)

1. **Database.** Supabase project (US East) is created. Follow `docs/SUPABASE.md`: add the GitHub secrets and run the **Supabase check** workflow until every check passes.
2. **Vercel project.** Import the GitHub repo `betvanta-platform`. Framework: Next.js. The build command `npm run build` runs migrations first.
3. **Environment variables** (Production): see `.env.example`. Minimum: `DATABASE_URL`, `APP_URL`, `ADMIN_EMAILS`, `CRON_SECRET`, `RESEND_API_KEY` + `EMAIL_FROM`, either `API_FOOTBALL_KEY` or `ALLOW_SAMPLE_DATA=true`, and at least one payment provider (Stripe recommended for USD cards). Optional: Paystack (USD-approved), NOWPayments (crypto), Discord, OpenAI.
4. **Deploy**, then open `/api/health` (expects `{"ok":true,"db":"up"}`).
5. **Webhooks** (test mode first): Stripe `{APP_URL}/api/webhooks/stripe` (checkout.session.completed, checkout.session.expired); Paystack `{APP_URL}/api/webhooks/paystack`; NOWPayments sends IPNs to `{APP_URL}/api/webhooks/nowpayments` automatically (set the IPN secret in its dashboard). Discord OAuth redirect: `{APP_URL}/api/discord/callback`.
6. **Resend:** verify your sending domain (SPF, DKIM).
7. **First run:** register with an `ADMIN_EMAILS` address, verify email, then Admin > Sports data > Sync, Admin > Predictions > Generate drafts, publish.
8. **Jurisdiction:** confirm the legal entity and merchant registration country first (see `COMPLIANCE.md`); choose payment processors accordingly. Leave `CRYPTO_PAYMENTS_ENABLED=false` until approvals exist.
9. **Before live payments:** set real prices in Admin > Plans, finish legal pages, switch to `sk_live_...`, and re-run the end-to-end checklist.
