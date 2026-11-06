"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

/** Phone navigation: one Menu button that opens every link, so nothing hides in a sideways-scrolling row. */
export function MobileMenu({ nav, signedIn, accountHref, accountLabel, onDark }: { nav: { href: string; label: string }[]; signedIn: boolean; accountHref: string; accountLabel: string; onDark: boolean }) {
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
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className={`h-10 w-10 grid place-items-center rounded-md ${onDark ? "text-sand hover:bg-white/10" : "text-ink hover:bg-sunken"}`}>
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav id={id} aria-label="Main mobile" className="menu-panel absolute inset-x-0 top-full border-b border-line bg-surface text-ink shadow-xl max-h-[calc(100svh-80px)] overflow-y-auto">
          <ul className="wrap py-2 grid">
            {nav.map((n) => <li key={n.href}><Link href={n.href} aria-current={path === n.href ? "page" : undefined} className="block py-3 text-[16px] font-medium border-b border-line">{n.label}</Link></li>)}
            <li><Link href="/faq" className="block py-3 text-[16px] font-medium border-b border-line">FAQ</Link></li>
          </ul>
          <div className="wrap pb-4 pt-1 grid grid-cols-2 gap-2">
            {signedIn ? <Link href={accountHref} className="btn btn-primary col-span-2">{accountLabel}</Link> : <>
              <Link href="/login" className="btn btn-secondary">Log in</Link>
              <Link href="/register" className="btn btn-accent">Get started</Link></>}
          </div>
        </nav>)}
    </div>
  );
}
