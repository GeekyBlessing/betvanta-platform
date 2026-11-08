import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { currentUser } from "@/lib/session";
import { Logo, LogoMark, RG_LINE } from "./ui";
import { BottomNav, NavLinks, SportsBar } from "./NavLinks";
import { MAIN_NAV, MORE_NAV } from "./nav-items";
import { MobileSlip, SlipProvider } from "./sportsbook/slip";
import { DiscordCta, InstagramCta, XCta } from "./Community";
import { discordInviteUrl, instagramHandle, instagramUrl, xHandle, xUrl } from "@/lib/env";
import { support } from "@/lib/support";

const SearchIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>;

/** Public header: logo, the four main items, search, Join Now and Log in (or the account), then the sports bar. */
export async function SiteHeader() {
  const u = await currentUser();
  const account = u ? (u.role === "member" ? "/dashboard" : "/admin") : "/login";
  return (
    <header className="site-header">
      <div className="topbar">
        <div className="wrap flex items-center gap-3 h-14 md:h-16">
          <Logo size={30} onDark />
          <div className="hidden lg:flex flex-1 pl-6"><NavLinks /></div>
          <div className="flex items-center gap-2 ml-auto">
            <form action="/search" className="hidden md:flex items-center header-search" role="search">
              <SearchIcon /><input name="q" placeholder="Search teams or leagues" aria-label="Search teams or leagues" />
            </form>
            <Link href="/search" className="md:hidden h-10 w-10 grid place-items-center rounded-md text-white hover:bg-white/10" aria-label="Search"><SearchIcon /></Link>
            {u ? (
              <Link href={account} className="btn btn-accent btn-sm">{u.role === "member" ? "My Account" : "Admin"}</Link>
            ) : (<>
              <Link href="/register" className="btn btn-accent btn-sm header-join">Join Now</Link>
              <Link href="/login" className="btn btn-sm header-login">Log in</Link>
            </>)}
          </div>
        </div>
      </div>
      <Suspense fallback={<div className="sportsbar h-[46px]" />}><SportsBar /></Suspense>
    </header>
  );
}

export function SiteFooter() {
  const s = support();
  const discord = discordInviteUrl();
  return (
    <footer className="site-footer">
      <div className="wrap py-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-center border-b border-line">
        <div className="grid gap-1"><p className="font-bold text-[17px]">Daily picks live in our community</p>
          <p className="text-[14px] text-muted">Join the BETVANTA Discord and follow us on Instagram{xHandle() ? ` and X (${xHandle()})` : ""} for daily picks, updates and exclusive content.</p></div>
        <div className="flex flex-wrap gap-2"><DiscordCta className="btn btn-accent" label="Join Our Discord" /><InstagramCta className="btn btn-secondary" label="Follow Us on Instagram" /><XCta className="btn btn-secondary" label="Follow Us on X" /></div>
      </div>
      <div className="wrap py-10 grid gap-10 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="grid gap-3 content-start">
          <div className="flex items-center gap-2.5"><LogoMark size={28} /><span className="logo-word text-[18px]">BET<span className="text-red">VANTA</span></span></div>
          <p className="text-sm text-muted">Smarter Insights. Better Decisions.</p>
          <address className="not-italic text-sm text-muted grid gap-0.5">
            <span>Support: <a href={s.emailHref} className="text-white hover:underline">{s.email}</a></span>
            <span>Phone: <a href={s.phoneHref} className="text-white hover:underline num">{s.phoneDisplay}</a></span>
          </address>
        </div>
        <div className="grid gap-2 content-start text-sm"><span className="footer-head">BETVANTA</span>
          {MAIN_NAV.map((n) => <Link key={n.href} href={n.href} className="footer-link">{n.label}</Link>)}
          <Link href="/virtuals" className="footer-link">Virtual Sports</Link>
          {discord ? <a href={discord} target="_blank" rel="noopener noreferrer" className="footer-link">Join Our Discord<span className="sr-only"> (opens in a new tab)</span></a> : <Link href="/community" className="footer-link">Discord community</Link>}
          {instagramUrl() && <a href={instagramUrl()!} target="_blank" rel="noopener noreferrer" className="footer-link">Follow Us on Instagram {instagramHandle()}<span className="sr-only"> (opens in a new tab)</span></a>}
          {xUrl() && <a href={xUrl()!} target="_blank" rel="noopener noreferrer" className="footer-link">Follow Us on X {xHandle()}<span className="sr-only"> (opens in a new tab)</span></a>}
        </div>
        <div className="grid gap-2 content-start text-sm"><span className="footer-head">More</span>
          {MORE_NAV.map((n) => <Link key={n.href} href={n.href} className="footer-link">{n.label}</Link>)}
        </div>
      </div>
      <div className="wrap pb-8 grid gap-2 text-xs text-subtle">
        <p className="max-w-[90ch]">BETVANTA publishes sports analysis and picks. We do not accept bets, deposits or withdrawals; prices shown are BETVANTA model prices for demonstration, not bookmaker odds. {RG_LINE}</p>
        <p>© {new Date().getFullYear()} BETVANTA. All rights reserved.</p>
      </div>
    </footer>
  );
}

/** Every public page: header, page, footer, the phone bet slip and bottom navigation. */
export async function PublicShell({ children }: { children: ReactNode }) {
  const u = await currentUser();
  const account = u ? (u.role === "member" ? "/dashboard" : "/admin") : "/login";
  return (
    <SlipProvider>
      <SiteHeader />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
      <MobileSlip />
      <BottomNav signedIn={Boolean(u)} accountHref={account} accountLabel={u ? (u.role === "member" ? "My Account" : "Admin") : "Log in"} />
    </SlipProvider>
  );
}
