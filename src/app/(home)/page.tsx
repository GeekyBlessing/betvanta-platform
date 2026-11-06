import Link from "next/link";
import { currentUser } from "@/lib/session";
import { q } from "@/lib/db";
import { tierFor } from "@/lib/services/entitlements";
import { listPredictions } from "@/lib/services/predictions";
import { publicHomepageStats, type PublicStat, type StatIcon } from "@/lib/services/homepage-stats";
import { approvedTestimonials } from "@/lib/services/testimonials";
import { listFixtures } from "@/lib/services/sports";
import { formatMoney, periodLabel, type Plan } from "@/lib/services/billing";
import { cardFeatures } from "@/lib/services/plans";
import { FAQ } from "@/lib/content/faq";
import { FixtureList } from "@/components/FixtureList";
import { SPORTS } from "@/lib/services/sports";
import { FixtureCard, groupByFixture } from "@/components/PredictionCard";
import { JoinDiscordButton } from "@/components/Discord";
import { SportIcon } from "@/components/SportIcon";
import { Confidence, Notice, RG_LINE } from "@/components/ui";
export const dynamic = "force-dynamic";


function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <svg key={i} width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.5 5.2 5.7.8-4.1 4 1 5.7L10 14.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill={i <= n ? "#C47C52" : "none"} stroke="#C47C52" strokeWidth="1.2" /></svg>)}
    </span>
  );
}

const ic = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function StatGlyph({ icon }: { icon: StatIcon }) {
  switch (icon) {
    case "members": return <svg {...ic}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.4.1 4 1.7 4.5 4.3" /></svg>;
    case "target": return <svg {...ic}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>;
    case "trophy": return <svg {...ic}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4M12 13v4M8.5 20h7M9.5 17h5" /></svg>;
    case "sports": return <svg {...ic}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5l3.4 2.5-1.3 4h-4.2l-1.3-4zM12 3.5v4M15.4 10l4.4-1.6M14.1 14l2.6 4M9.9 14l-2.6 4M8.6 10L4.2 8.4" /></svg>;
  }
}
function StatTile({ s, i }: { s: PublicStat; i: number }) {
  return (
    <div className="stat-tile hero-in px-3 py-5 sm:px-5 sm:py-6 grid justify-items-center text-center gap-2 content-start" style={{ animationDelay: `${360 + i * 80}ms` }}>
      <span className="stat-icon h-11 w-11 rounded-full grid place-items-center"><StatGlyph icon={s.icon} /></span>
      <span className="display font-bold tabular-nums text-[30px] leading-9 sm:text-[36px] sm:leading-[42px] lg:text-[42px] lg:leading-[48px] tracking-tight text-[#F4EEE5]">{s.value}</span>
      <span className="text-[13px] sm:text-[14px] font-medium text-sand/80 leading-5">{s.label}</span>
      {s.status !== "client" && <span className="text-[10px] font-semibold uppercase tracking-[.08em]" style={{ color: s.status === "verified" ? "#74C394" : "#7DB8AE" }}>{s.status === "verified" ? "Verified" : "Live record"}</span>}
    </div>
  );
}

