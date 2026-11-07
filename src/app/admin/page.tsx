import type { Metadata } from "next";
import { one } from "@/lib/db";
import { aiEnabled, emailEnabled, sampleDataAllowed, env, discordOAuthEnabled, cryptoApproved } from "@/lib/env";
import { formatMoney } from "@/lib/services/billing";
import { adminEmails } from "@/lib/env";
import { CRYPTO_METHODS, cryptoReadiness, manualPaymentsReady, walletNetwork, WALLETS } from "@/lib/services/manual-payments";
import { schemaStatus } from "@/lib/schema";
import { Badge, PageHeader, Stat } from "@/components/ui";
export const metadata: Metadata = { title: "Admin" };
export default async function AdminHome() {
  const s = await one(`select
    (select count(*) from users) users, (select count(*) from users where created_at > now() - interval '7 days') new_users,
    (select count(distinct user_id) from subscriptions where status in ('active','cancelled') and current_period_end > now()) paying,
    (select coalesce(sum(amount_minor),0) from payments where status = 'success' and verified_at > now() - interval '30 days') revenue_30d,
    (select count(*) from payments where status = 'flagged') flagged,
    (select count(*) from predictions where status = 'draft') drafts, (select count(*) from predictions where status = 'published') live,
    (select count(*) from contact_messages where not handled) messages`);
  const flag = (on: boolean, label: string, off: string) => <div className="flex justify-between gap-3 py-2 border-t border-line first:border-t-0"><span>{label}</span>{on ? <Badge tone="success" dot>Connected</Badge> : <Badge tone="warning" dot>{off}</Badge>}</div>;
  const [ready, schema] = await Promise.all([manualPaymentsReady(), schemaStatus()]);
  const appUrl = env().APP_URL;
  return (<>
    <PageHeader eyebrow="Admin" title="Overview" />
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-8">
      <Stat label="Members" value={String(s.users)} foot={`${s.new_users} new this week`} /><Stat label="Active paid members" value={String(s.paying)} />
      <Stat label="Verified revenue, 30 days" value={formatMoney(s.revenue_30d)} /><Stat label="Payments under review" value={String(s.flagged)} foot="Mismatched or partial payments" />
      <Stat label="Draft predictions" value={String(s.drafts)} /><Stat label="Live predictions" value={String(s.live)} /><Stat label="Unread messages" value={String(s.messages)} />
    </div>
    <section className="card p-6 max-w-[640px] text-sm mb-6" aria-labelledby="pay-setup-h"><h2 id="pay-setup-h" className="font-semibold text-[17px] mb-3">Payment assistant setup</h2>
      {flag(schema.current, `Database migrations (latest ${schema.latest ?? "none"})`, `Behind: expected ${schema.expected}. Run Supabase check in apply mode`)}
      {flag(ready, "Manual payment tables", "Missing: apply migrations 011 and 014")}
      {CRYPTO_METHODS.map((m) => { const r = cryptoReadiness(m); return <div key={m}>{flag(r.ready, `${WALLETS[m].symbol} wallet ${WALLETS[m].address.slice(0, 8)}…${WALLETS[m].address.slice(-4)}${walletNetwork(m) ? ` on ${walletNetwork(m)}` : ""}`,
        r.reason === "crypto_off" ? "Off: set CRYPTO_PAYMENTS_ENABLED=true" : `Network not set: CRYPTO_${WALLETS[m].symbol}_NETWORK`)}</div>; })}
      {flag(Boolean(env().ETHERSCAN_API_KEY), "Automatic ETH and USDT checks (Etherscan)", "No ETHERSCAN_API_KEY: verify ETH and USDT by hand")}
      {flag(adminEmails().length > 0, "Admin accounts (ADMIN_EMAILS)", "Not set: nobody can approve payments")}
      {flag(!/localhost|127\.0\.0\.1/.test(appUrl), `Site address for emails (${appUrl})`, "APP_URL not set: email links point to localhost")}
    </section>
    <section className="card p-6 max-w-[640px] text-sm"><h2 className="font-semibold text-[17px] mb-3">Integrations</h2>
      {flag(Boolean(env().STRIPE_SECRET_KEY), `Stripe ${env().STRIPE_SECRET_KEY?.startsWith("sk_live") ? "(live)" : "(test mode)"}`, "Not configured")}
      {flag(Boolean(env().PAYSTACK_SECRET_KEY), `Paystack USD ${env().PAYSTACK_SECRET_KEY?.startsWith("sk_live") ? "(live)" : "(test mode)"}`, "Not configured")}
      {flag(cryptoApproved() && Boolean(env().NOWPAYMENTS_API_KEY && env().NOWPAYMENTS_IPN_SECRET), "NOWPayments crypto (BTC, ETH, USDT)", cryptoApproved() ? "Keys missing" : "Off: awaiting legal and provider approval")}
      {flag(discordOAuthEnabled(), "Discord role sync", "Not configured")}
      {flag(Boolean(env().DISCORD_WEBHOOK_URL), "Discord announcements", "Not configured")}
      {flag(emailEnabled(), "Resend email", "Logging to outbox")}
      {flag(Boolean(env().API_FOOTBALL_KEY), "API-Football data", sampleDataAllowed() ? "Using sample data" : "Not configured")}
      {flag(aiEnabled(), "OpenAI analysis", "Not configured")}
      {flag(Boolean(env().CRON_SECRET), "Daily automation (cron)", "No CRON_SECRET")}
    </section>
  </>);
}
