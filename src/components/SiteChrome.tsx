import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, LogoLockup, RG_LINE } from "./ui";
import { MobileMenu, NavLinks } from "./NavLinks";
import { support } from "@/lib/support";

const Trophy = () => <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4M12 13v4M8.5 20h7" /></svg>;

/** Header, as in the client's reference: logo, Home, Packages, Contact, More, and Subscribe Now. */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="topbar">
        <div className="wrap flex items-center gap-3 h-16 md:h-[72px]">
          <span className="sm:hidden"><Logo size={32} /></span><span className="hidden sm:inline-flex"><Logo size={42} /></span>
          <div className="hidden lg:flex flex-1 justify-center"><NavLinks /></div>
          <div className="flex items-center gap-2 ml-auto lg:ml-0">
            <Link href="/packages" className="btn btn-accent header-cta"><Trophy />Subscribe Now</Link>
            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const s = support();
  return (
    <footer className="site-footer">
      <div className="wrap py-10 grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="grid gap-3 justify-items-start">
          <LogoLockup height={92} href="/" />
          <p className="text-sm text-muted">Support: <a href={s.emailHref} className="text-white hover:underline">{s.email}</a> · <a href={s.phoneHref} className="text-white hover:underline num">{s.phoneDisplay}</a></p>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/legal/terms" className="footer-link">Terms</Link>
          <Link href="/legal/privacy" className="footer-link">Privacy</Link>
          <Link href="/responsible-gambling" className="footer-link">Responsible Gambling</Link>
        </nav>
      </div>
      <div className="wrap pb-8 grid gap-2 text-xs text-subtle">
        <p className="max-w-[90ch]">BETVANTA publishes sports analysis and picks; we do not take bets or hold funds. {RG_LINE}</p>
        <p>© {new Date().getFullYear()} BETVANTA. All rights reserved.</p>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (<><SiteHeader /><main id="main" className="flex-1">{children}</main><SiteFooter /></>);
}
