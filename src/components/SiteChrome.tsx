import Link from "next/link";
import { currentUser } from "@/lib/session";
import { Logo, LogoMark, RG_LINE } from "./ui";
import { ThemeToggle } from "./ThemeToggle";
import { LogoutButton } from "./LogoutButton";
import { HeaderScrollState } from "./HeaderScrollState";
import { MobileMenu } from "./MobileMenu";
import { discordInviteUrl } from "@/lib/env";
import { support } from "@/lib/support";

const NAV = [{ href: "/predictions", label: "Predictions" }, { href: "/sports", label: "Sports" }, { href: "/fixtures", label: "Fixtures" }, { href: "/performance", label: "Performance" }, { href: "/pricing", label: "Pricing" }, { href: "/community", label: "Community" }];

/** `overlay` sits on top of the homepage hero image: transparent at first, solid once the page scrolls. */
export async function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const u = await currentUser();
  const link = overlay ? "text-sand/80 hover:text-sand hover:bg-white/10" : "text-muted hover:text-ink hover:bg-sunken";
  return (
    <header id={overlay ? "site-header-overlay" : undefined}
      className={overlay ? "site-header-overlay on-dark fixed inset-x-0 top-0 z-30 border-b border-transparent text-sand" : "bg-surface border-b border-line sticky top-0 z-20"}
      style={overlay ? { paddingTop: "env(safe-area-inset-top, 0px)" } : { top: "env(safe-area-inset-top, 0px)" }}>
      {overlay && <HeaderScrollState targetId="site-header-overlay" />}
      <div className={`wrap flex items-center gap-6 py-2 ${overlay ? "min-h-[72px]" : "min-h-16"}`}>
        <Logo size={overlay ? 34 : 28} onDark={overlay} />
        <nav aria-label="Main" className="hidden lg:flex gap-1 flex-1">
          {NAV.map((n) => <Link key={n.href} href={n.href} className={`px-3 py-2 rounded-md text-sm font-medium ${link}`}>{n.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2 ml-auto">
          <span className="hidden sm:inline-flex"><ThemeToggle /></span>
          {u ? (<>
            <Link href={u.role === "member" ? "/dashboard" : "/admin"} className="btn btn-secondary btn-sm">{u.role === "member" ? "Dashboard" : "Admin"}</Link>
            <span className="hidden lg:inline-flex"><LogoutButton /></span>
          </>) : (<>
            <span className="hidden lg:inline-flex"><Link href="/login" className="btn btn-ghost btn-sm">Log in</Link></span>
            <Link href="/register" className="btn btn-accent btn-sm">Get started</Link>
          </>)}
          <MobileMenu nav={NAV} signedIn={Boolean(u)} accountHref={u ? (u.role === "member" ? "/dashboard" : "/admin") : "/register"} accountLabel={u ? (u.role === "member" ? "Open dashboard" : "Open admin") : "Get started"} onDark={overlay} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const s = support();
  return (
    <footer className="border-t border-line mt-16 bg-surface">
      <div className="wrap py-10 grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="grid gap-3 content-start">
          <div className="flex items-center gap-2.5"><LogoMark size={24} /><span className="display font-bold tracking-[.06em]">BETVANTA</span></div>
          <p className="text-sm text-muted">Smarter Insights. Better Decisions.</p>
          <address className="not-italic text-sm text-muted grid gap-0.5">
            <span>Support: <a href={s.emailHref} className="text-link hover:underline">{s.email}</a></span>
            <span>Phone: <a href={s.phoneHref} className="text-link hover:underline num">{s.phoneDisplay}</a></span>
          </address>
          <p className="text-xs text-subtle max-w-[48ch]">{RG_LINE} If betting stops being fun, take a break and seek support.</p>
        </div>
        <div className="grid gap-2 content-start text-sm"><span className="eyebrow">Product</span>
          <Link href="/predictions" className="text-muted hover:text-ink">Predictions</Link><Link href="/fixtures" className="text-muted hover:text-ink">Fixtures and scores</Link><Link href="/sports" className="text-muted hover:text-ink">Sports</Link><Link href="/performance" className="text-muted hover:text-ink">Performance</Link><Link href="/pricing" className="text-muted hover:text-ink">Pricing</Link><Link href="/faq" className="text-muted hover:text-ink">FAQ</Link>
        </div>
        <div className="grid gap-2 content-start text-sm"><span className="eyebrow">Company</span>
          <Link href="/about" className="text-muted hover:text-ink">About</Link>{discordInviteUrl() ? <a href={discordInviteUrl()!} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-ink">Join our Discord<span className="sr-only"> (opens in a new tab)</span></a> : <Link href="/community" className="text-muted hover:text-ink">Discord community</Link>}<Link href="/contact" className="text-muted hover:text-ink">Contact</Link><Link href="/legal/terms" className="text-muted hover:text-ink">Terms</Link><Link href="/legal/privacy" className="text-muted hover:text-ink">Privacy</Link><Link href="/responsible-gambling" className="text-muted hover:text-ink">Responsible gambling</Link>
        </div>
      </div>
      <div className="wrap pb-8 text-xs text-subtle">© {new Date().getFullYear()} BETVANTA. All rights reserved.</div>
    </footer>
  );
}
