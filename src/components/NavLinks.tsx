"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { MAIN_NAV, MORE_NAV } from "./nav-items";
import { SportIcon } from "./SportIcon";
import { useSlip } from "./sportsbook/slip";

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
const Chevron = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** Desktop: Home, Packages, Contact and a More dropdown. */
export function NavLinks() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const click = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", key); document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click); };
  }, [open]);
  const moreOn = MORE_NAV.some((n) => isActive(path, n.href));
  return (
    <nav aria-label="Main" className="hidden lg:flex items-center gap-1">
      {MAIN_NAV.map((n) => {
        const on = isActive(path, n.href);
        return <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={`nav-link ${on ? "is-on" : ""}`}>{n.label}</Link>;
      })}
      <div className="relative" ref={box}>
        <button type="button" className={`nav-link inline-flex items-center gap-1.5 ${moreOn ? "is-on" : ""}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>More <Chevron open={open} /></button>
        {open && <ul id={id} className="nav-dropdown">{MORE_NAV.map((n) => <li key={n.href}><Link href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined}>{n.label}</Link></li>)}</ul>}
      </div>
    </nav>
  );
}

export const SPORT_BAR = [
  { id: "football", slug: "soccer", label: "Football" }, { id: "basketball", slug: "basketball", label: "Basketball" }, { id: "tennis", slug: "tennis", label: "Tennis" },
  { id: "baseball", slug: "baseball", label: "Baseball" }, { id: "american_football", slug: "american-football", label: "American Football" },
  { id: "ice_hockey", slug: "ice-hockey", label: "Ice Hockey" }, { id: "boxing", slug: "boxing", label: "Boxing" }, { id: "mma", slug: "mma", label: "MMA" },
];
/** Horizontal sports navigation under the header. On the homepage each sport filters the board. */
export function SportsBar() {
  const path = usePathname();
  const sp = useSearchParams();
  const current = path === "/" ? sp.get("sport") : null;
  const item = (on: boolean) => `sportsbar-item ${on ? "is-on" : ""}`;
  return (
    <nav aria-label="Sports" className="sportsbar">
      <div className="wrap flex items-stretch gap-1 overflow-x-auto no-scrollbar">
        <Link href="/" className={item(path === "/" && !current)} aria-current={path === "/" && !current ? "page" : undefined}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-6.5L20 11v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" /></svg>All</Link>
        {SPORT_BAR.map((s) => <Link key={s.id} href={`/?sport=${s.slug}`} className={item(current === s.slug)} aria-current={current === s.slug ? "page" : undefined}><SportIcon sport={s.id} size={18} />{s.label}</Link>)}
        <Link href="/virtuals" className={item(isActive(path, "/virtuals"))} aria-current={isActive(path, "/virtuals") ? "page" : undefined}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4M10 9l4 2-4 2z" /></svg>Virtuals</Link>
      </div>
    </nav>
  );
}

const Tab = ({ d }: { d: string }) => <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
/** Phones: fixed bottom bar. Menu opens the four main items (Home, Packages, Contact, More) and the account. */
export function BottomNav({ signedIn, accountHref, accountLabel }: { signedIn: boolean; accountHref: string; accountLabel: string }) {
  const path = usePathname();
  const { items, setOpen: openSlip } = useSlip();
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => { setMenu(false); setMore(false); }, [path]);
  useEffect(() => {
    if (!menu) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [menu]);
  const cls = (on: boolean) => `bottomnav-item ${on ? "is-on" : ""}`;
  return (<>
    {menu && (
      <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu">
        <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={() => setMenu(false)} />
        <nav aria-label="Main mobile" className="menu-sheet">
          <ul className="grid">
            {MAIN_NAV.map((n) => <li key={n.href}><Link href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined} className="menu-link">{n.label}</Link></li>)}
            <li>
              <button type="button" className="menu-link w-full flex items-center justify-between" aria-expanded={more} onClick={() => setMore((m) => !m)}>More <Chevron open={more} /></button>
              {more && <ul className="pb-2">{MORE_NAV.map((n) => <li key={n.href}><Link href={n.href} className="block py-2.5 pl-4 text-[15px] text-muted hover:text-white">{n.label}</Link></li>)}</ul>}
            </li>
          </ul>
          <div className="grid grid-cols-2 gap-2 pt-4">
            {signedIn ? <Link href={accountHref} className="btn btn-accent col-span-2">{accountLabel}</Link> : <>
              <Link href="/register" className="btn btn-accent">Join Now</Link><Link href="/login" className="btn btn-secondary">Log in</Link></>}
          </div>
        </nav>
      </div>)}
    <nav aria-label="Quick navigation" className="bottomnav lg:hidden">
      <Link href="/" className={cls(path === "/")} aria-current={path === "/" ? "page" : undefined}><Tab d="M4 11l8-6.5L20 11v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />Home</Link>
      <Link href="/sports" className={cls(isActive(path, "/sports"))} aria-current={isActive(path, "/sports") ? "page" : undefined}><Tab d="M4 6h16M4 12h16M4 18h16" />A-Z Sports</Link>
      <Link href="/virtuals" className={cls(isActive(path, "/virtuals"))} aria-current={isActive(path, "/virtuals") ? "page" : undefined}><Tab d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5zM8 21h8M10 9l4 2-4 2z" />Virtuals</Link>
      <button type="button" className={cls(false)} onClick={() => openSlip(true)}><span className="relative"><Tab d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />{items.length > 0 && <span className="bottomnav-badge">{items.length}</span>}</span>Bet Slip</button>
      <button type="button" className={cls(menu)} aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Tab d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.6 3.9-6 7.5-6s6.7 2.4 7.5 6" />{signedIn ? "Account" : "Menu"}</button>
    </nav>
  </>);
}
