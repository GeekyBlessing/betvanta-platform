"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { MAIN_NAV, MORE_NAV } from "./nav-items";

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
        {open && (
          <ul id={id} className="nav-dropdown">
            {MORE_NAV.map((n) => <li key={n.href}><Link href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined}>{n.label}</Link></li>)}
          </ul>)}
      </div>
    </nav>
  );
}

/** Phones and tablets: a hamburger with the same four items; More expands in place. */
export function MobileMenu({ signedIn, accountHref, accountLabel }: { signedIn: boolean; accountHref: string; accountLabel: string }) {
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const id = useId();
  const path = usePathname();
  useEffect(() => { setOpen(false); setMore(false); }, [path]);
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
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav id={id} aria-label="Main mobile" className="mobile-menu">
          <ul className="wrap py-2 grid">
            {MAIN_NAV.map((n) => <li key={n.href}><Link href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined} className="mobile-menu-link">{n.label}</Link></li>)}
            <li>
              <button type="button" className="mobile-menu-link w-full flex items-center justify-between" aria-expanded={more} onClick={() => setMore((m) => !m)}>More <Chevron open={more} /></button>
              {more && <ul className="pb-2">{MORE_NAV.map((n) => <li key={n.href}><Link href={n.href} className="block py-2.5 pl-4 text-[15px] text-white/80 hover:text-white">{n.label}</Link></li>)}</ul>}
            </li>
          </ul>
          <div className="wrap pb-5 pt-2 grid gap-2">
            <Link href="/packages" className="btn btn-accent btn-lg w-full">Subscribe Now</Link>
            <Link href={signedIn ? accountHref : "/login"} className="btn btn-lg w-full mobile-menu-secondary">{signedIn ? accountLabel : "Log in"}</Link>
          </div>
        </nav>)}
    </div>
  );
}
