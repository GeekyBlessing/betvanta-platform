import type { Metadata } from "next";
import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { formatMoney } from "@/lib/services/billing";
import { ActionButton } from "@/components/ActionButton";
import { Badge, fmtDate, Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Billing" };
export default async function Billing() {
  const u = await pageUser("/dashboard/billing");
  const subs = await q(`select s.*, p.name, p.interval from subscriptions s join plans p on p.id = s.plan_id where s.user_id = $1 order by s.current_period_end desc limit 20`, [u.id]);
  const pays = await q(`select y.reference, y.amount_minor, y.currency, y.status, y.created_at, y.verified_at, p.name, p.interval from payments y join plans p on p.id = y.plan_id where y.user_id = $1 order by y.created_at desc limit 50`, [u.id]);
  const active = subs.find((s) => s.status === "active" && new Date(s.current_period_end) > new Date());
  const tone = (s: string) => (s === "success" ? "success" : s === "failed" ? "danger" : s === "flagged" ? "warning" : "neutral") as "success";
  return (<>
    <PageHeader eyebrow="Billing" title="Subscription and payments">Plans are paid upfront and do not renew automatically.</PageHeader>
    <section className="card p-6 grid gap-4 mb-8">
      <h2 className="font-semibold text-[17px]">Current plan</h2>
      {subs.filter((s) => new Date(s.current_period_end) > new Date() && s.status !== "expired").map((s) => (
        <div key={s.id} className="flex flex-wrap gap-3 items-center justify-between"><span><strong>{s.name} {s.interval}</strong> · {s.status === "cancelled" ? "cancelled, access ends" : "active until"} {fmtDate(s.current_period_end)}</span></div>))}
      {!active && !subs.some((s) => s.status === "cancelled" && new Date(s.current_period_end) > new Date()) && <p className="text-muted">You are on the Free plan.</p>}
      <div className="flex gap-3 flex-wrap"><Link href="/pricing" className="btn btn-accent">{active ? "Renew or change plan" : "Choose a plan"}</Link>{active && <ActionButton action="/api/billing/cancel" label="Cancel subscription" confirmText="Confirm cancellation" variant="secondary" />}</div>
    </section>
    <h2 className="font-semibold text-[17px] mb-3">Payment history</h2>
    {pays.length ? <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Date</th><th>Plan</th><th>Reference</th><th className="text-right">Amount</th><th>Status</th></tr></thead><tbody>
      {pays.map((p) => <tr key={p.reference}><td className="num whitespace-nowrap">{fmtDate(p.created_at)}</td><td>{p.name} {p.interval}</td><td className="num text-xs">{p.reference}</td><td className="num text-right">{formatMoney(p.amount_minor, p.currency)}</td><td><Badge tone={tone(p.status)} dot>{p.status === "success" ? "Verified" : p.status === "flagged" ? "Under review" : p.status[0].toUpperCase() + p.status.slice(1)}</Badge></td></tr>)}
    </tbody></table></div> : <Notice>No payments yet.</Notice>}
  </>);
}
