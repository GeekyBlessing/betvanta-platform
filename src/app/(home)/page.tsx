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
import { Confidence, Notice, RG_LINE, SampleBadge } from "@/components/ui";
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
const STATUS: Record<PublicStat["status"], { text: string; color: string }> = {
  verified: { text: "Verified", color: "#74C394" }, live: { text: "Live record", color: "#7DB8AE" },
};
function StatTile({ s, i }: { s: PublicStat; i: number }) {
  const st = STATUS[s.status];
  return (
    <div className="stat-tile hero-in p-5 md:p-7 grid gap-3 content-start" style={{ animationDelay: `${420 + i * 90}ms` }}>
      <span className="stat-icon h-11 w-11 rounded-full grid place-items-center"><StatGlyph icon={s.icon} /></span>
      <div className="grid gap-1">
        <span className="display font-bold tabular-nums text-[32px] leading-9 sm:text-[38px] sm:leading-[44px] lg:text-[44px] lg:leading-[50px] tracking-tight text-[#F4EEE5]">{s.value}</span>
        <span className="text-[14px] font-medium text-sand/80">{s.label}</span>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em]" style={{ color: st.color }}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />{st.text}{s.note ? <span className="normal-case tracking-normal font-normal text-sand/60">&nbsp;· {s.note}</span> : null}
      </span>
    </div>
  );
}

