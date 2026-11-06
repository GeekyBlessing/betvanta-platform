# Deployment (Vercel + Postgres)

1. **Database.** Create a Postgres database (Supabase recommended). Copy the pooled connection string with `sslmode=require`.
2. **Vercel project.** Import the GitHub repo `betvanta-platform`. Framework: Next.js. The build command `npm run build` runs migrations first.
3. **Environment variables** (Production): `DATABASE_URL`, `APP_URL` (your final https URL), `ADMIN_EMAILS`, `CRON_SECRET` (long random string), `PAYSTACK_SECRET_KEY` (`sk_test_...` first), `RESEND_API_KEY` + `EMAIL_FROM`, and either `API_FOOTBALL_KEY` or `ALLOW_SAMPLE_DATA=true`. Optional: `OPENAI_API_KEY`.
4. **Deploy**, then open `/api/health` (expects `{"ok":true,"db":"up"}`).
5. **Paystack dashboard** (test mode): set the webhook URL to `{APP_URL}/api/webhooks/paystack`. The callback URL is sent per transaction.
6. **Resend:** verify your sending domain (SPF, DKIM).
7. **First run:** register with an `ADMIN_EMAILS` address, verify email, then Admin > Sports data > Sync, Admin > Predictions > Generate drafts, publish.
8. **Before live payments:** set real prices in Admin > Plans, finish legal pages, switch to `sk_live_...`, and re-run the end-to-end checklist.
