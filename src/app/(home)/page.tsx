import Link from "next/link";
import { currentUser } from "@/lib/session";
import { q } from "@/lib/db";
import { publicHomepageStats, type PublicStat, type StatIcon } from "@/lib/services/homepage-stats";
import { SPORTS, sportCoverage } from "@/lib/services/sports";
import { formatMoney, periodLabel, type Plan } from "@/lib/services/billing";
import { approvedTestimonials } from "@/lib/services/testimonials";
import { JoinDiscordButton } from "@/components/Discord";
import { SportsSelector } from "@/components/SportsSelector";
import { CommunitySection } from "@/components/Community";
import { SubscribeAssistant } from "@/components/SubscribeAssistant";
import { subscribeAssistantProps } from "@/lib/services/manual-payments/assistant";
import { RG_LINE } from "@/components/ui";
export const dynamic = "force-dynamic";

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

export default async function Home() {
  const user = await currentUser();
  const [{ stats: heroStats }, coverage, plans, assistant, reviews] = await Promise.all([
    publicHomepageStats(),
    sportCoverage(),
    q<Plan>("select * from plans where active order by level"),
    subscribeAssistantProps(user, "/"),
    approvedTestimonials(3),
  ]);
  const start = user ? (user.role === "member" ? "/dashboard" : "/admin") : "/register";

  return (
    <>
      {/* Hero: full-width stadium artwork, dark overlay, centred message, glass statistics panel */}
      <section className="hero relative isolate overflow-hidden" aria-labelledby="hero-h">
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/hero/stadium-tall.webp" type="image/webp" />
          {/* eslint-disable-next-line @next/next/no-img-element -- art-directed background, sized by CSS */}
          <img src="/images/hero/stadium-wide.webp" alt="" fetchPriority="high" decoding="async" className="hero-media absolute inset-0 -z-20 h-full w-full object-cover object-[50%_35%] max-md:object-top" />
        </picture>
        <div aria-hidden className="hero-scrim absolute inset-0 -z-10" />
        <div aria-hidden className="hero-glow absolute inset-0 -z-10" />
        <div className="wrap pt-[100px] md:pt-[124px] pb-10 md:pb-14 grid justify-items-center text-center gap-4 md:gap-5">
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
            <Link href="/packages" className="btn btn-accent sm:btn-lg hero-cta w-full sm:w-auto shadow-[0_10px_30px_-10px_rgba(196,124,82,.7)]">
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
              {heroStats.map((st, i) => <StatTile key={st.key} s={st} i={i} />)}
            </div>
            <p className="text-[11px] sm:text-xs text-sand/65 max-w-[80ch] mx-auto">
              {heroStats.some((x) => x.status === "client") && "Figures provided by BETVANTA; not independently verified. "}Past results do not guarantee future outcomes. {RG_LINE}{" "}
              <Link href="/performance" className="font-semibold text-sand/85 underline underline-offset-2">See our graded record</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Sports selection: navy band, two columns of white circles */}
      <SportsSelector sports={SPORTS} coverage={coverage} intro="Fixtures, results and match predictions for each sport, in one place." />

      {/* Community: Discord and Instagram, and what is free vs premium */}
      <CommunitySection />

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
          <p className="text-center text-[12px] text-subtle max-w-[720px] mx-auto">BETVANTA publishes analysis only. We do not take bets or hold funds, and we do not show betting odds. {RG_LINE}</p>
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

      <SubscribeAssistant {...assistant} />
    </>
  );
}
