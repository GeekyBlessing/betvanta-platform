import Link from "next/link";
import { currentUser } from "@/lib/session";
import { Logo, LogoMark, RG_LINE } from "./ui";
import { ThemeToggle } from "./ThemeToggle";
import { MobileMenu, NavLinks } from "./NavLinks";
import { MAIN_NAV, MORE_NAV } from "./nav-items";
import { discordInviteUrl, instagramHandle, instagramUrl } from "@/lib/env";
import { support } from "@/lib/support";

/**
 * Public header: logo, four navigation items (Home, Packages, Contact, More) and Subscribe Now.
 * `overlay` lays it over the homepage hero; elsewhere it is a solid Deep Charcoal bar that stays at the top.
 */
export async function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const u = await currentUser();
  const account = u ? (u.role === "member" ? "/dashboard" : "/admin") : "/login";
  const accountLabel = u ? (u.role === "member" ? "Dashboard" : "Admin") : "Log in";
  return (
    <header className={`site-header ${overlay ? "site-header-overlay" : "site-header-solid"}`}>
      <div className="wrap flex items-center gap-3 h-16 md:h-[76px]">
        <span className="sm:hidden"><Logo size={26} onDark /></span><span className="hidden sm:inline-flex"><Logo size={32} onDark /></span>
        <div className="hidden lg:flex flex-1 justify-center"><NavLinks /></div>
        <div className="flex items-center gap-2 sm:gap-3 ml-auto lg:ml-0">
          <Link href={account} className="hidden lg:inline-flex text-[14px] font-semibold text-white/85 hover:text-white px-2">{accountLabel}</Link>
          <Link href="/packages" className="btn btn-accent header-cta">Subscribe Now</Link>
          <MobileMenu signedIn={Boolean(u)} accountHref={account} accountLabel={u ? `Open ${accountLabel.toLowerCase()}` : "Log in"} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const s = support();
  const discord = discordInviteUrl();
  return (
    <footer className="site-footer">
      <div className="wrap py-12 grid gap-10 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="grid gap-3 content-start">
          <div className="flex items-center gap-2.5"><LogoMark size={28} reversed /><span className="display font-bold tracking-[.06em] text-white">BETVANTA</span></div>
          <p className="text-sm text-white/70">Smarter Insights. Better Decisions.</p>
          <address className="not-italic text-sm text-white/70 grid gap-0.5">
            <span>Support: <a href={s.emailHref} className="text-[#E3A27C] hover:underline">{s.email}</a></span>
            <span>Phone: <a href={s.phoneHref} className="text-[#E3A27C] hover:underline num">{s.phoneDisplay}</a></span>
          </address>
        </div>
        <div className="grid gap-2 content-start text-sm"><span className="footer-head">BETVANTA</span>
          {MAIN_NAV.map((n) => <Link key={n.href} href={n.href} className="footer-link">{n.label}</Link>)}
          {discord ? <a href={discord} target="_blank" rel="noopener noreferrer" className="footer-link">Join our Discord<span className="sr-only"> (opens in a new tab)</span></a> : <Link href="/community" className="footer-link">Discord community</Link>}
          {instagramUrl() && <a href={instagramUrl()!} target="_blank" rel="noopener noreferrer" className="footer-link">Instagram {instagramHandle()}<span className="sr-only"> (opens in a new tab)</span></a>}
        </div>
        <div className="grid gap-2 content-start text-sm"><span className="footer-head">More</span>
          {MORE_NAV.map((n) => <Link key={n.href} href={n.href} className="footer-link">{n.label}</Link>)}
        </div>
      </div>
      <div className="wrap pb-8 grid gap-3 md:flex md:items-center md:justify-between text-xs text-white/55">
        <p className="max-w-[70ch]">{RG_LINE} If betting stops being fun, take a break and seek support. © {new Date().getFullYear()} BETVANTA. All rights reserved.</p>
        <span className="footer-theme"><ThemeToggle /></span>
      </div>
    </footer>
  );
}