const fi = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const FEATURES = [
  { title: "Expert predictions", href: "/predictions", cta: "View predictions", body: "Match result, both teams to score and goals picks, each with a probability and a confidence band, locked at kickoff.",
    icon: <svg {...fi}><path d="M4 15l5-5 4 4 7-7M14 7h6v6" /></svg> },
  { title: "Match analysis", href: "/fixtures", cta: "See upcoming matches", body: "Form, home and away scoring, head-to-head context and the limits of the data on every match page.",
    icon: <svg {...fi}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2M8.5 11h5M11 8.5v5" /></svg> },
  { title: "Stats and standings", href: "/sports", cta: "Browse sports", body: "League tables, team records, fixtures and results for soccer, American football, basketball and baseball.",
    icon: <svg {...fi}><path d="M5 20V11M10 20V5M15 20v-7M20 20V8" /></svg> },
  { title: "Premium insights", href: "/pricing", cta: "Get Premium Picks", body: "Every premium pick, full written analysis, VIP selections and member roles in the BETVANTA Discord.",
    icon: <svg {...fi}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg> },
];

export default async function Home() {
  const user = await currentUser();
  const tier = await tierFor(user);
  const [upcoming, { stats: heroStats, live: stats }, reviews, coverage, nextFixtures, plans] = await Promise.all([
    listPredictions(tier, { upcoming: true, limit: 12 }),
    publicHomepageStats(),
    approvedTestimonials(6),
    q<{ sport: string; upcoming: number; leagues: number }>(
      `select c.sport, count(distinct c.id)::int leagues, count(f.id) filter (where f.status = 'scheduled' and f.kickoff_at > now())::int upcoming
       from competitions c left join fixtures f on f.competition_id = c.id where c.active group by c.sport`),
    listFixtures({ mode: "upcoming", limit: 6 }),
    q<Plan>("select * from plans where active order by level"),
  ]);
  const start = user ? (user.role === "member" ? "/dashboard" : "/admin") : "/register";
  const planHref = (p: Plan) => (user ? `/checkout/${p.code}` : `/register?next=/checkout/${p.code}`);
  const fixtures = groupByFixture(upcoming).slice(0, 4);
  const cov = (id: string) => coverage.find((c) => c.sport === id);

  return (
    <>
      {/* Hero: full-width stadium artwork, dark overlay, centred message, glass statistics panel */}
      <section className="hero relative isolate overflow-hidden" aria-labelledby="hero-h">
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/hero/stadium-tall.webp" type="image/webp" />
          <img src="/images/hero/stadium-wide.webp" alt="" fetchPriority="high" decoding="async" className="hero-media absolute inset-0 -z-20 h-full w-full object-cover object-[50%_35%] max-md:object-top" />
        </picture>
        <div aria-hidden className="hero-scrim absolute inset-0 -z-10" />
        <div aria-hidden className="hero-glow absolute inset-0 -z-10" />
        <div className="wrap pt-[92px] md:pt-[112px] pb-10 md:pb-14 grid justify-items-center text-center gap-4 md:gap-5">
          <span className="hero-in inline-flex items-center gap-2 rounded-full border border-sand/20 bg-white/5 px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold tracking-[.12em] uppercase text-sand/85 display" style={{ animationDelay: "40ms" }}>
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-copper" />Sports intelligence<span className="hidden sm:inline"> and predictions</span>
          </span>
          <h1 id="hero-h" className="hero-in display font-bold text-[32px] leading-[36px] sm:text-[48px] sm:leading-[52px] lg:text-[60px] lg:leading-[64px] tracking-[-.01em] text-[#F4EEE5] max-w-[22ch]" style={{ animationDelay: "100ms" }}>
            Smarter sports insights. <span className="text-copper">Sharper predictions.</span>
          </h1>
          <p className="hero-in text-[15px] leading-6 sm:text-[17px] sm:leading-7 md:text-[19px] md:leading-8 max-w-[60ch] text-sand/85" style={{ animationDelay: "170ms" }}>
            Expert picks and AI-assisted match analysis<span className="hidden sm:inline"> for soccer, American football, basketball and baseball</span>, with the probability and confidence behind every prediction.
          </p>
          <div className="hero-in grid grid-cols-2 sm:flex gap-2.5 sm:gap-3 w-full sm:w-auto pt-1" style={{ animationDelay: "240ms" }}>
            <Link href="/pricing" className="btn btn-accent sm:btn-lg hero-cta w-full sm:w-auto shadow-[0_10px_30px_-10px_rgba(196,124,82,.7)]">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4M12 13v4M8.5 20h7" /></svg>
              Get Premium Picks
            </Link>
            <JoinDiscordButton label="Join Discord" className="btn sm:btn-lg hero-cta btn-onbrand w-full sm:w-auto bg-white/5 backdrop-blur-sm" />
          </div>
          <p className="hero-in text-[13px] sm:text-sm text-sand/80" style={{ animationDelay: "280ms" }}>
            New here? <Link href={start} className="font-semibold text-sand underline underline-offset-4 decoration-copper hover:decoration-2">{user ? "Open your dashboard" : "Create a free account"}</Link><span className="hidden sm:inline"> and get free picks today</span>.
          </p>

          {/* Statistics panel: figures from Admin > Homepage (client-provided unless marked verified or live) */}
          <div className="w-full max-w-[880px] grid gap-2.5 pt-2 md:pt-4">
            <h2 className="sr-only">BETVANTA in numbers</h2>
            <div className="glass hero-in overflow-hidden grid grid-cols-2 sm:grid-cols-4 [&>*]:border-sand/10 [&>*:nth-child(2n)]:border-l [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-t-0 sm:[&>*:nth-child(n+2)]:border-l" style={{ animationDelay: "320ms" }}>
              {heroStats.map((s, i) => <StatTile key={s.key} s={s} i={i} />)}
            </div>
            <p className="text-[11px] sm:text-xs text-sand/65 max-w-[80ch] mx-auto">
              {heroStats.some((x) => x.status === "client") && "Figures provided by BETVANTA; not independently verified. "}Past results do not guarantee future outcomes. {RG_LINE}{" "}
              <Link href="/performance" className="font-semibold text-sand/85 underline underline-offset-2">See our graded record</Link>
            </p>
          </div>
        </div>
      </section>

      {/* What BETVANTA offers: sports and features, visible straight after the hero */}
      <section id="platform" aria-labelledby="platform-h" className="wrap py-12 md:py-16 grid gap-8">
        <div className="grid gap-3 justify-items-center text-center">
          <span className="eyebrow">The platform</span>
          <h2 id="platform-h" className="display font-bold text-[28px] leading-[34px] md:text-[40px] md:leading-[46px] tracking-[-.01em] max-w-[22ch]">Your Smarter Sports Intelligence Platform</h2>
          <p className="text-[16px] leading-7 text-muted max-w-[62ch]">Predictions, match analysis, statistics and premium insights in one place. Start free, then unlock every premium pick when you want more depth.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {SPORTS.map((s) => {
            const c = cov(s.id);
            return (
              <Link key={s.id} href={`/sports/${s.slug}`} className="group card p-4 md:p-5 flex items-center gap-3 md:gap-4 transition-colors hover:border-[var(--accent)] focus-visible:border-[var(--accent)]">
                <span className="h-12 w-12 md:h-14 md:w-14 shrink-0 rounded-full bg-teal-subtle text-link grid place-items-center group-hover:bg-brand group-hover:text-[#EAE1D4] transition-colors"><SportIcon sport={s.id} size={26} /></span>
                <span className="grid min-w-0"><span className="font-semibold text-[15px] md:text-[16px] leading-6">{s.name}</span><span className="text-xs text-subtle">{c ? `${c.upcoming} upcoming games` : "Feed coming soon"}{s.predictions ? " · picks" : ""}</span></span>
              </Link>);
          })}
        </div>
        <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Link key={f.title} href={f.href} className="feature-card group card p-5 md:p-6 grid gap-3 content-start">
              <span className="h-11 w-11 rounded-lg bg-accent-subtle text-accent-text grid place-items-center">{f.icon}</span>
              <h3 className="display font-bold text-[18px] leading-6">{f.title}</h3>
              <p className="text-sm text-muted">{f.body}</p>
              <span className="text-sm font-semibold text-link mt-1">{f.cta} <span aria-hidden>&rarr;</span></span>
            </Link>))}
        </div>
        <div className="rounded-xl bg-brand text-on-brand on-dark px-5 py-5 md:px-8 md:py-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          <div className="grid gap-1 flex-1"><p className="display font-bold text-[20px] leading-7">Get started in under a minute</p><p className="text-sm text-sand/80">Create a free account for free picks and the full results record. Upgrade to Premium whenever you are ready.</p></div>
          <div className="flex flex-col sm:flex-row gap-3"><Link href={start} className="btn btn-accent">{user ? "Open your dashboard" : "Get Started Now"}</Link><Link href="/predictions" className="btn btn-onbrand">View Predictions</Link></div>
        </div>
      </section>

      {/* Upcoming fixtures */}
      <section aria-labelledby="fixtures-h" className="wrap pb-12 md:pb-16 grid gap-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="grid gap-2"><span className="eyebrow">Fixtures</span><h2 id="fixtures-h" className="display font-bold text-[26px] leading-8 md:text-[32px] md:leading-[38px]">Upcoming matches</h2>
            <p className="text-muted max-w-[60ch]">Kickoff times in US Eastern. Open a match for form, scoring records, head-to-head and our picks.</p></div>
          <Link href="/fixtures" className="text-sm font-semibold text-link hover:underline">All fixtures and scores</Link>
        </div>
        {nextFixtures.length ? <FixtureList rows={nextFixtures} /> : <Notice tone="info">No upcoming fixtures are loaded yet. Results and schedules appear here once the data feed syncs.</Notice>}
      </section>

      {/* Featured fixtures */}
      <section className="bg-surface border-y border-line">
        <div className="wrap py-12 md:py-16 grid gap-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="grid gap-2"><span className="eyebrow">Predictions</span><h2 className="display text-[26px] leading-8 md:text-[32px] md:leading-[38px] font-bold">Predictions and match analysis</h2></div>
            <Link href="/predictions" className="btn btn-primary btn-sm">View Predictions</Link>
          </div>
          {fixtures.length ? <div className="grid gap-4 md:grid-cols-2">{fixtures.map((g) => <FixtureCard key={g[0].fixture_id} preds={g} />)}</div>
            : <Notice tone="info">No predictions are published yet. Check back before the next matchday.</Notice>}
        </div>
      </section>

      {/* Premium picks and plans */}
      <section aria-labelledby="plans-h" className="bg-brand text-on-brand on-dark">
        <div className="wrap py-12 md:py-16 grid gap-8">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="grid gap-2 max-w-[62ch]"><span className="eyebrow" style={{ color: "#C47C52" }}>Premium Picks</span>
              <h2 id="plans-h" className="display font-bold text-[26px] leading-8 md:text-[32px] md:leading-[38px]">Choose how long you want full access</h2>
              <p className="text-sand/80">Every premium pick, full written analysis and member tools. One-time payments in US dollars, no automatic renewal.</p></div>
            <Link href="/pricing" className="btn btn-secondary">Compare all features</Link>
          </div>
          {plans.length ? <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {plans.map((p) => (
              <li key={p.id} className={`relative rounded-xl p-5 grid gap-4 content-between ${p.best_value ? "bg-[#F4EEE5] text-charcoal" : "bg-white/[.06] border border-sand/15"}`}>
                {p.best_value && <span className="absolute -top-3 left-5 rounded-full bg-copper text-charcoal text-xs font-semibold px-3 py-1">Best value</span>}
                <div className="grid gap-1">
                  <h3 className="display text-[13px] font-bold tracking-[.12em] uppercase">{p.name}</h3>
                  <p className="flex items-baseline gap-1.5"><span className="display num text-[30px] leading-9 font-bold">{formatMoney(p.amount_minor)}</span><span className={`text-xs ${p.best_value ? "text-[#4F5E5B]" : "text-sand/70"}`}>{periodLabel(p)}</span></p>
                </div>
                <ul className={`grid gap-1.5 text-[13px] ${p.best_value ? "text-[#2c3a38]" : "text-sand/85"}`}>{cardFeatures(p.level).slice(0, 3).map((f) => <li key={f} className="flex gap-2"><span aria-hidden className="text-copper">&#10003;</span>{f}</li>)}</ul>
                <Link href={planHref(p)} className={`btn w-full ${p.best_value ? "btn-accent" : "btn-onbrand"}`}>Choose {p.name.replace(/ Premium$/, "")}</Link>
              </li>))}
          </ul> : <Notice tone="info">Plans are being updated. See the pricing page for details.</Notice>}
          <p className="text-xs text-sand/70">Pay by card, crypto, or with help from our team in Discord. Access starts once the payment is verified. {RG_LINE}</p>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-h" className="wrap py-12 md:py-16 grid gap-8">
        <div className="grid gap-2 max-w-[60ch]"><span className="eyebrow">How it works</span><h2 id="how-h" className="display font-bold text-[26px] leading-8 md:text-[32px] md:leading-[38px]">From sign-up to sharper picks in three steps</h2></div>
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            { n: "1", t: "Create your free account", d: "Register with your email, confirm you are 18 or older and verify your address. Free members see free picks and the full results record.", href: start, cta: user ? "Open your dashboard" : "Get Started Now" },
            { n: "2", t: "Explore predictions", d: "Browse upcoming matches with the probability and confidence behind every pick, plus form, tables and head-to-head data.", href: "/predictions", cta: "View Predictions" },
            { n: "3", t: "Subscribe for Premium Picks", d: "Pick a plan to unlock every premium selection, full analysis and member roles in Discord. No automatic renewal.", href: "/pricing", cta: "Premium Picks" },
          ].map((s) => (
            <li key={s.n} className="card p-6 grid gap-4 content-between">
              <div className="grid gap-3">
                <span aria-hidden className="h-10 w-10 rounded-full bg-brand text-sand grid place-items-center display font-bold">{s.n}</span>
                <h3 className="display font-bold text-[19px] leading-7">{s.t}</h3>
                <p className="text-sm text-muted">{s.d}</p>
              </div>
              <Link href={s.href} className="text-sm font-semibold text-link hover:underline">{s.cta} <span aria-hidden>&rarr;</span></Link>
            </li>))}
        </ol>
      </section>

      {/* Member dashboard preview */}
      <section aria-labelledby="dash-h" className="bg-surface border-y border-line">
        <div className="wrap py-12 md:py-16 grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5 grid gap-4 content-start">
            <span className="eyebrow">Member dashboard</span>
            <h2 id="dash-h" className="display font-bold text-[26px] leading-8 md:text-[32px] md:leading-[38px]">Everything you follow, in one place</h2>
            <p className="text-muted">Your picks for the day, your plan and renewal date, saved leagues, settled results and billing, on desktop and phone.</p>
            <ul className="grid gap-2 text-sm">{["Today's picks with probability and confidence", "Saved leagues and their upcoming matches", "Your pick history, graded against final scores", "Plan status, receipts and payment verification"].map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="text-[var(--accent-text)]">&#10003;</span>{t}</li>)}</ul>
            <div className="flex flex-wrap gap-3 pt-1"><Link href={user ? "/dashboard" : "/register?next=/dashboard"} className="btn btn-primary">{user ? "Open your dashboard" : "Create a free account"}</Link></div>
          </div>
          <figure className="lg:col-span-7 grid gap-2">
            <div aria-hidden className="rounded-xl border border-line bg-bg shadow-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-surface"><span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-grid)]" /><span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-grid)]" /><span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-grid)]" /><span className="ml-3 text-xs text-subtle">betvanta / dashboard</span></div>
              <div className="grid sm:grid-cols-[160px_1fr]">
                <div className="hidden sm:grid content-start gap-1 p-3 border-r border-line bg-surface text-sm">{["Overview", "Predictions", "History", "Billing", "Settings"].map((t, i) => <span key={t} className={`rounded-md px-3 py-2 ${i === 0 ? "bg-teal-subtle text-link font-semibold" : "text-muted"}`}>{t}</span>)}</div>
                <div className="p-4 grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">Good evening, Alex</span><span className="rounded-sm bg-accent-subtle text-accent-text px-2 py-0.5 text-xs font-semibold">Premium · active</span></div>
                  <div className="grid gap-2">
                    {[["Harbor City FC", "Summit United", "Home win", "58%", "medium"], ["Granite Bay SC", "Prairie Wolves", "Both teams score", "64%", "medium"], ["Riverside Rovers", "Northgate Athletic", "Over 2.5 goals", "71%", "high"]].map(([h, a, pick, pr, c]) => (
                      <div key={h} className="card p-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-center">
                        <span className="text-sm font-medium truncate">{h} <span className="text-subtle">v</span> {a}</span><span className="num text-sm font-semibold">{pr}</span>
                        <span className="text-xs text-muted">Pick: {pick}</span><Confidence band={c} />
                      </div>))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">{[["Saved leagues", "3"], ["Picks this week", "12"], ["Access until", "Dec 6"]].map(([l, v]) => <div key={l} className="rounded-md bg-sunken p-2 grid"><span className="num font-semibold">{v}</span><span className="text-[11px] text-muted">{l}</span></div>)}</div>
                </div>
              </div>
            </div>
            <figcaption className="text-xs text-subtle">Preview with example teams and data. Your dashboard shows your own picks and plan.</figcaption>
          </figure>
        </div>
      </section>

      {/* Testimonials */}
      <section aria-labelledby="reviews-h" className="bg-sunken">
        <div className="wrap py-12 md:py-16 grid gap-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="grid gap-2"><span className="eyebrow">Members</span><h2 id="reviews-h" className="display text-[26px] leading-8 md:text-[32px] md:leading-[38px] font-bold">What members say</h2></div>
            <Link href={user ? "/dashboard/feedback" : "/register?next=/dashboard/feedback"} className="text-sm font-semibold text-link hover:underline">Share your feedback</Link>
          </div>
          {reviews.length ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <figure key={r.id} className="card p-6 grid gap-4 content-start">
                  <Stars n={r.rating} />
                  <blockquote className="text-[16px] leading-7">&ldquo;{r.body}&rdquo;</blockquote>
                  <figcaption className="flex items-center gap-3 mt-auto">
                    <span aria-hidden className="h-9 w-9 rounded-full bg-brand text-[#EAE1D4] grid place-items-center display font-bold text-sm">{r.display_name.slice(0, 1).toUpperCase()}</span>
                    <span className="grid"><span className="font-semibold text-sm">{r.display_name}</span><span className="text-xs text-subtle">{[r.location, r.verified_subscriber ? "Verified subscriber" : "Member"].filter(Boolean).join(" · ")}</span></span>
                  </figcaption>
                </figure>))}
            </div>
          ) : (
            <div className="card p-8 grid gap-3 justify-items-start max-w-[640px]">
              <p className="font-semibold text-[17px]">Reviews from verified members will appear here.</p>
              <p className="text-sm text-muted">We only publish reviews from real BETVANTA members who have agreed to be quoted, and every review is checked before it goes live.</p>
              <Link href={user ? "/dashboard/feedback" : "/register?next=/dashboard/feedback"} className="btn btn-secondary">Leave a review</Link>
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-h" className="wrap py-12 md:py-16 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 grid gap-3 content-start"><span className="eyebrow">FAQ</span><h2 id="faq-h" className="display font-bold text-[26px] leading-8 md:text-[32px] md:leading-[38px]">Questions, answered</h2>
          <p className="text-muted">Still unsure? <Link href="/contact" className="text-link font-semibold hover:underline">Contact us</Link> or read the <Link href="/faq" className="text-link font-semibold hover:underline">full FAQ</Link>.</p></div>
        <div className="lg:col-span-8 grid gap-3">{FAQ.filter(([q]) => ["How are predictions made?", "Can a prediction change after kickoff?", "Do plans renew automatically?", "When does my access start?", "Is BETVANTA a bookmaker?"].includes(q)).map(([q, a]) => (
          <details key={q} className="card px-5 py-4 group"><summary className="font-semibold cursor-pointer">{q}</summary><p className="mt-2 text-muted">{a}</p></details>))}</div>
      </section>

      {/* Community */}
      <section className="wrap py-12 md:py-16">
        <div className="rounded-xl bg-brand text-on-brand p-8 md:p-12 grid gap-6 md:grid-cols-[1.4fr_auto] md:items-center">
          <div className="grid gap-3">
            <span className="eyebrow" style={{ color: "#C47C52" }}>Community</span>
            <h2 className="display text-[26px] leading-8 md:text-[32px] md:leading-[38px] font-bold">Talk the game with other members</h2>
            <p className="opacity-90 max-w-[56ch]">Join the BETVANTA Discord for pick announcements, match discussion and live sessions. Premium and VIP members get their role automatically when they link their account.</p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3">
            <JoinDiscordButton className="btn btn-accent btn-lg" />
            <Link href="/community" className="btn btn-lg btn-onbrand">How it works</Link>
          </div>
        </div>
      </section>
    </>
  );
}
