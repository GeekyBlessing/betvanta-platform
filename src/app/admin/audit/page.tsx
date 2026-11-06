import type { Metadata } from "next";
import { pageRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Audit log" };
export default async function Audit() {
  await pageRole("/admin/audit", "admin");
  const rows = await q(`select a.*, u.email from audit_logs a left join users u on u.id = a.actor_id order by a.id desc limit 300`);
  return (<>
    <PageHeader eyebrow="Admin" title="Audit log">Append-only. Entries cannot be edited or deleted, even by admins.</PageHeader>
    <div className="card overflow-x-auto relative"><table className="table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.id}><td className="num text-xs whitespace-nowrap">{new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19)}</td><td className="text-xs">{r.email ?? "system"}</td><td className="num text-xs">{r.action}</td><td className="text-xs">{r.entity}{r.entity_id ? `:${String(r.entity_id).slice(0, 18)}` : ""}</td><td className="num text-[11px] text-subtle max-w-[360px] break-all">{JSON.stringify(r.details)}</td></tr>)}
    </tbody></table></div>
  </>);
}
