import type { Metadata } from "next";
import { pageRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { ApiForm, Field } from "@/components/ApiForm";
import { ActionButton } from "@/components/ActionButton";
import { Badge, fmtDate, Notice, PageHeader, tierBadge } from "@/components/ui";
export const metadata: Metadata = { title: "Subscriptions" };
export default async function Subs(props: { searchParams: Promise<{ show?: string }> }) {
  await pageRole("/admin/subscriptions", "admin");
  const { show } = await props.searchParams;
  const all = show === "all";
  const plans = await q<{ code: string; name: string; is_lifetime: boolean }>("select code, name, is_lifetime from plans where active order by level");
  const rows = await q(`select s.*, u.email, p.name, g.email granted_by_email from subscriptions s join users u on u.id = s.user_id join plans p on p.id = s.plan_id left join users g on g.id = s.granted_by
     where $1 or (s.status in ('active','cancelled') and s.current_period_end > now()) order by s.current_period_end desc limit 300`, [all]);
  return (<>
    <PageHeader eyebrow="Admin" title="Subscriptions">Extend, revoke or grant complimentary access. Every change is written to the audit log and Discord roles follow automatically.</PageHeader>
    <section className="card p-6 grid gap-4 mb-8 max-w-[720px]"><h2 className="font-semibold text-[17px]">Grant complimentary access</h2>
      <ApiForm action="/api/admin/subscriptions" submitLabel="Grant access" resetOnSuccess className="grid gap-3 md:grid-cols-2">
        <Field label="Member email" name="email" type="email" required />
        <div className="grid gap-1.5"><label htmlFor="f-plan" className="label">Plan</label><select id="f-plan" name="planCode" className="input">{plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></div>
        <Field label="Days (leave empty for the plan's normal length, or lifetime)" name="days" type="number" min={1} max={366} />
        <Field label="Reason" name="note" placeholder="e.g. partner trial, support credit" required />
      </ApiForm></section>
    <div className="flex gap-2 mb-3"><a href="/admin/subscriptions" className={`btn btn-sm ${all ? "btn-secondary" : "btn-primary"}`}>Current</a><a href="/admin/subscriptions?show=all" className={`btn btn-sm ${all ? "btn-primary" : "btn-secondary"}`}>All</a></div>
    {rows.length ? <div className="card overflow-x-auto relative"><table className="table"><thead><tr><th>Member</th><th>Plan</th><th>Source</th><th>Period</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {rows.map((s) => <tr key={s.id}>
        <td className="text-xs">{s.email}</td><td><div className="flex gap-2 items-center">{tierBadge(s.tier)}<span className="text-xs">{s.name}</span></div></td>
        <td className="text-xs">{s.source === "admin_grant" ? <>Granted by {s.granted_by_email ?? "admin"}<div className="text-subtle">{s.note}</div></> : "Payment"}</td>
        <td className="num text-xs whitespace-nowrap">{fmtDate(s.current_period_start)} to {fmtDate(s.current_period_end)}{s.price_minor != null && <div className="text-subtle">{s.source === "payment" ? `$${(Number(s.price_minor) / 100).toFixed(0)} paid` : "complimentary"}</div>}</td>
        <td><Badge tone={s.status === "active" ? "success" : s.status === "cancelled" ? "warning" : "neutral"} dot>{s.status}</Badge></td>
        <td>{s.status !== "expired" && <div className="flex flex-wrap gap-1"><ActionButton action={`/api/admin/subscriptions/${s.id}`} method="PATCH" payload={{ action: "extend", days: 7 }} label="+7 days" variant="ghost" /><ActionButton action={`/api/admin/subscriptions/${s.id}`} method="PATCH" payload={{ action: "extend", days: 30 }} label="+30 days" variant="ghost" /><ActionButton action={`/api/admin/subscriptions/${s.id}`} method="PATCH" payload={{ action: "revoke" }} label="Revoke" variant="ghost" confirmText="Confirm revoke" /></div>}</td>
      </tr>)}
    </tbody></table></div> : <Notice>No subscriptions to show.</Notice>}
  </>);
}
