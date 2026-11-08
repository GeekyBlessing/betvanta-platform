"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };
const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

/** Desktop navigation with a clear current-page marker. */
export function NavLinks({ nav }: { nav: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden lg:flex items-stretch self-stretch gap-1 flex-1">
      {nav.map((n) => {
        const on = isActive(path, n.href);
        return <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}
          className={`nav-link relative inline-flex items-center px-3 text-[14px] font-semibold ${on ? "text-ink" : "text-muted hover:text-ink"}`}>{n.label}</Link>;
      })}
    </nav>
  );
}

const TabIcon = ({ d }: { d: string }) => <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const TABS = [
  { href: "/", label: "Home", d: "M4 11l8-6.5L20 11v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" },
  { href: "/predictions", label: "Picks", d: "M4 15l5-5 4 4 7-7M14 7h6v6" },
  { href: "/fixtures", label: "Fixtures", d: "M4 6.5h16M4 12h16M4 17.5h10M8 3.5v6M16 3.5v6" },
  { href: "/results", label: "Results", d: "M5 12.5l4.5 4.5L19 7.5" },
];
/** Phone tab bar: the four places members go most, always one tap away. */
export function TabBar({ accountHref, accountLabel }: { accountHref: string; accountLabel: string }) {
  const path = usePathname();
  const tabs = [...TABS, { href: accountHref, label: accountLabel, d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.6 3.9-6 7.5-6s6.7 2.4 7.5 6" }];
  return (
    <nav aria-label="Quick navigation" className="tabbar md:hidden fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-line" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const on = isActive(path, t.href);
          return <li key={t.label}><Link href={t.href} aria-current={on ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold ${on ? "text-link" : "text-subtle"}`}><TabIcon d={t.d} />{t.label}</Link></li>;
        })}
      </ul>
    </nav>
  );
}
