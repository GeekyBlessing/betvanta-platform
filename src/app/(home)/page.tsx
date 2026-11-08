import Link from "next/link";
import { currentUser } from "@/lib/session";
import { q } from "@/lib/db";
import { tierFor } from "@/lib/services/entitlements";
import { sportsbookBoard } from "@/lib/services/sportsbook";
import { SPORTS } from "@/lib/services/sports";
import { formatMoney, periodLabel, type Plan } from "@/lib/services/billing";
import { discordInviteUrl, instagramHandle, instagramUrl } from "@/lib/env";
import { FeaturedRail, MatchList } from "@/components/sportsbook/board";
import { DesktopSlip } from "@/components/sportsbook/slip";
import { SportIcon } from "@/components/SportIcon";
import { SubscribeAssistant } from "@/components/SubscribeAssistant";
import { subscribeAssistantProps } from "@/lib/services/manual-payments/assistant";
export const dynamic = "force-dynamic";

type Search = { sport?: string; comp?: string; window?: string };

export default async function Home(props: { searchParams: Promise<Search> }) {
  const sp = await props.searchParams;
  const sportInfo = SPORTS.find((s) => s.slug === sp.sport);
  const win = sp.window === "3h" || sp.window === "today" ? sp.window : undefined;
  const comp = sp.comp && /^[0-9a-f-]{36}$/.test(sp.comp) ? sp.comp : undefined;
  const user = await currentUser();
  const tier = await tierFor(user);
  const [board, plans, assistant] = await Promise.all([
    sportsbookBoard(tier, { sport: sportInfo?.id, competitionId: comp, window: win }),
    q<Plan>("select * from plans where active order by level"),
    subscribeAssistantProps(user, "/"),
  ]);
  const discord = discordInviteUrl(), ig = instagramUrl();
  const from = plans[0] ? formatMoney(plans[0].amount_minor) : null;
  const compName = comp ? board.competitions.find((c) => c.id === comp)?.name : null;
  const scope = compName ?? (sportInfo ? sportInfo.name.replace("Soccer", "Football") : win === "3h" ? "Next 3 hours" : win === "today" ? "Today" : null);

  return (
    <>
      <div className="wrap book-grid pt-3 md:pt-5 pb-10">
        {/* Left: sports and popular competitions (desktop) */}
        <aside className="hidden lg:grid gap-4 content-start sticky top-[132px]" aria-label="Sports and competitions">
          <nav className="side-card" aria-label="A to Z sports">
            <h2 className="side-head">Sports</h2>
            <ul>{SPORTS.map((s) => (
              <li key={s.id}><Link href={`/?sport=${s.slug}`} aria-current={sportInfo?.id === s.id ? "page" : undefined} className="side-link"><SportIcon sport={s.id} size={16} />{s.name === "Soccer" ? "Football" : s.name}</Link></li>))}
              <li><Link href="/virtuals" className="side-link"><SportIcon sport="football" size={16} />Virtual Sports</Link></li>
            </ul>
          </nav>
          {board.competitions.length > 0 && (
            <nav className="side-card" aria-label="Popular competitions">
              <h2 className="side-head">Popular competitions</h2>
              <ul>{board.competitions.map((c) => (
                <li key={c.id}><Link href={`/?comp=${c.id}`} aria-current={comp === c.id ? "page" : undefined} className="side-link justify-between"><span className="flex items-center gap-2 min-w-0"><SportIcon sport={c.sport} size={15} /><span className="truncate">{c.name}</span></span><span className="num text-[12px] text-subtle">{c.upcoming}</span></Link></li>))}
              </ul>
            </nav>)}
        </aside>

        {/* Centre: the board */}
        <div className="grid gap-5 md:gap-6 content-start min-w-0">
          {/* Promotions */}
          <div className="promo-rail no-scrollbar" aria-label="Promotions">
            {discord && <a href={discord} target="_blank" rel="noopener noreferrer" className="promo-tile promo-discord"><span className="promo-kicker">Free community</span><span className="promo-title">Daily picks on Discord</span><span className="sr-only"> (opens in a new tab)</span></a>}
            <Link href="/packages" className="promo-tile promo-packages"><span className="promo-kicker">Premium</span><span className="promo-title">Packages{from ? ` from ${from}` : ""}</span></Link>
            <Link href="/virtuals" className="promo-tile promo-virtuals"><span className="promo-kicker">Coming soon</span><span className="promo-title">Virtual Sports</span></Link>
            {ig && <a href={ig} target="_blank" rel="noopener noreferrer" className="promo-tile promo-instagram"><span className="promo-kicker">Instagram</span><span className="promo-title">Follow {instagramHandle()}</span><span className="sr-only"> (opens in a new tab)</span></a>}
          </div>

          {/* Hero */}
          <section className="book-hero" aria-labelledby="hero-h">
            <div className="book-hero-copy">
              <p className="book-hero-kicker">Sports analysis · Daily picks · Premium packages</p>
              <h1 id="hero-h" className="book-hero-title">Smarter Insights.<br /><span className="text-red">Better Decisions.</span></h1>
              <p className="book-hero-lede">Daily picks and match previews in our Discord. Full analysis and premium selections with a BETVANTA package.</p>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <Link href="/packages" className="btn btn-accent hero-btn">View Packages</Link>
                {discord && <a href={discord} target="_blank" rel="noopener noreferrer" className="btn hero-btn hero-btn-ghost">Join Discord<span className="sr-only"> (opens in a new tab)</span></a>}
              </div>
              {!user && <p className="text-[13px] text-muted">New to BETVANTA? <Link href="/register" className="font-semibold text-white underline underline-offset-4 decoration-red">Register</Link> or <Link href="/login" className="font-semibold text-white underline underline-offset-4 decoration-red">log in</Link>.</p>}
            </div>
          </section>

          {/* Quick categories */}
          <nav className="cat-rail no-scrollbar" aria-label="Quick categories">
            <Link href="/?sport=soccer&window=today" className={`cat-tile ${sportInfo?.slug === "soccer" && win === "today" ? "is-on" : ""}`}>Today&rsquo;s<br />Football</Link>
            <Link href="/?window=3h" className={`cat-tile ${win === "3h" && !sportInfo ? "is-on" : ""}`}>Starting in<br />3 hours</Link>
            {board.competitions.slice(0, 4).map((c) => <Link key={c.id} href={`/?comp=${c.id}`} className={`cat-tile ${comp === c.id ? "is-on" : ""}`}>{c.name}</Link>)}
          </nav>

          {/* Scope and data note */}
          <div className="board-note" role="note">
            <span className="flex items-center gap-2"><span className="demo-tag">DEMO</span>{board.sample ? "Fixtures are sample data until a licensed sports data feed is connected." : "Fixtures from BETVANTA's data feed."}</span>
            <span className="text-subtle">Prices are BETVANTA model prices, not bookmaker odds. Betting is not available.</span>
          </div>
          {scope && <div className="flex items-center justify-between gap-3"><h2 className="board-h">{scope}</h2><Link href="/" className="text-[13px] font-semibold text-link hover:underline">Clear filter</Link></div>}

          <section aria-labelledby="featured-h" className="grid gap-3">
            <h2 id="featured-h" className="board-h">Featured</h2>
            <FeaturedRail matches={board.featured} />
          </section>

          <section aria-labelledby="live-h" className="live-band">
            <h2 id="live-h" className="board-h flex items-center gap-2"><span className="live-pulse" aria-hidden />Live</h2>
            <MatchList matches={board.live} live sportTabs />
          </section>

          <section aria-labelledby="upcoming-h" className="grid gap-3">
            <h2 id="upcoming-h" className="board-h">Upcoming matches</h2>
            <MatchList matches={board.upcoming} sportTabs />
          </section>

          {/* Packages */}
          <section aria-labelledby="packages-h" className="grid gap-3">
            <div className="flex items-end justify-between gap-3"><h2 id="packages-h" className="board-h">Premium packages</h2><Link href="/packages" className="text-[13px] font-semibold text-link hover:underline">Compare packages</Link></div>
            <ul className="pkg-rail no-scrollbar">
              {plans.map((p) => (
                <li key={p.id} className={`pkg-card ${p.best_value ? "is-best" : ""}`}>
                  <span className="text-[12px] font-bold uppercase tracking-[.08em] text-muted">{p.name}</span>
                  {p.best_value && <span className="pkg-best">Best value</span>}
                  <span><span className="num text-[26px] font-bold">{formatMoney(p.amount_minor)}</span> <span className="text-[12px] text-subtle">{periodLabel(p)}</span></span>
                  <a href={`/packages?subscribe=${p.code}`} data-subscribe={p.code} aria-label={`Subscribe Now to ${p.name}`} className={`btn btn-sm w-full mt-auto ${p.best_value ? "btn-accent" : "btn-secondary"}`}>Subscribe Now</a>
                </li>))}
            </ul>
          </section>
        </div>

        {/* Right: bet slip (desktop) */}
        <aside className="hidden lg:block self-stretch" aria-label="Bet slip"><DesktopSlip /></aside>
      </div>
      <SubscribeAssistant {...assistant} />
    </>
  );
}
