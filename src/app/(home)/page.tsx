import Link from "next/link";
import { currentUser } from "@/lib/session";
import { q } from "@/lib/db";
import { tierFor } from "@/lib/services/entitlements";
import { homeDashboard } from "@/lib/services/dashboard";
import { approvedTestimonials } from "@/lib/services/testimonials";
import { SPORTS } from "@/lib/services/sports";
import { MARKET_LABEL } from "@/lib/services/engine";
import { formatMoney, periodLabel, type Plan } from "@/lib/services/billing";
import { MIN_SETTLED_FOR_RATE } from "@/lib/services/stats";
import { FAQ } from "@/lib/content/faq";
import { discordInviteUrl, instagramHandle, instagramUrl } from "@/lib/env";
import { Empty, FixtureTable, FormStrip, MatchRow, PredictionTile, SectionHead, SettledLine } from "@/components/dashboard";
import { SportIcon } from "@/components/SportIcon";
import { SubscribeAssistant } from "@/components/SubscribeAssistant";
import { subscribeAssistantProps } from "@/lib/services/manual-payments/assistant";
import { RG_LINE, SampleBadge } from "@/components/ui";
export const dynamic = "force-dynamic";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
const TZ = () => process.env.APP_TIMEZONE || "America/New_York";
const longDay = (d: Date | string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: TZ() }).format(new Date(`${d}`.length === 10 ? `${d}T12:00:00Z` : d));

