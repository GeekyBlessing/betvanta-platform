# Security controls

| Area | Control |
| --- | --- |
| Passwords | scrypt (N=16384, r=8, p=1, 64-byte key, random salt); 12+ characters; constant-time comparison; dummy hash on unknown emails to avoid timing leaks |
| Sessions | 256-bit random token in an httpOnly, Secure, SameSite=Lax `__Host-` cookie; only its SHA-256 is stored; 14-day expiry; revoked on password change/reset and suspension |
| Tokens | Verification and reset tokens are random, stored hashed, single-use, expire (24 h / 1 h); verification needs a POST so mail scanners cannot consume it |
| Enumeration | Login and reset return the same message whether or not the account exists |
| Authorisation | Every admin/analyst route calls `requireRole` server-side; pages redirect; admins cannot change their own role or status |
| Content gating | Premium/VIP selections, probabilities and analysis are removed on the server before rendering or JSON responses |
| CSRF | SameSite cookies + middleware rejects state-changing `/api` requests whose Origin does not match the host |
| Input | Zod schemas on every API body; parameterised SQL only; JSON body size bounded by the platform; webhook body capped at 200 KB |
| Rate limiting | Postgres-backed fixed window: login (IP and email), register, forgot/reset, resend, checkout, contact, password change |
| Payments | USD only (DB check). Access only after the provider's own API confirms success (Stripe session retrieve, Paystack verify, NOWPayments payment status) and amount, currency and reference match our record; partial or mismatched payments are flagged; activation is idempotent under concurrent redirect + webhook. Webhooks: Stripe HMAC-SHA256 with 5-minute timestamp tolerance, Paystack HMAC-SHA512, NOWPayments HMAC-SHA512 over sorted JSON; all de-duplicated. A crypto IPN pointing at another order's payment cannot unlock an order |
| Discord | OAuth state is random, bound to the signed-in user, single-use and expires in 10 minutes; one Discord account per BETVANTA account; paid selections are never posted to Discord |
| Sportsbook | Real-money tables blocked at the database level while disabled; application adapter throws on every money operation |
| Audit | Append-only audit log of registrations, logins, payments, role/status changes, plan price changes, prediction publish/settle |
| Headers | CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; `X-Powered-By` removed |
| Secrets | Only in environment variables; `.env*` git-ignored; nothing secret is prefixed `NEXT_PUBLIC_` |
| Cron | Bearer secret compared in constant time |

## Known gaps

- No MFA yet (planned for admins first).
- `npm audit` reports postcss advisories inside Next.js's own build toolchain; they affect build-time CSS processing of our own files, not runtime input. Track the next Next.js release.
- Terms, privacy and responsible-gambling pages are drafts pending legal review.
