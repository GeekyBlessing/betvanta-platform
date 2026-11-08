import Link from "next/link";
import { currentUser } from "@/lib/session";
import { Logo, LogoMark, RG_LINE } from "./ui";
import { ThemeToggle } from "./ThemeToggle";
import { LogoutButton } from "./LogoutButton";
import { NavLinks, TabBar } from "./NavLinks";
import { MobileMenu } from "./MobileMenu";
import { discordInviteUrl, instagramHandle, instagramUrl } from "@/lib/env";
import { support } from "@/lib/support";

const NAV = [{ href: "/", label: "Home" }, { href: "/predictions", label: "Predictions" }, { href: "/fixtures", label: "Fixtures" }, { href: "/results", label: "Results" },
  { href: "/performance", label: "Performance" }, { href: "/pricing", label: "Pricing" }, { href: "/community", label: "Community" }];

export async function SiteHeader() {
  const u = await currentUser();
  const account = u ? (u.role === "member" ? "/dashboard" : "/admin") : "/login";
  return (<>
    <header className="bg-surface border-b border-line sticky top-0 z-20" style={{ top: "env(safe-area-inset-top, 0px)" }}>
      <div className="wrap flex items-center gap-6 h-14 md:h-16">
        <Logo size={28} />
        <NavLinks nav={NAV} />
        <div className="flex items-center gap-2 ml-auto">
          <span className="hidden sm:inline-flex"><ThemeToggle /></span>
          {u ? (<>
            <Link href={account} className="btn btn-secondary btn-sm">{u.role === "member" ? "Dashboard" : "Admin"}</Link>
            <span className="hidden lg:inline-flex"><LogoutButton /></span>
          </>) : (<>
            <span className="hidden lg:inline-flex"><Link href="/login" className="btn btn-ghost btn-sm">Log in</Link></span>
            <Link href="/register" className="btn btn-accent btn-sm">Get started</Link>
          </>)}
          <MobileMenu nav={NAV.filter((n) => n.href !== "/")} signedIn={Boolean(u)} accountHref={u ? account : "/register"} accountLabel={u ? (u.role === "member" ? "Open dashboard" : "Open admin") : "Get started"} onDark={false} />
        </div>
      </div>
    </header>
    <TabBar accountHref={u ? account : "/login"} accountLabel={u ? "Account" : "Log in"} />
  </>);
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
          <Link href="/about" className="text-muted hover:text-ink">About</Link>{discordInviteUrl() ? <a href={discordInviteUrl()!} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-ink">Join our Discord<span className="sr-only"> (opens in a new tab)</span></a> : <Link href="/community" className="text-muted hover:text-ink">Discord community</Link>}{instagramUrl() && <a href={instagramUrl()!} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-ink">Instagram {instagramHandle()}<span className="sr-only"> (opens in a new tab)</span></a>}<Link href="/contact" className="text-muted hover:text-ink">Contact</Link><Link href="/legal/terms" className="text-muted hover:text-ink">Terms</Link><Link href="/legal/privacy" className="text-muted hover:text-ink">Privacy</Link><Link href="/responsible-gambling" className="text-muted hover:text-ink">Responsible gambling</Link>
        </div>
      </div>
      <div className="wrap pb-8 text-xs text-subtle">© {new Date().getFullYear()} BETVANTA. All rights reserved.</div>
    </footer>
  );
}
