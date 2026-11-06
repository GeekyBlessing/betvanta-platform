import type { Metadata } from "next";
import { pageRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { Badge, fmtDate, Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Testimonials" };
export default async function Testimonials() {
  await pageRole("/admin/testimonials", "admin");
  const rows = await q(`select t.*, u.email from testimonials t left join users u on u.id = t.user_id order by (t.status = 'pending') desc, t.created_at desc limit 200`);
  return (<>
    <PageHeader eyebrow="Admin" title="Testimonials">Only member-submitted reviews with recorded publication consent can be approved. Approved reviews appear on the homepage; members can withdraw them at any time.</PageHeader>
    {rows.length ? <div className="grid gap-3">{rows.map((t) => (
      <div key={t.id} className="card p-5 grid gap-2">
        <div className="flex flex-wrap gap-2 items-center"><Badge tone={t.status === "approved" ? "success" : t.status === "pending" ? "warning" : "neutral"} dot>{t.status}</Badge><strong>{t.display_name}</strong><span className="text-xs text-subtle">{t.location ?? ""} · {t.rating}/5 · {t.verified_subscriber ? "paid subscriber" : "free member"} · {t.email ?? "account deleted"} · {fmtDate(t.created_at)}</span></div>
        <p className="text-[15px]">{t.body}</p>
        <p className="text-xs text-subtle">Consent recorded {fmtDate(t.consent_at)}: &ldquo;{t.consent_text}&rdquo;</p>
        {t.status !== "withdrawn" && <div className="flex gap-2">{t.status !== "approved" && <ActionButton action={`/api/admin/testimonials/${t.id}`} method="PATCH" payload={{ action: "approve" }} label="Approve" variant="primary" />}{t.status !== "rejected" && <ActionButton action={`/api/admin/testimonials/${t.id}`} method="PATCH" payload={{ action: "reject" }} label="Reject" variant="secondary" />}</div>}
      </div>))}</div> : <Notice>No reviews submitted yet.</Notice>}
  </>);
}
