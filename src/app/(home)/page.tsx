import Link from "next/link";
import { currentUser } from "@/lib/session";
import { publicHomepageStats, type PublicStat, type StatIcon } from "@/lib/services/homepage-stats";
import { approvedTestimonials } from "@/lib/services/testimonials";
import { discordInviteUrl, instagramHandle, instagramUrl, xHandle, xUrl } from "@/lib/env";
import { ApiForm, Field } from "@/components/ApiForm";
import { CountUp, RefreshTestimonials } from "@/components/HomeWidgets";
import { DiscordGlyph } from "@/components/Discord";
import { InstagramGlyph, XGlyph } from "@/components/Community";
import { RG_LINE } from "@/components/ui";
export const dynamic = "force-dynamic";

const ic = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const STAT_ICON: Record<StatIcon, React.ReactNode> = {
  members: <svg {...ic}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" /></svg>,
  target: <svg {...ic}><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>,
  trophy: <svg {...ic}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4M12 13v4M8.5 20h7" /></svg>,
  sports: <svg {...ic}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>,
};
const SPORTS = [
  { name: "Football", img: "/images/sports/american-football.svg" },
  { name: "Soccer", img: "/images/sports/soccer.svg" },
  { name: "Basketball", img: "/images/sports/basketball.svg" },
  { name: "Baseball", img: "/images/sports/baseball.svg" },
];
const fi = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const SERVICES = [
  { title: "AI Premium Analysis", body: "Cutting-edge AI-powered insights for informed betting decisions across all major sports.", icon: <svg {...fi}><rect x="5" y="7" width="14" height="11" rx="3" /><path d="M12 3v4M9 12h.01M15 12h.01M9.5 15.5h5" /></svg> },
  { title: "Build Bankrolls", body: "Strategic approaches to grow your betting bankroll consistently with proven methodologies.", icon: <svg {...fi}><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg> },
  { title: "Premium Giveaways", body: "Exclusive giveaways and promotions for our valued members, including cash prizes and merchandise.", icon: <svg {...fi}><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-3-5-1s3 1 5 1zm0 0c1.5-3 5-3 5-1s-3 1-5 1z" /></svg> },
];
const WHY = [
  { title: "Well Reasoned Picks", body: "Our picks are based on thorough analysis and expert insights. We don't guess: we research, analyze, and provide well-reasoned selections.", icon: <svg {...fi}><path d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg> },
  { title: "AI-Powered Insights", body: "Leverage the power of artificial intelligence to gain a competitive edge in sports betting with our proprietary algorithms.", icon: <svg {...fi}><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></svg> },
  { title: "Bankroll Management", body: "Learn effective strategies to grow and protect your betting bankroll for long-term success and sustainable profits.", icon: <svg {...fi}><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg> },
  { title: "Exclusive Giveaways", body: "Enjoy premium giveaways and special promotions available only to our subscribed members, including cash prizes.", icon: <svg {...fi}><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12" /></svg> },
];

function Stat({ s }: { s: PublicStat }) {
  return (
    <div className="hero-stat">
      <span className="hero-stat-icon">{STAT_ICON[s.icon]}</span>
      <span className="hero-stat-value"><CountUp value={s.value} /></span>
      <span className="hero-stat-label">{s.label}</span>
      {s.status !== "client" && <span className="hero-stat-tag">{s.status === "verified" ? "Verified" : "Live record"}</span>}
    </div>
  );
}

export default async function Home() {
  const user = await currentUser();
  const [{ stats }, reviews] = await Promise.all([publicHomepageStats(), approvedTestimonials(9, true)]);
  const discord = discordInviteUrl(), ig = instagramUrl(), xl = xUrl();
  const clientFigures = stats.some((s) => s.status === "client");

  return (
    <>
      {/* Hero */}
      <section className="tb-hero" aria-labelledby="hero-h">
        <div className="wrap tb-hero-inner">
          <span className="tb-spark" aria-hidden>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" /></svg>
          </span>
          <h1 id="hero-h" className="tb-title">Elevate Your <span className="text-red">Betting Game</span> With Expert Analysis</h1>
          <p className="tb-lede">Join thousands of winning bettors who trust BETVANTA for premium picks, AI-powered insights, and proven strategies.</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto justify-center">
            <Link href="/packages" className="btn btn-accent tb-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4M12 13v4M8.5 20h7" /></svg>
              Get Premium Picks
            </Link>
            {discord && <a href={discord} target="_blank" rel="noopener noreferrer" className="btn tb-btn tb-btn-ghost"><DiscordGlyph size={18} />Join Discord<span className="sr-only"> (opens in a new tab)</span></a>}
          </div>
          {stats.length > 0 && (
            <div className="grid gap-2 w-full justify-items-center">
              <h2 className="sr-only">BETVANTA in numbers</h2>
              <div className="hero-stats">{stats.map((s) => <Stat key={s.key} s={s} />)}</div>
              {clientFigures && <p className="text-[11px] text-subtle">Figures provided by BETVANTA; not independently verified. Past results do not guarantee future outcomes.</p>}
            </div>)}
        </div>
      </section>

      {/* Sports */}
      <section className="wrap tb-section" aria-labelledby="sports-h">
        <h2 id="sports-h" className="tb-h2">Your Ultimate <span className="text-red">Sports Betting</span> Destination</h2>
        <ul className="tb-sports">
          {SPORTS.map((s) => (
            <li key={s.name} className="tb-sport">
              {/* eslint-disable-next-line @next/next/no-img-element -- local SVG illustration */}
              <span className="tb-sport-img"><img src={s.img} alt="" width={240} height={240} loading="lazy" /></span>
              <span className="tb-sport-name">{s.name}</span>
            </li>))}
        </ul>
      </section>

      {/* Connect */}
      <section className="wrap tb-section !pt-0" aria-labelledby="connect-h">
        <p className="text-center text-muted mb-6">Check below for our subscribers&rsquo; feedback!</p>
        <div className="tb-card max-w-[760px] mx-auto text-center grid gap-5 justify-items-center">
          <h2 id="connect-h" className="tb-h3">Connect With BETVANTA</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {ig && <a href={ig} target="_blank" rel="noopener noreferrer" className="btn btn-secondary"><InstagramGlyph size={18} />{instagramHandle()}<span className="sr-only"> on Instagram (opens in a new tab)</span></a>}
            {xl && <a href={xl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary"><XGlyph size={18} />{xHandle()}<span className="sr-only"> on X (opens in a new tab)</span></a>}
          </div>
          {discord && <a href={discord} target="_blank" rel="noopener noreferrer" className="btn btn-accent"><DiscordGlyph size={18} />Join Discord<span className="sr-only"> (opens in a new tab)</span></a>}
        </div>
      </section>

      {/* Premium services */}
      <section className="wrap tb-section" aria-labelledby="services-h">
        <h2 id="services-h" className="tb-h2">Our <span className="text-red">Premium Services</span></h2>
        <p className="tb-sub">Unlock your betting potential with our comprehensive suite of premium services</p>
        <div className="grid gap-5 md:grid-cols-3">
          {SERVICES.map((s) => <article key={s.title} className="tb-card grid gap-3 content-start"><span className="tb-icon">{s.icon}</span><h3 className="font-bold text-[19px]">{s.title}</h3><p className="text-muted text-[15px]">{s.body}</p></article>)}
        </div>
        <div className="text-center pt-8"><Link href="/packages" className="btn btn-accent tb-btn">View All Services</Link></div>
      </section>

      {/* Why choose */}
      <section className="wrap tb-section" aria-labelledby="why-h">
        <h2 id="why-h" className="tb-h2">Why Choose <span className="text-red">BETVANTA</span>?</h2>
        <p className="tb-sub">Join thousands of satisfied members who trust our expert analysis and proven track record</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => <article key={w.title} className="tb-card grid gap-3 content-start"><span className="tb-icon">{w.icon}</span><h3 className="font-bold text-[18px]">{w.title}</h3><p className="text-muted text-[14.5px]">{w.body}</p></article>)}
        </div>
      </section>

      {/* Testimonials */}
      <section className="wrap tb-section" aria-labelledby="reviews-h">
        <h2 id="reviews-h" className="tb-h2">What Our <span className="text-red">Members Say</span></h2>
        <div className="flex justify-center pb-8"><RefreshTestimonials /></div>
        {reviews.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{reviews.map((rv) => (
            <figure key={rv.id} className="tb-card grid gap-3 content-start">
              <span className="text-red text-[15px] tracking-[.1em]" aria-label={`${rv.rating} out of 5`}>{"★".repeat(rv.rating)}{"☆".repeat(5 - rv.rating)}</span>
              <blockquote className="text-[15px] leading-6">&ldquo;{rv.body}&rdquo;</blockquote>
              <figcaption className="grid"><span className="font-semibold">{rv.display_name}</span><span className="text-[13px] text-muted">{rv.location ?? ""}{rv.verified_subscriber ? `${rv.location ? " · " : ""}Verified subscriber` : ""}</span></figcaption>
            </figure>))}</div>
        ) : <p className="tb-card text-center text-muted">Reviews from BETVANTA members will appear here. We only publish reviews that members agree to share.</p>}
        <div className="text-center grid gap-4 justify-items-center pt-10">
          <p className="text-muted">Join our community and see why our members love our premium betting insights!</p>
          <Link href="/packages" className="btn btn-accent tb-btn">Get Started Today</Link>
        </div>
      </section>

      {/* Feedback and premium updates */}
      <section className="wrap tb-section grid gap-6 lg:grid-cols-2" aria-label="Feedback and premium updates">
        <div className="tb-card grid gap-4 content-start">
          <h2 className="tb-h3">Share Your Feedback</h2>
          <ApiForm action="/api/contact" submitLabel="Submit Feedback" variant="primary" refresh={false} resetOnSuccess>
            <Field label="Name" name="name" autoComplete="name" required />
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            <div className="grid gap-1.5"><label htmlFor="fb-message" className="label">Feedback</label><textarea id="fb-message" name="message" rows={4} className="input" required minLength={10} /></div>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          </ApiForm>
        </div>
        <div className="tb-card grid gap-4 content-start">
          <div className="flex items-center justify-between gap-3"><h2 className="tb-h3">Premium Updates</h2><span className="pill-premium">Premium Only</span></div>
          <p className="text-muted text-[14px]">Exclusive updates for our premium members.</p>
          <ApiForm action="/api/premium-updates" submitLabel="Link Email to Premium Updates" variant="primary" refresh={false} resetOnSuccess>
            <Field label="Your email address" name="email" type="email" autoComplete="email" required hint="The email on your BETVANTA account." />
            <Field label="Premium membership code *" name="code" required autoComplete="off" hint="Find your code in your subscription confirmation email or your account dashboard." />
          </ApiForm>
          {!user && <p className="text-[13px] text-subtle">Not a member yet? <Link href="/packages" className="text-link font-semibold">See packages</Link>.</p>}
        </div>
      </section>

      {/* Final call to action */}
      <section className="tb-cta" aria-labelledby="cta-h">
        <div className="wrap py-16 md:py-20 grid gap-4 justify-items-center text-center">
          <h2 id="cta-h" className="tb-h2 !mb-0">Ready to Start <span className="text-red">Winning?</span></h2>
          <p className="text-muted">Join BETVANTA today and take your sports betting to the next level.</p>
          <Link href="/packages" className="btn btn-accent tb-btn">Get Started Now</Link>
          <p className="text-[11px] text-subtle max-w-[70ch] pt-2">{RG_LINE}</p>
        </div>
      </section>
    </>
  );
}