export default async function Home(props: { searchParams: Promise<{ sport?: string }> }) {
  const sp = await props.searchParams;
  const sportInfo = SPORTS.find((s) => s.slug === sp.sport);
  const sport = sportInfo?.id;
  const user = await currentUser();
  const tier = await tierFor(user);
  const [d, reviews, plans, assistant] = await Promise.all([
    homeDashboard(tier, sport),
    approvedTestimonials(3),
    q<Plan>("select * from plans where active order by level"),
    subscribeAssistantProps(user, "/"),
  ]);
  const r = d.record;
  const decided = r.won + r.lost;
  const tab = (slug?: string) => (slug ? `/?sport=${slug}` : "/");
  const start = user ? (user.role === "member" ? "/dashboard" : "/admin") : "/register";
  const from = plans[0] ? formatMoney(plans[0].amount_minor) : null;

  return (
    <>
      {/* Introduction: what BETVANTA is, and the record behind it, in one compact band */}
      <section className="bg-brand text-on-brand" aria-labelledby="intro-h">
        <div className="wrap py-7 md:py-9 grid gap-7 lg:grid-cols-[1.15fr_1fr] lg:items-end">
          <div className="grid gap-3 max-w-[60ch]">
            <p className="text-[12px] font-semibold uppercase tracking-[.12em] text-sand/70">{longDay(new Date())} · Eastern Time</p>
            <h1 id="intro-h" className="display font-bold text-[28px] leading-[34px] md:text-[36px] md:leading-[42px] tracking-[-.01em]">
              Match predictions and analysis, <span className="text-copper">backed by data.</span>
            </h1>
            <p className="text-[15px] leading-6 md:text-[16px] md:leading-7 text-sand/80">
              Every pick shows its probability, confidence and the form behind it. Picks lock at kickoff and are graded against the final score, so the record below is the whole record.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <Link href="/predictions" className="btn btn-accent">View Predictions</Link>
              <Link href="/pricing" className="btn btn-onbrand">Premium Picks{from ? ` from ${from}` : ""}</Link>
              {!user && <Link href={start} className="btn btn-onbrand max-sm:hidden">Get Started Now</Link>}
            </div>
          </div>

          {/* The record: database counts only. No typed-in or estimated figures. */}
          <div aria-labelledby="record-h" role="region" className="grid gap-2">
            <h2 id="record-h" className="text-[12px] font-semibold uppercase tracking-[.12em] text-sand/70">{sportInfo ? `${sportInfo.name} record` : "Our record"}</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-4 rounded-lg border border-sand/15 [&>div]:px-3 [&>div]:py-3 [&>div]:border-sand/15 sm:[&>div+div]:border-l max-sm:[&>div:nth-child(odd)]:border-r max-sm:[&>div:nth-child(-n+2)]:border-b">
              <div><dt className="text-[12px] text-sand/70">Picks graded</dt><dd className="num text-[22px] font-semibold leading-8">{fmt(r.settled)}</dd></div>
              <div><dt className="text-[12px] text-sand/70">Hit rate</dt><dd className="num text-[22px] font-semibold leading-8">{r.winRate === null ? "n/a" : `${r.winRate.toFixed(1)}%`}</dd></div>
              <div><dt className="text-[12px] text-sand/70">Matches next 7 days</dt><dd className="num text-[22px] font-semibold leading-8">{fmt(r.upcoming7d)}</dd></div>
              <div><dt className="text-[12px] text-sand/70">Leagues covered</dt><dd className="num text-[22px] font-semibold leading-8">{fmt(r.leagues)}</dd></div>
            </dl>
            <p className="text-[12px] text-sand/65 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{r.winRate === null ? `Hit rate is shown once ${MIN_SETTLED_FOR_RATE} picks are decided (${decided} so far).` : `${fmt(r.won)} won, ${fmt(r.lost)} lost, ${fmt(r.voided)} void.`} Counted from BETVANTA&apos;s records.</span>
              {d.sampleData && <span className="inline-flex"><SampleBadge /></span>}
            </p>
          </div>
        </div>
      </section>

      {/* Sport filter */}
      <div className="bg-surface border-b border-line">
        <nav aria-label="Filter by sport" className="wrap sport-tabs flex gap-1 overflow-x-auto py-2">
          {[{ slug: undefined, name: "All sports", id: "all" }, ...SPORTS].map((s) => {
            const on = (s.slug ?? null) === (sportInfo?.slug ?? null);
            return (
              <Link key={s.id} href={tab(s.slug)} aria-current={on ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${on ? "bg-brand text-on-brand" : "text-muted hover:text-ink hover:bg-sunken"}`}>
                {s.id !== "all" && <SportIcon sport={s.id} size={15} />}{s.name}
              </Link>);
          })}
        </nav>
      </div>

      {/* Dashboard */}
      <div className="wrap py-6 md:py-8 grid gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-8 grid gap-8 content-start min-w-0">
          {d.live.length > 0 && (
            <section aria-labelledby="live-h">
              <SectionHead id="live-h" title="Live now" href="/fixtures?mode=live" />
              <ul className="card overflow-hidden divide-y divide-[var(--border)]">{d.live.map((f) => <MatchRow key={f.id} f={f} showCompetition />)}</ul>
            </section>)}

          <section aria-labelledby="featured-h">
            <SectionHead id="featured-h" title="Featured predictions" meta="Upcoming matches with published picks. Premium selections stay hidden until you subscribe." href="/predictions" linkLabel="All predictions" />
            {d.featured.length ? <div className="featured-rail grid gap-3 sm:grid-cols-2">{d.featured.map((g) => <PredictionTile key={g[0].fixture_id} preds={g} />)}</div>
              : <Empty>No picks are published for {sportInfo ? sportInfo.name.toLowerCase() : "upcoming matches"} yet. {sportInfo && !sportInfo.predictions ? "Predictions currently cover soccer; schedules and results are available for every sport." : "New picks are published before each matchday."}</Empty>}
          </section>

          <section aria-labelledby="today-h">
            <SectionHead id="today-h" title={d.fixturesAreToday ? "Today's fixtures" : "Next fixtures"}
              meta={d.fixturesDay ? `${d.fixturesAreToday ? "" : "Nothing kicks off today. "}${longDay(d.fixturesDay)}, kickoff times in ET.` : undefined} href="/fixtures" linkLabel="Full schedule" />
            {d.fixtures.length ? <FixtureTable rows={d.fixtures} /> : <Empty>No upcoming fixtures are loaded yet.</Empty>}
          </section>
        </div>

        <aside className="lg:col-span-4 grid gap-8 content-start min-w-0" aria-label="Results and performance">
          <section aria-labelledby="results-h">
            <SectionHead id="results-h" title="Recent results" meta={d.results.some((f) => f.data_source === "mock") ? "Includes labelled sample data" : undefined} href="/results" />
            {d.results.length ? <ul className="card overflow-hidden divide-y divide-[var(--border)]">{d.results.slice(0, 6).map((f) => <MatchRow key={f.id} f={f} showCompetition compact />)}</ul>
              : <Empty>No finished matches yet.</Empty>}
          </section>

          <section aria-labelledby="perf-h">
            <SectionHead id="perf-h" title="Performance history" href="/performance" linkLabel="Full record" />
            <div className="card overflow-hidden">
              {d.settledPicks.length ? (<>
                <div className="px-4 pt-4 pb-3 grid gap-3 border-b border-line">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-muted">Last {d.settledPicks.length} graded picks</span>
                    <span className="num text-[13px]"><span className="text-success font-semibold">{r.won} W</span> · <span className="text-danger font-semibold">{r.lost} L</span> · <span className="text-muted">{r.voided} V</span></span>
                  </div>
                  <FormStrip picks={d.settledPicks} />
                </div>
                {d.byMarket.length > 0 && (
                  <table className="w-full text-[13px]">
                    <caption className="sr-only">Graded picks by market</caption>
                    <thead><tr className="text-left text-[11px] uppercase tracking-[.06em] text-muted"><th className="px-4 py-2 font-semibold">Market</th><th className="px-2 py-2 font-semibold text-right">Won</th><th className="px-2 py-2 font-semibold text-right">Lost</th><th className="px-4 py-2 font-semibold text-right">Rate</th></tr></thead>
                    <tbody className="divide-y divide-[var(--border)] border-t border-line">{d.byMarket.map((m) => {
                      const n = m.won + m.lost;
                      return <tr key={m.market}><th scope="row" className="px-4 py-2 text-left font-medium">{MARKET_LABEL[m.market] ?? m.market}</th><td className="num px-2 py-2 text-right">{m.won}</td><td className="num px-2 py-2 text-right">{m.lost}</td>
                        <td className="num px-4 py-2 text-right text-muted">{n >= MIN_SETTLED_FOR_RATE ? `${((m.won / n) * 100).toFixed(0)}%` : "n/a"}</td></tr>;
                    })}</tbody>
                  </table>)}
                <ul className="divide-y divide-[var(--border)] border-t border-line">{d.settledPicks.slice(0, 3).map((p) => <SettledLine key={p.id} p={p} />)}</ul>
              </>) : <p className="px-4 py-6 text-sm text-muted text-center">No picks have been graded yet. The record starts with the first settled match.</p>}
            </div>
          </section>

          <section aria-labelledby="premium-h" className="rounded-lg border border-line bg-teal-subtle p-5 grid gap-3">
            <h2 id="premium-h" className="display font-bold text-[18px] leading-6">Premium Picks</h2>
            <ul className="grid gap-1.5 text-[14px]">
              {["Every premium selection and its probability", "Full written analysis for each match", "VIP picks and member roles in Discord from 6 months"].map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="text-link">&#10003;</span>{t}</li>)}
            </ul>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {plans[0] && <a href={`/pricing?subscribe=${plans[0].code}`} data-subscribe={plans[0].code} className="btn btn-primary">Subscribe Now</a>}
              <Link href="/pricing" className="text-[13px] font-semibold text-link hover:underline">Compare all plans</Link>
            </div>
            {from && <p className="text-[12px] text-muted">From {from} {plans[0] ? periodLabel(plans[0]) : ""}. One-time payment, no automatic renewal.</p>}
          </section>
        </aside>
      </div>

      {/* Plans: compact, every plan one tap from the payment assistant */}
      <section aria-labelledby="plans-h" className="border-t border-line bg-surface">
        <div className="wrap py-8 md:py-10">
          <SectionHead id="plans-h" title="Plans" meta="Prices in US dollars. Every plan includes everything in the one before it." href="/pricing" linkLabel="Compare features" />
          <ul className="grid gap-px rounded-lg overflow-hidden border border-line bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-5">
            {plans.map((p) => (
              <li key={p.id} className="bg-surface p-4 grid gap-3 content-between">
                <div className="grid gap-0.5">
                  <span className="flex items-center gap-2 text-[13px] font-semibold">{p.name}{p.best_value && <span className="rounded-sm bg-accent-subtle text-accent-text px-1.5 py-0.5 text-[11px]">Best value</span>}</span>
                  <span><span className="num text-[22px] font-semibold">{formatMoney(p.amount_minor)}</span> <span className="text-[12px] text-subtle">{periodLabel(p)}</span></span>
                </div>
                <a href={`/pricing?subscribe=${p.code}`} data-subscribe={p.code} aria-label={`Subscribe Now to ${p.name}`} className={`btn btn-sm w-full ${p.best_value ? "btn-accent" : "btn-secondary"}`}>Subscribe Now</a>
              </li>))}
          </ul>
        </div>
      </section>

      {/* How it works, reviews and questions */}
      <section className="wrap py-8 md:py-10 grid gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-5 grid gap-4 content-start" aria-labelledby="how-h">
          <h2 id="how-h" className="display font-bold text-[18px] leading-6 md:text-[20px] md:leading-7">How it works</h2>
          <ol className="grid gap-4">
            {[
              ["Create a free account", "Free members see free picks, every fixture and the full results record.", start, user ? "Open your dashboard" : "Get Started Now"],
              ["Explore predictions", "Each pick shows the market, our probability, a confidence band and the form behind it.", "/predictions", "View Predictions"],
              ["Subscribe for Premium Picks", "Unlock every premium selection and analysis. Pay by card, crypto or with help from our team.", "/pricing", "Premium Picks"],
            ].map(([t, body, href, cta], i) => (
              <li key={t} className="grid grid-cols-[28px_1fr] gap-3">
                <span aria-hidden className="num h-7 w-7 rounded-full border border-line-strong grid place-items-center text-[13px] font-semibold">{i + 1}</span>
                <span className="grid gap-0.5"><span className="font-semibold">{t}</span><span className="text-[14px] text-muted">{body}</span>
                  <Link href={href} className="text-[13px] font-semibold text-link hover:underline w-fit">{cta}<span aria-hidden> &rsaquo;</span></Link></span>
              </li>))}
          </ol>
        </div>
        <div className="lg:col-span-7 grid gap-8 content-start">
          <section aria-labelledby="reviews-h">
            <SectionHead id="reviews-h" title="What members say" href={user ? "/dashboard/feedback" : "/register?next=/dashboard/feedback"} linkLabel="Share your feedback" />
            {reviews.length ? <div className="grid gap-3 md:grid-cols-3">{reviews.map((rv) => (
              <figure key={rv.id} className="card p-4 grid gap-2 content-start">
                <span className="num text-[12px] text-accent-text" aria-label={`${rv.rating} out of 5`}>{"★".repeat(rv.rating)}{"☆".repeat(5 - rv.rating)}</span>
                <blockquote className="text-[14px] leading-6">&ldquo;{rv.body}&rdquo;</blockquote>
                <figcaption className="text-[12px] text-muted">{rv.display_name}{rv.location ? `, ${rv.location}` : ""}{rv.verified_subscriber ? " · Verified subscriber" : ""}</figcaption>
              </figure>))}</div>
              : <Empty>Reviews from verified members will appear here. We only publish reviews members have agreed to share.</Empty>}
          </section>
          <section aria-labelledby="faq-h">
            <SectionHead id="faq-h" title="Questions" href="/faq" linkLabel="All questions" />
            <div className="card divide-y divide-[var(--border)]">{FAQ.filter(([qq]) => ["How are predictions made?", "Can a prediction change after kickoff?", "When does my access start?", "Is BETVANTA a bookmaker?"].includes(qq)).map(([qq, a]) => (
              <details key={qq} className="px-4 py-3 group"><summary className="font-semibold text-[14px] cursor-pointer">{qq}</summary><p className="mt-2 text-[14px] text-muted">{a}</p></details>))}</div>
          </section>
        </div>
      </section>

      {/* Community */}
      <section className="border-t border-line bg-surface" aria-labelledby="community-h">
        <div className="wrap py-6 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="grid gap-0.5"><h2 id="community-h" className="font-semibold">Join the BETVANTA community</h2><p className="text-[14px] text-muted">Pick announcements and match discussion on Discord; match-day updates on Instagram.</p></div>
          <div className="flex flex-wrap gap-2">
            {discordInviteUrl() && <a href={discordInviteUrl()!} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">Join Discord<span className="sr-only"> (opens in a new tab)</span></a>}
            {instagramUrl() && <a href={instagramUrl()!} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Instagram {instagramHandle()}<span className="sr-only"> (opens in a new tab)</span></a>}
          </div>
        </div>
        <p className="wrap pb-5 text-[12px] text-subtle">BETVANTA publishes analysis only. We do not take bets or hold funds, and we do not show betting odds. {RG_LINE}</p>
      </section>

      <SubscribeAssistant {...assistant} />
    </>
  );
}
