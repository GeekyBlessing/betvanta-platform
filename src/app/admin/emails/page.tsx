import type { Metadata } from "next";
import { pageRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { emailEnabled } from "@/lib/env";
import { Badge, Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Emails" };
export default async function Emails() {
  await pageRole("/admin/emails", "admin");
  const rows = await q("select * from email_outbox order by created_at desc limit 100");
  return (<>
    <PageHeader eyebrow="Admin" title="Email log" />
    {!emailEnabled() && <div className="mb-4"><Notice tone="warning" title="Email sending is off.">RESEND_API_KEY is not set, so emails are recorded here but not delivered. Members cannot receive verification or reset links until it is set.</Notice></div>}
    <div className="grid gap-3">{rows.map((m) => (
      <details key={m.id} className="card px-5 py-3"><summary className="cursor-pointer flex flex-wrap gap-3 items-center text-sm"><Badge tone={m.status === "sent" ? "success" : m.status === "failed" ? "danger" : "warning"} dot>{m.status}</Badge><strong>{m.subject}</strong><span className="text-subtle">{m.to_email}</span></summary>
        <pre className="mt-3 text-xs whitespace-pre-wrap break-all text-muted">{m.body_text}</pre>{m.error && <p className="text-xs text-danger mt-2">{m.error}</p>}</details>))}</div>
  </>);
}
