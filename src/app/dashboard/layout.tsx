import { pageUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
export const dynamic = "force-dynamic";
const NAV = [{ href: "/dashboard", label: "Overview" }, { href: "/dashboard/predictions", label: "Predictions" }, { href: "/dashboard/history", label: "History" }, { href: "/dashboard/billing", label: "Billing" }, { href: "/dashboard/settings", label: "Settings" }];
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const u = await pageUser("/dashboard");
  const nav = u.role === "member" ? NAV : [...NAV, { href: "/admin", label: "Admin console" }];
  return <Shell nav={nav} user={u} area="Dashboard">{children}</Shell>;
}
