export type NavItem = { href: string; label: string };
/** Public navigation: four items only (Home, Packages, Contact, More). Everything secondary sits under More. */
export const MAIN_NAV: NavItem[] = [{ href: "/", label: "Home" }, { href: "/packages", label: "Packages" }, { href: "/contact", label: "Contact" }];
export const MORE_NAV: NavItem[] = [
  { href: "/about", label: "About" }, { href: "/faq", label: "FAQ" }, { href: "/responsible-gambling", label: "Responsible Gambling" },
  { href: "/legal/terms", label: "Terms & Conditions" }, { href: "/legal/privacy", label: "Privacy Policy" },
];
