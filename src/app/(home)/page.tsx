import Link from "next/link";
import { currentUser } from "@/lib/session";
import { q } from "@/lib/db";
import { tierFor } from "@/lib/services/entitlements";
import { listPredictions } from "@/lib/services/predictions";
import { publicHomepageStats, type PublicStat, type StatIcon } from "@/lib/services/homepage-stats";
import { approvedTestimonials } from "@/lib/services/testimonials";
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
  unverified: { text: "Unverified", color: "#E0B456" }, verified: { text: "Verified", color: "#74C394" }, live: { text: "Live record", color: "#7DB8AE" },
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
  const [upcoming, { stats: heroStats, live: stats }, reviews, coverage] = await Promise.all([
    listPredictions(tier, { upcoming: true, limit: 12 }),
    publicHomepageStats(),
    approvedTestimonials(6),
    q<{ sport: string; upcoming: number; leagues: number }>(
      `select c.sport, count(distinct c.id)::int leagues, count(f.id) filter (where f.status = 'scheduled' and f.kickoff_at > now())::int upcoming
       from competitions c left join fixtures f on f.competition_id = c.id where c.active group by c.sport`),
  ]);
  const fixtures = groupByFixture(upcoming).slice(0, 4);
  const cov = (id: string) => coverage.find((c) => c.sport === id);
  const unverified = heroStats.some((x) => x.status === "unverified");

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
              <Link href="/predictions" className="btn btn-accent btn-lg w-full sm:w-auto">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14l5-5 4 4 7-7M14 6h6v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Explore Predictions
              </Link>
              <JoinDiscordButton label="Join Our Community" className="btn btn-lg btn-onbrand w-full sm:w-auto backdrop-blur-sm" />
            </div>
            <p className="hero-in text-xs text-sand/70" style={{ animationDelay: "340ms" }}>{RG_LINE}</p>
          </div>

          {/* Statistics: editable in Admin > Homepage; unverified figures are labelled as such */}
          <div className="grid gap-3">
            <h2 className="sr-only">BETVANTA by the numbers</h2>
            <div className="glass hero-in overflow-hidden grid grid-cols-2 lg:grid-cols-4 [&>*]:border-sand/10 [&>*:nth-child(2n)]:border-l [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0 lg:[&>*:nth-child(n+2)]:border-l" style={{ animationDelay: "380ms" }}>
              {heroStats.map((s, i) => <StatTile key={s.key} s={s} i={i} />)}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sand/70">
              {unverified && <span><span style={{ color: "#E0B456" }} className="font-semibold">Unverified</span> figures are supplied by BETVANTA and have not yet been independently verified.</span>}
              {stats.sampleData && <><SampleBadge /><span>Live figures include development sample data until the live data feed is connected.</span></>}
              <Link href="/performance" className="font-semibold text-sand underline-offset-4 hover:underline sm:ml-auto">See every graded pick</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Platform introduction */}
      <section aria-labelledby="platform-h" className="wrap py-16 md:py-24 grid gap-10 lg:grid-cols-12 lg:gap-12">
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

      {/* Sports coverage */}
      <section aria-labelledby="sports-h" className="wrap py-14 md:py-20 grid gap-6">
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

      {/* Featured fixtures */}
      <section className="bg-surface border-y border-line">
        <div className="wrap py-14 md:py-20 grid gap-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="grid gap-2"><span className="eyebrow">Upcoming</span><h2 className="display text-[26px] leading-8 md:text-[32px] md:leading-[38px] font-bold">This week&apos;s picks</h2></div>
            <Link href="/predictions" className="text-sm font-semibold text-link hover:underline">All predictions</Link>
          </div>
          {fixtures.length ? <div className="grid gap-4 md:grid-cols-2">{fixtures.map((g) => <FixtureCard key={g[0].fixture_id} preds={g} />)}</div>
            : <Notice tone="info">No predictions are published yet. Check back before the next matchday.</Notice>}
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
