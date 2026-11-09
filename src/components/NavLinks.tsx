"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { MAIN_NAV, MORE_NAV, type NavItem } from "./nav-items";

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
const Chevron = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const ICON: Record<NonNullable<NavItem["icon"]>, string> = {
  vip: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4M12 13v4M8.5 20h7",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.6 3.9-6 7.5-6s6.7 2.4 7.5 6",
};
const Icon = ({ i }: { i?: NavItem["icon"] }) => i ? <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[i]} /></svg> : null;

/** Desktop: Home, Packages, Contact and More (VIP Access, Notifications, My Account). */
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
  return (
    <nav aria-label="Main" className="hidden lg:flex items-center gap-1">
      {MAIN_NAV.map((n) => { const on = isActive(path, n.href); return <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={`nav-link ${on ? "is-on" : ""}`}>{n.label}</Link>; })}
      <div className="relative" ref={box}>
        <button type="button" className="nav-link inline-flex items-center gap-1.5" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>More <Chevron open={open} /></button>
        {open && <ul id={id} className="nav-dropdown">{MORE_NAV.map((n) => <li key={n.href}><Link href={n.href} className="flex items-center gap-2.5"><Icon i={n.icon} />{n.label}</Link></li>)}</ul>}
      </div>
    </nav>
  );
}

/** Phones and tablets: a menu button with the same items and Subscribe Now. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);
  return (
    <div className="lg:hidden">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="h-11 w-10 -mr-2 grid place-items-center rounded-md text-white hover:bg-white/10">
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
      </button>
      {open && (
        <nav id={id} aria-label="Main mobile" className="mobile-menu">
          <ul className="wrap py-2 grid">
            {MAIN_NAV.map((n) => <li key={n.href}><Link href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined} className="menu-link">{n.label}</Link></li>)}
            <li className="pt-3 pb-1 text-[12px] font-bold uppercase tracking-[.12em] text-subtle">More</li>
            {MORE_NAV.map((n) => <li key={n.href}><Link href={n.href} className="menu-link flex items-center gap-2.5"><Icon i={n.icon} />{n.label}</Link></li>)}
          </ul>
          <div className="wrap pb-5 pt-2"><Link href="/packages" className="btn btn-accent btn-lg w-full">Subscribe Now</Link></div>
        </nav>)}
    </div>
  );
}
