export type NavItem = { href: string; label: string; icon?: "vip" | "bell" | "user" };
/** Public navigation, as in the client's reference: Home, Packages, Contact, and More (VIP Access, Notifications, My Account). */
export const MAIN_NAV: NavItem[] = [{ href: "/", label: "Home" }, { href: "/packages", label: "Packages" }, { href: "/contact", label: "Contact" }];
export const MORE_NAV: NavItem[] = [
  { href: "/dashboard/predictions", label: "VIP Access", icon: "vip" },
  { href: "/dashboard/settings", label: "Notifications", icon: "bell" },
  { href: "/dashboard", label: "My Account", icon: "user" },
];
