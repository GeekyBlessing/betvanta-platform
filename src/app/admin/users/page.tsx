import type { Metadata } from "next";
import { pageRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { Badge, fmtDate, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Users" };
export default async function Users(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  const me = await pageRole("/admin/users", "admin");
  const term = (searchParams.q ?? "").trim().slice(0, 100);
  const rows = await q(`select u.id, u.email, u.display_name, u.role, u.status, u.email_verified_at, u.created_at,
     (select tier from subscriptions s where s.user_id = u.id and s.status in ('active','cancelled') and s.current_period_end > now() order by case tier when 'vip' then 2 else 1 end desc limit 1) tier
     from users u where ($1 = '' or u.email ilike '%' || $1 || '%' or u.display_name ilike '%' || $1 || '%') order by u.created_at desc limit 200`, [term]);
  return (<>
    <PageHeader eyebrow="Admin" title="Users" />
    <form className="mb-4 flex gap-2 max-w-[420px]"><input name="q" defaultValue={term} placeholder="Search name or email" className="input" aria-label="Search users" /><button className="btn btn-secondary">Search</button></form>
    <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Member</th><th>Joined</th><th>Plan</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {rows.map((u) => <tr key={u.id}>
        <td><div className="font-semibold">{u.display_name}</div><div className="text-xs text-subtle">{u.email}{!u.email_verified_at && " · unverified"}</div></td>
        <td className="num whitespace-nowrap">{fmtDate(u.created_at)}</td><td className="capitalize">{u.tier ?? "free"}</td><td className="capitalize">{u.role}</td>
        <td><Badge tone={u.status === "active" ? "success" : "danger"} dot>{u.status}</Badge></td>
        <td>{u.id === me.id ? <span className="text-xs text-subtle">You</span> : <div className="flex flex-wrap gap-1">
          {(["member", "analyst", "admin"] as const).filter((r) => r !== u.role).map((r) => <ActionButton key={r} action={`/api/admin/users/${u.id}`} method="PATCH" payload={{ role: r }} label={`Make ${r}`} variant="ghost" confirmText={`Confirm ${r}`} />)}
          <ActionButton action={`/api/admin/users/${u.id}`} method="PATCH" payload={{ status: u.status === "active" ? "suspended" : "active" }} label={u.status === "active" ? "Suspend" : "Reactivate"} variant="ghost" confirmText="Confirm" />
        </div>}</td></tr>)}
    </tbody></table></div>
  </>);
}