const FEATURES = [
  { n: "01", title: "Predictions", href: "/predictions", cta: "Explore predictions", body: "Every pick carries a probability and a confidence band, and is locked at kickoff so the record cannot be edited afterwards.", visual: "prob" },
  { n: "02", title: "Match analysis", href: "/fixtures", cta: "See matches", body: "Form, home and away scoring, head-to-head context, and the limits of the data stated plainly on each match page.", visual: "form" },
  { n: "03", title: "Statistics", href: "/sports", cta: "Browse sports", body: "League tables, team records, fixtures and results across soccer, American football, basketball and baseball.", visual: "bars" },
  { n: "04", title: "Premium insights", href: "/pricing", cta: "Compare plans", body: "Full written analysis, VIP picks and member roles in the BETVANTA Discord with Premium and VIP plans.", visual: "lock" },
] as const;
function FeatureVisual({ kind }: { kind: (typeof FEATURES)[number]["visual"] }) {
  const tag = <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-subtle">Example</span>;
  if (kind === "prob") return (
    <div className="grid gap-2">{tag}<div className="flex items-center gap-3"><div className="h-2 flex-1 rounded-full bg-sunken overflow-hidden"><div className="h-full rounded-full bg-[var(--link)]" style={{ width: "62%" }} /></div><span className="num text-sm font-semibold">62%</span></div><Confidence band="medium" /></div>);
  if (kind === "form") return (
    <div className="grid gap-2">{tag}<div className="flex gap-1.5">{["W", "D", "W", "L", "W"].map((r, i) => <span key={i} className={`num h-8 w-8 rounded-md grid place-items-center text-xs font-bold ${r === "W" ? "bg-success-subtle text-success" : r === "L" ? "bg-danger-subtle text-danger" : "bg-sunken text-muted"}`}>{r}</span>)}</div></div>);
  if (kind === "bars") return (
    <div className="grid gap-2">{tag}<div className="flex items-end gap-1.5 h-10">{[40, 62, 48, 86, 55, 70].map((h, i) => <span key={i} className="w-4 rounded-t-[3px]" style={{ height: `${h}%`, background: i === 3 ? "var(--accent)" : "var(--link)", opacity: i === 3 ? 1 : 0.75 }} />)}</div></div>);
  return (
    <div className="grid gap-2">{tag}<div className="flex items-center gap-3"><span className="h-8 w-8 rounded-md bg-accent-subtle text-accent-text grid place-items-center"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg></span><div className="grid gap-1.5 flex-1"><span className="h-2 rounded-full bg-sunken w-full" /><span className="h-2 rounded-full bg-sunken w-3/4" /></div></div></div>);
}

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
      {/* Hero: stadium artwork under a dark scrim, overlay header from the (home) layout */}
      <section className="hero relative isolate overflow-hidden" aria-labelledby="hero-h">
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/hero/stadium-tall.webp" type="image/webp" />
          <img src="/images/hero/stadium-wide.webp" alt="" fetchPriority="high" decoding="async" className="hero-media absolute inset-0 -z-20 h-full w-full object-cover object-[50%_40%] max-md:object-top" />
        </picture>
        <div aria-hidden className="hero-scrim absolute inset-0 -z-10" />
        <div aria-hidden className="hero-glow absolute inset-0 -z-10" />
        <div className="wrap pt-[148px] md:pt-[136px] pb-10 md:pb-14 grid gap-10 md:gap-14">
          <div className="grid gap-6 max-w-[720px]">
            <span className="hero-in inline-flex w-fit items-center gap-2 rounded-full border border-sand/20 bg-white/5 px-3 py-1.5 text-[12px] font-semibold tracking-[.12em] uppercase text-sand/85 display" style={{ animationDelay: "60ms" }}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-copper" />Sports intelligence
            </span>
            <h1 id="hero-h" className="hero-in display font-bold text-[40px] leading-[44px] sm:text-[52px] sm:leading-[56px] lg:text-[64px] lg:leading-[68px] tracking-[-.01em] text-[#F4EEE5]" style={{ animationDelay: "120ms" }}>
              Sharper reads on every <span className="text-copper">matchup.</span>
            </h1>
            <p className="hero-in text-[17px] leading-7 md:text-[19px] md:leading-8 max-w-[56ch] text-sand/85" style={{ animationDelay: "200ms" }}>
              <strong className="font-semibold text-sand">Smarter Insights. Better Decisions.</strong> Expert predictions and AI-assisted analysis of form, scoring and head-to-head data, with the probability, confidence and data limits behind every pick.
            </p>
            <div className="hero-in flex flex-col sm:flex-row gap-3 pt-1" style={{ animationDelay: "280ms" }}>
              <Link href={start} className="btn btn-accent btn-lg w-full sm:w-auto">{user ? "Open your dashboard" : "Get Started Now"}</Link>
              <Link href="/predictions" className="btn btn-lg btn-onbrand w-full sm:w-auto backdrop-blur-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14l5-5 4 4 7-7M14 6h6v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                View Predictions
              </Link>
            </div>
            <p className="hero-in text-sm text-sand/80" style={{ animationDelay: "320ms" }}>
              Free account, free picks. <Link href="/pricing" className="font-semibold text-sand underline underline-offset-4 decoration-copper hover:decoration-2">Premium Picks</Link> from {plans[0] ? formatMoney(plans[0].amount_minor) : "$50"}.
            </p>
            <p className="hero-in text-xs text-sand/70" style={{ animationDelay: "340ms" }}>{RG_LINE}</p>
          </div>

          {/* Statistics: editable in Admin > Homepage; unverified figures are labelled as such */}
          <div className="grid gap-3">
            <h2 className="sr-only">BETVANTA by the numbers</h2>
            <div className="glass hero-in overflow-hidden grid grid-cols-2 lg:grid-cols-4 [&>*]:border-sand/10 [&>*:nth-child(2n)]:border-l [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0 lg:[&>*:nth-child(n+2)]:border-l" style={{ animationDelay: "380ms" }}>
              {heroStats.map((s, i) => <StatTile key={s.key} s={s} i={i} />)}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sand/70">
              <span>Figures come from BETVANTA&apos;s own records{heroStats.some((x) => x.status === "verified") ? " or are independently verified" : ""}.</span>
              {stats.sampleData && <><SampleBadge /><span>Live figures include development sample data until the live data feed is connected.</span></>}
              <Link href="/performance" className="font-semibold text-sand underline-offset-4 hover:underline sm:ml-auto">See every graded pick</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sports coverage */}
      <section aria-labelledby="sports-h" className="wrap pt-16 md:pt-24 pb-14 md:pb-20 grid gap-6">
        <div className="grid gap-2"><span className="eyebrow">Coverage</span><h2 id="sports-h" className="display text-[26px] leading-8 md:text-[32px] md:leading-[38px] font-bold">Built for the sports you follow</h2></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {SPORTS.map((s) => {
            const c = cov(s.id);
            return (
              <Link key={s.id} href={`/sports/${s.slug}`} className="group card p-5 md:p-6 grid gap-4 content-start transition-colors hover:border-[var(--accent)] focus-visible:border-[var(--accent)]">
                <span className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-teal-subtle text-link grid place-items-center group-hover:bg-brand group-hover:text-[#EAE1D4] transition-colors"><SportIcon sport={s.id} size={30} /></span>
                <div className="grid gap-1">
                  <span className="font-semibold text-[17px]">{s.name}</span>
                  <span className="text-sm text-muted">{s.blurb}</span>
                </div>
                <span className="text-xs text-subtle">{c ? `${c.upcoming} upcoming games` : "Feed coming soon"}{s.predictions ? " · predictions" : ""}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Upcoming fixtures */}
      <section aria-labelledby="fixtures-h" className="wrap pb-14 md:pb-20 grid gap-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="grid gap-2"><span className="eyebrow">Fixtures</span><h2 id="fixtures-h" className="display font-bold text-[26px] leading-8 md:text-[32px] md:leading-[38px]">Upcoming matches</h2>
            <p className="text-muted max-w-[60ch]">Kickoff times in US Eastern. Open a match for form, scoring records, head-to-head and our picks.</p></div>
          <Link href="/fixtures" className="text-sm font-semibold text-link hover:underline">All fixtures and scores</Link>
        </div>
        {nextFixtures.length ? <FixtureList rows={nextFixtures} /> : <Notice tone="info">No upcoming fixtures are loaded yet. Results and schedules appear here once the data feed syncs.</Notice>}
      </section>

      {/* Platform introduction */}
      <section aria-labelledby="platform-h" className="wrap pb-16 md:pb-24 pt-2 grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5 grid gap-5 content-start">
          <span className="eyebrow">The platform</span>
          <h2 id="platform-h" className="display font-bold text-[30px] leading-[36px] md:text-[40px] md:leading-[46px] tracking-[-.01em]">Your Smarter Sports Intelligence Platform</h2>
          <p className="text-[16px] leading-7 text-muted max-w-[52ch]">BETVANTA turns fixtures, form and scoring records into clear, measured reads. Start with free picks, then unlock full analysis and premium insights when you want more depth.</p>
          <ul className="grid gap-4 pt-2">
            {[["Data first", "Every pick starts from scoring and conceding records, home and away, shown on the match page."],
              ["Stated confidence", "A probability and a confidence band on every prediction. We never promise a result."],
              ["An open record", "Picks lock at kickoff and are graded against the final score. Nothing is edited afterwards."]].map(([t, d]) => (
              <li key={t} className="grid grid-cols-[12px_1fr] gap-3"><span aria-hidden className="mt-2 h-2 w-2 rounded-full bg-[var(--accent)]" /><span><strong className="font-semibold">{t}.</strong> <span className="text-muted">{d}</span></span></li>))}
          </ul>
        </div>
        <div className="lg:col-span-7 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Link key={f.n} href={f.href} className="feature-card group card p-6 grid gap-5 content-between">
              <div className="grid gap-3">
                <div className="flex items-baseline justify-between"><span className="num text-xs font-semibold text-accent-text">{f.n}</span><span aria-hidden className="text-subtle group-hover:text-[var(--accent-text)] transition-colors">&rarr;</span></div>
                <h3 className="display font-bold text-[20px] leading-7">{f.title}</h3>
                <p className="text-sm text-muted">{f.body}</p>
              </div>
              <FeatureVisual kind={f.visual} />
              <span className="text-sm font-semibold text-link">{f.cta}</span>
            </Link>))}
        </div>
      </section>

      {/* Featured fixtures */}
      <section className="bg-surface border-y border-line">
        <div className="wrap py-14 md:py-20 grid gap-6">
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
        <div className="wrap py-14 md:py-20 grid gap-8">
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
      <section aria-labelledby="how-h" className="wrap py-14 md:py-20 grid gap-8">
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
        <div className="wrap py-14 md:py-20 grid gap-10 lg:grid-cols-12 lg:items-center">
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
        <div className="wrap py-14 md:py-20 grid gap-6">
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
      <section aria-labelledby="faq-h" className="wrap py-14 md:py-20 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 grid gap-3 content-start"><span className="eyebrow">FAQ</span><h2 id="faq-h" className="display font-bold text-[26px] leading-8 md:text-[32px] md:leading-[38px]">Questions, answered</h2>
          <p className="text-muted">Still unsure? <Link href="/contact" className="text-link font-semibold hover:underline">Contact us</Link> or read the <Link href="/faq" className="text-link font-semibold hover:underline">full FAQ</Link>.</p></div>
        <div className="lg:col-span-8 grid gap-3">{FAQ.filter(([q]) => ["How are predictions made?", "Can a prediction change after kickoff?", "Do plans renew automatically?", "When does my access start?", "Is BETVANTA a bookmaker?"].includes(q)).map(([q, a]) => (
          <details key={q} className="card px-5 py-4 group"><summary className="font-semibold cursor-pointer">{q}</summary><p className="mt-2 text-muted">{a}</p></details>))}</div>
      </section>

      {/* Community */}
      <section className="wrap py-14 md:py-20">
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
