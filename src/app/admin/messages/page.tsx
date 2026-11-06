import type { Metadata } from "next";
import { pageRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDate, Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Messages" };
export default async function Messages() {
  await pageRole("/admin/messages", "admin");
  const rows = await q("select * from contact_messages order by created_at desc limit 200");
  return (<>
    <PageHeader eyebrow="Admin" title="Contact messages" />
    {rows.length ? <div className="grid gap-3">{rows.map((m) => <div key={m.id} className="card p-5 grid gap-2"><div className="text-sm"><strong>{m.name}</strong> <span className="text-subtle">{m.email} · {fmtDate(m.created_at)}</span></div><p className="whitespace-pre-wrap text-[15px]">{m.message}</p></div>)}</div> : <Notice>No messages.</Notice>}
  </>);
}
