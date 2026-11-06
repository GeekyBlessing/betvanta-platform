import Link from "next/link";
import { currentUser } from "@/lib/session";
import { q } from "@/lib/db";
import { tierFor } from "@/lib/services/entitlements";
import { listPredictions } from "@/lib/services/predictions";
import { homeStats, MIN_SETTLED_FOR_RATE } from "@/lib/services/stats";
import { approvedTestimonials } from "@/lib/services/testimonials";
import { SPORTS } from "@/lib/services/sports";
import { FixtureCard, groupByFixture } from "@/components/PredictionCard";
import { JoinDiscordButton } from "@/components/Discord";
import { SportIcon } from "@/components/SportIcon";
import { Notice, RG_LINE, SampleBadge } from "@/components/ui";
export const dynamic = "force-dynamic";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <svg key={i} width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.5 5.2 5.7.8-4.1 4 1 5.7L10 14.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill={i <= n ? "#C47C52" : "none"} stroke="#C47C52" strokeWidth="1.2" /></svg>)}
    </span>
  );
}

export default async function Home() {
  const user = await currentUser();
  const tier = await tierFor(user);
  const [upcoming, stats, reviews, coverage] = await Promise.all([
    listPredictions(tier, { upcoming: true, limit: 12 }),
    homeStats(),
    approvedTestimonials(6),
    q<{ sport: string; upcoming: number; leagues: number }>(
      `select c.sport, count(distinct c.id)::int leagues, count(f.id) filter (where f.status = 'scheduled' and f.kickoff_at > now())::int upcoming
       from competitions c left join fixtures f on f.competition_id = c.id where c.active group by c.sport`),
  ]);
  const fixtures = groupByFixture(upcoming).slice(0, 4);
  const cov = (id: string) => coverage.find((c) => c.sport === id);
  const statTiles = [
    { label: "Members", value: fmt(stats.members), note: "Active accounts" },
    { label: "Prediction win rate", value: stats.winRate === null ? "Building" : `${stats.winRate.toFixed(1)}%`, note: stats.winRate === null ? `Shown after ${MIN_SETTLED_FOR_RATE} settled picks` : `${fmt(stats.won)} won, ${fmt(stats.lost)} lost` },
    { label: "Settled predictions", value: fmt(stats.settled), note: "Locked at kickoff, graded on the final score" },
    { label: "Sports covered", value: String(stats.sports), note: "With live fixtures in our feed" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand text-on-brand">
        <svg aria-hidden="true" className="absolute right-[-120px] top-[-80px] opacity-[.10] hidden md:block" width="640" height="640" viewBox="0 0 40 40">
          <path d="M9.5 13.5 L18.5 29 L27 13" fill="none" stroke="#EAE1D4" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="30.6" cy="8.6" r="3.4" fill="#C47C52" />
        </svg>
        <div className="wrap relative pt-14 pb-28 md:pt-20 md:pb-36 grid gap-6 max-w-[1200px]">
          <span className="eyebrow" style={{ color: "#C47C52" }}>Sports intelligence</span>
          <h1 className="display font-bold text-[36px] leading-[40px] sm:text-[44px] sm:leading-[48px] md:text-[56px] md:leading-[60px] max-w-[16ch]">
            Sharper reads on every <span style={{ color: "#C47C52" }}>matchup.</span>
          </h1>
          <p className="text-[17px] leading-7 md:text-[19px] md:leading-8 max-w-[56ch] opacity-90">
            BETVANTA combines expert predictions with AI-powered analysis of form, scoring and head-to-head data. Every pick shows its probability, its confidence and the limits of the data behind it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href="/pricing" className="btn btn-accent btn-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14l5-5 4 4 7-7M14 6h6v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Get Premium Picks
            </Link>
            <JoinDiscordButton className="btn btn-lg btn-onbrand" />
          </div>
          <p className="text-xs opacity-75">{RG_LINE}</p>
        </div>
      </section>

      {/* Performance statistics, overlapping the hero */}
      <section aria-labelledby="stats-h" className="wrap -mt-16 md:-mt-20 relative z-[1]">
        <h2 id="stats-h" className="sr-only">BETVANTA by the numbers</h2>
        <div className="card shadow-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)] overflow-hidden">
          {statTiles.map((s, i) => (
            <div key={s.label} className={`p-5 md:p-7 grid gap-1 content-start ${i % 2 === 1 ? "border-l border-line lg:border-l-0" : ""}`}>
              <span className="text-[13px] font-medium text-muted">{s.label}</span>
              <span className="num text-[30px] leading-9 md:text-[38px] md:leading-[44px] font-semibold tracking-tight">{s.value}</span>
              <span className="text-xs text-subtle">{s.note}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-subtle">
          <span>Live figures from BETVANTA&apos;s own records.</span>
          {stats.sampleData && <><SampleBadge /><span>Includes development sample data until the live data feed is connected.</span></>}
          <Link href="/performance" className="text-link font-semibold hover:underline ml-auto">See the full record</Link>
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

      {/* Why BETVANTA */}
      <section className="wrap py-14 md:py-20 grid gap-4 md:grid-cols-3">
        {[["Data first", "Every pick starts from scoring and conceding records, home and away, with the numbers shown on the match page."],
          ["Stated confidence", "Each prediction carries a probability and a confidence band. We never promise a result."],
          ["An open record", "Picks lock at kickoff and are graded against the final score. Nothing is edited afterwards."]].map(([t, d]) => (
          <div key={t} className="grid gap-2"><h3 className="font-semibold text-[17px]">{t}</h3><p className="text-sm text-muted">{d}</p></div>))}
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
