import { pageRole } from "@/lib/auth";
import { Shell } from "@/components/Shell";
export const dynamic = "force-dynamic";
const STAFF = [{ href: "/admin", label: "Overview" }, { href: "/admin/predictions", label: "Predictions" }, { href: "/admin/data", label: "Sports data" }];
const ADMIN = [{ href: "/admin/users", label: "Users" }, { href: "/admin/payments", label: "Payments" }, { href: "/admin/plans", label: "Plans" }, { href: "/admin/emails", label: "Emails" }, { href: "/admin/messages", label: "Messages" }, { href: "/admin/audit", label: "Audit log" }];
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await pageRole("/admin", "admin", "analyst");
  const nav = [...STAFF, ...(u.role === "admin" ? ADMIN : []), { href: "/dashboard", label: "Member view" }];
  return <Shell nav={nav} user={u} area="Admin">{children}</Shell>;
}
