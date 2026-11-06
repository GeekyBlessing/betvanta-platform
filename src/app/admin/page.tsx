import type { Metadata } from "next";
import { one } from "@/lib/db";
import { aiEnabled, emailEnabled, paymentsEnabled, sampleDataAllowed, env } from "@/lib/env";
import { formatMoney } from "@/lib/services/billing";
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
  return (<>
    <PageHeader eyebrow="Admin" title="Overview" />
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-8">
      <Stat label="Members" value={String(s.users)} foot={`${s.new_users} new this week`} /><Stat label="Active paid members" value={String(s.paying)} />
      <Stat label="Verified revenue, 30 days" value={formatMoney(s.revenue_30d, "NGN")} /><Stat label="Payments under review" value={String(s.flagged)} />
      <Stat label="Draft predictions" value={String(s.drafts)} /><Stat label="Live predictions" value={String(s.live)} /><Stat label="Unread messages" value={String(s.messages)} />
    </div>
    <section className="card p-6 max-w-[640px] text-sm"><h2 className="font-semibold text-[17px] mb-3">Integrations</h2>
      {flag(paymentsEnabled(), `Paystack ${env().PAYSTACK_SECRET_KEY?.startsWith("sk_live") ? "(live)" : "(test mode)"}`, "Not configured")}
      {flag(emailEnabled(), "Resend email", "Logging to outbox")}
      {flag(Boolean(env().API_FOOTBALL_KEY), "API-Football data", sampleDataAllowed() ? "Using sample data" : "Not configured")}
      {flag(aiEnabled(), "OpenAI analysis", "Not configured")}
      {flag(Boolean(env().CRON_SECRET), "Daily automation (cron)", "No CRON_SECRET")}
    </section>
  </>);
}
