import type { Metadata } from "next";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { cryptoApproved } from "@/lib/env";
import { formatMoney, type Plan } from "@/lib/services/billing";
import { PROVIDERS } from "@/lib/services/payments";
import { RG_LINE } from "@/components/ui";
import { SubscribeAssistant } from "@/components/SubscribeAssistant";
import { subscribeAssistantProps } from "@/lib/services/manual-payments/assistant";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Packages", description: "BETVANTA subscription packages: Monthly, 3 Month, 6 Month, 1 Year and Lifetime Premium." };

/** Package copy as the client specified it, by plan level (1 Monthly ... 5 Lifetime). Access itself comes from the plan's level. */
const COPY: Record<number, { tagline: string; features: string[]; duration: string }> = {
  1: { tagline: "Most popular choice", duration: "30 days of service", features: ["Expert well analyzed picks", "AI-powered daily analysis", "Weekly premium giveaways", "Building bankroll strategies", "Lotto selections", "Video live analysis", "Discord community access"] },
  2: { tagline: "Best value for regular bettors", duration: "90 days of service", features: ["All Monthly Premium features", "Priority access to giveaways", "Enhanced bankroll building", "Advanced AI insights", "Early access to lotto picks", "Extended video analysis sessions"] },
  3: { tagline: "Extended access package", duration: "180 days of service", features: ["All 3 Month Premium features", "VIP-exclusive picks", "1-on-1 bankroll consultation", "Personalized AI analysis reports", "Exclusive lotto strategy sessions", "Premium live video Q&A sessions"] },
  4: { tagline: "Ultimate yearly access", duration: "365 days of service", features: ["All 6 Month Premium features", "Premium VIP status", "Exclusive yearly mega giveaways", "Priority 24/7 support", "Custom AI-driven betting strategies", "VIP lotto selection service", "Weekly private video analysis calls"] },
  5: { tagline: "Ultimate VIP experience", duration: "Unlimited service duration", features: ["All Premium features for life", "Lifetime VIP status", "Exclusive lifetime access to all giveaways", "Personal betting advisor", "Customized AI analysis dashboard", "Priority lotto number generation", "On-demand video analysis sessions"] },
};
const Tick = () => <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 mt-[3px] text-red"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export default async function Packages(props: { searchParams: Promise<{ subscribe?: string; method?: string }> }) {
  const sp = await props.searchParams;
  const [plans, user] = await Promise.all([q<Plan>("select * from plans where active order by level"), currentUser()]);
  const assistant = await subscribeAssistantProps(user, "/packages", { plan: sp.subscribe, method: sp.method });
  // Ways to pay that actually work right now (the payment assistant shows the details for each).
  const methods = [
    ...(PROVIDERS.stripe.enabled() || PROVIDERS.paystack.enabled() ? ["Card"] : []),
    ...(PROVIDERS.nowpayments.enabled() || cryptoApproved() ? ["Crypto"] : []),
    "Chime", "Venmo", "Apple Pay",
  ];
  return (
    <div className="wrap py-10 md:py-14 grid gap-10">
      <header className="text-center grid gap-2 justify-items-center">
        <h1 className="tb-h1 flex items-center gap-3">
          <svg width="38" height="38" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-red hidden sm:block"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>
          <span>Subscription <span className="text-red">Packages</span></span>
        </h1>
        <p className="text-muted">Choose the package that best suits your needs</p>
      </header>
      <section aria-label="Packages" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-stretch">
        {plans.map((p) => {
          const c = COPY[p.level];
          const lifetime = p.is_lifetime;
          return (
            <article key={p.id} aria-label={p.name} className={`pkg ${lifetime ? "pkg-lifetime" : ""} ${p.best_value ? "pkg-best-value" : ""}`}>
              {p.best_value && <span className="pkg-ribbon">Best value</span>}
              <div className="grid gap-1"><h2 className="font-bold text-[18px] leading-6">{p.name}</h2><p className="text-[13px] text-muted">{c?.tagline ?? p.tagline}</p></div>
              <span className={`num text-[32px] font-bold ${lifetime ? "text-[#F2B84B]" : "text-red"}`}>{formatMoney(p.amount_minor)}</span>
              <ul className="grid gap-2 text-[13.5px]">
                {(c?.features ?? []).map((f) => <li key={f} className="flex gap-2"><Tick />{f}</li>)}
                <li className="flex gap-2 font-semibold"><Tick />{c?.duration ?? `${p.duration_days} days of service`}</li>
              </ul>
              <div className="mt-auto grid gap-3">
                <p className="flex flex-wrap gap-1.5" aria-label="Ways to pay">{methods.map((m) => <span key={m} className="pay-chip">{m}</span>)}</p>
                <a href={`/packages?subscribe=${p.code}`} data-subscribe={p.code} aria-label={`Subscribe Now to ${p.name}`} className="btn btn-accent w-full">Subscribe Now</a>
              </div>
            </article>);
        })}
      </section>
      <p className="text-xs text-subtle text-center max-w-[80ch] mx-auto">Prices in US dollars. Each package is a one-time payment for its period, with no automatic renewal. Subscribe Now opens our payment assistant; access starts once your payment is verified. {RG_LINE}</p>
      <SubscribeAssistant {...assistant} />
    </div>
  );
}
