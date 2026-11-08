import Link from "next/link";
import { currentUser } from "@/lib/session";
import { one, q } from "@/lib/db";
import { dashboardRecord } from "@/lib/services/dashboard";
import { SPORTS, sportCoverage } from "@/lib/services/sports";
import { formatMoney, periodLabel, type Plan } from "@/lib/services/billing";
import { MIN_SETTLED_FOR_RATE } from "@/lib/services/stats";
import { approvedTestimonials } from "@/lib/services/testimonials";
import { discordInviteUrl, instagramHandle, instagramUrl } from "@/lib/env";
import { SportsSelector } from "@/components/SportsSelector";
import { SubscribeAssistant } from "@/components/SubscribeAssistant";
import { subscribeAssistantProps } from "@/lib/services/manual-payments/assistant";
import { RG_LINE, SampleBadge } from "@/components/ui";
export const dynamic = "force-dynamic";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

export default async function Home() {
  const user = await currentUser();
  const [record, coverage, plans, sample, assistant, reviews] = await Promise.all([
    dashboardRecord(),
    sportCoverage(),
    q<Plan>("select * from plans where active order by level"),
    one<{ n: number }>("select count(*)::int n from competitions where active and data_source = 'mock'"),
    subscribeAssistantProps(user, "/"),
    approvedTestimonials(3),
  ]);
  const decided = record.won + record.lost;
  const discord = discordInviteUrl();
  // Every figure is counted from BETVANTA's own records. Nothing here is typed in or estimated.
  const stats = [
    { value: fmt(record.settled), label: "Picks graded" },
    { value: record.winRate === null ? "n/a" : `${record.winRate.toFixed(1)}%`, label: "Hit rate" },
    { value: fmt(record.upcoming7d), label: "Matches this week" },
    { value: fmt(record.sports), label: "Sports covered" },
  ];

  return (
    <>
      {/* Hero: full-width stadium artwork under a dark overlay; the header sits on top of it */}
      <section className="hero" aria-labelledby="hero-h">
        <div className="hero-bg" aria-hidden />
        <div className="wrap pt-[112px] pb-12 md:pt-[168px] md:pb-20 grid gap-10 md:gap-14 text-center">
          <div className="grid gap-6 md:gap-7 justify-items-center">
            <p className="text-[12px] md:text-[13px] font-bold tracking-[.22em] uppercase text-[#E3A27C]">Smarter Insights. Better Decisions.</p>
            <h1 id="hero-h" className="hero-title">Elevate Your Game<br />With Expert<br /><span className="accent">Sports Analysis</span></h1>
            <p className="hero-lede">Access premium sports picks, AI-assisted insights, match analysis and proven strategies.</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto justify-center pt-1">
              <Link href="/packages" className="btn btn-accent hero-btn">Get Premium Picks</Link>
              {discord
                ? <a href={discord} target="_blank" rel="noopener noreferrer" className="btn hero-btn hero-btn-outline">Join Discord<span className="sr-only"> (opens in a new tab)</span></a>
                : <Link href="/community" className="btn hero-btn hero-btn-outline">Join Discord</Link>}
            </div>
          </div>

          <div className="grid gap-3">
            <dl className="hero-stats" aria-label="BETVANTA record">
              {stats.map((s) => <div key={s.label}><dt className="hero-stat-label order-2">{s.label}</dt><dd className="hero-stat-value order-1">{s.value}</dd></div>)}
            </dl>
            <p className="text-[12px] text-white/65 flex flex-wrap items-center justify-center gap-2">
              Counted from BETVANTA&rsquo;s records.{record.winRate === null && ` Hit rate appears after ${MIN_SETTLED_FOR_RATE} decided picks (${decided} so far).`}
              {(sample?.n ?? 0) > 0 && <SampleBadge />}
            </p>
          </div>
        </div>
      </section>

      {/* Sports selection: navy band, two columns of white circles */}
      <SportsSelector sports={SPORTS} coverage={coverage} intro="Fixtures, results and match predictions for each sport, in one place." />

      {/* Packages: every plan one tap from the payment assistant */}
      <section aria-labelledby="packages-h" className="bg-surface">
        <div className="wrap py-14 md:py-20 grid gap-8">
          <div className="text-center grid gap-2">
            <p className="text-[12px] font-bold tracking-[.22em] uppercase text-accent-text">Premium Picks</p>
            <h2 id="packages-h" className="display font-extrabold text-[28px] leading-[34px] md:text-[40px] md:leading-[46px]">Choose your package</h2>
            <p className="text-muted max-w-[560px] mx-auto">Prices in US dollars. One-time payment for each period, no automatic renewal. Every package includes everything in the one before it.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {plans.map((p) => (
              <li key={p.id} className={`rounded-xl border p-5 grid gap-4 content-between ${p.best_value ? "bg-brand text-on-brand border-transparent shadow-xl" : "bg-surface border-line"}`}>
                <div className="grid gap-1">
                  <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.08em]">{p.name}</span>
                  {p.best_value && <span className="w-fit rounded-full bg-accent text-on-accent px-2.5 py-0.5 text-[11px] font-semibold">Best value</span>}
                  <span className="pt-1"><span className="display num text-[32px] font-bold">{formatMoney(p.amount_minor)}</span> <span className={`text-[13px] ${p.best_value ? "opacity-80" : "text-subtle"}`}>{periodLabel(p)}</span></span>
                </div>
                <a href={`/packages?subscribe=${p.code}`} data-subscribe={p.code} aria-label={`Subscribe Now to ${p.name}`} className={`btn w-full ${p.best_value ? "btn-accent" : "btn-primary"}`}>Subscribe Now</a>
              </li>))}
          </ul>
          <p className="text-center"><Link href="/packages" className="text-link font-semibold hover:underline">Compare every package and its benefits<span aria-hidden> &rsaquo;</span></Link></p>
        </div>
      </section>

      {/* Member reviews: shown only once members have agreed to share them and an admin has approved them */}
      {reviews.length > 0 && (
        <section aria-labelledby="reviews-h" className="bg-sunken">
          <div className="wrap py-14 grid gap-6">
            <h2 id="reviews-h" className="display font-extrabold text-[26px] md:text-[32px] text-center">What members say</h2>
            <div className="grid gap-4 md:grid-cols-3">{reviews.map((rv) => (
              <figure key={rv.id} className="card p-5 grid gap-2 content-start">
                <span className="num text-[13px] text-accent-text" aria-label={`${rv.rating} out of 5`}>{"★".repeat(rv.rating)}{"☆".repeat(5 - rv.rating)}</span>
                <blockquote className="text-[15px] leading-6">&ldquo;{rv.body}&rdquo;</blockquote>
                <figcaption className="text-[13px] text-muted">{rv.display_name}{rv.location ? `, ${rv.location}` : ""}{rv.verified_subscriber ? " · Verified subscriber" : ""}</figcaption>
              </figure>))}</div>
          </div>
        </section>)}

      {/* Community */}
      <section className="bg-brand text-on-brand" aria-labelledby="community-h">
        <div className="wrap py-10 flex flex-col md:flex-row md:items-center gap-5 justify-between">
          <div className="grid gap-1"><h2 id="community-h" className="display font-bold text-[22px]">Join the BETVANTA community</h2><p className="text-[15px] opacity-85">Pick announcements and match discussion on Discord; match-day updates on Instagram.</p></div>
          <div className="flex flex-wrap gap-3">
            {discord && <a href={discord} target="_blank" rel="noopener noreferrer" className="btn btn-accent">Join Discord<span className="sr-only"> (opens in a new tab)</span></a>}
            {instagramUrl() && <a href={instagramUrl()!} target="_blank" rel="noopener noreferrer" className="btn hero-btn-outline">Instagram {instagramHandle()}<span className="sr-only"> (opens in a new tab)</span></a>}
          </div>
        </div>
        <p className="wrap pb-6 text-[12px] opacity-70">BETVANTA publishes analysis only. We do not take bets or hold funds, and we do not show betting odds. {RG_LINE}</p>
      </section>

      <SubscribeAssistant {...assistant} />
    </>
  );
}
