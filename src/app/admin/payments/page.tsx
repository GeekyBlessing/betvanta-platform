import type { Metadata } from "next";
import { pageRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { formatMoney } from "@/lib/services/billing";
import { ActionButton } from "@/components/ActionButton";
import { Badge, fmtDate, Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Payments" };
export default async function Payments() {
  await pageRole("/admin/payments", "admin");
  const rows = await q(`select y.*, u.email, p.name, p.interval from payments y join users u on u.id = y.user_id join plans p on p.id = y.plan_id order by y.created_at desc limit 300`);
  const hooks = await q(`select event_type, signature_valid, processed_at, error, received_at from webhook_events order by received_at desc limit 20`);
  return (<>
    <PageHeader eyebrow="Admin" title="Payments">Access is granted only after Paystack confirms a payment to the server. Re-verify asks Paystack again and activates if it is now confirmed.</PageHeader>
    {rows.length ? <div className="card overflow-x-auto mb-8"><table className="table"><thead><tr><th>Date</th><th>Member</th><th>Plan</th><th>Reference</th><th className="text-right">Amount</th><th>Status</th><th>Verified via</th><th /></tr></thead><tbody>
      {rows.map((r) => <tr key={r.id}><td className="num whitespace-nowrap">{fmtDate(r.created_at)}</td><td className="text-xs">{r.email}</td><td>{r.name} {r.interval}</td><td className="num text-xs">{r.reference}</td><td className="num text-right">{formatMoney(r.amount_minor, r.currency)}</td>
        <td><Badge tone={r.status === "success" ? "success" : r.status === "failed" ? "danger" : r.status === "flagged" ? "warning" : "neutral"} dot>{r.status}</Badge>{r.note && <div className="text-xs text-subtle mt-1">{r.note}</div>}</td><td>{r.verified_via ?? "-"}</td>
        <td>{r.status === "pending" && <ActionButton action={`/api/admin/payments/${r.reference}`} label="Re-verify" variant="ghost" />}</td></tr>)}
    </tbody></table></div> : <Notice>No payments yet.</Notice>}
    <h2 className="font-semibold text-[17px] mb-3">Recent Paystack webhooks</h2>
    {hooks.length ? <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Received</th><th>Event</th><th>Signature</th><th>Processed</th></tr></thead><tbody>
      {hooks.map((h, i) => <tr key={i}><td className="num">{fmtDate(h.received_at)}</td><td>{h.event_type}</td><td>{h.signature_valid ? "Valid" : "Invalid"}</td><td>{h.error ? <span className="text-danger text-xs">{h.error}</span> : h.processed_at ? "Yes" : "No"}</td></tr>)}
    </tbody></table></div> : <Notice>No webhooks received yet.</Notice>}
  </>);
}
