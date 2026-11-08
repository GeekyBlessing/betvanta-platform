import type { Metadata } from "next";
import Link from "next/link";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { cryptoApproved, env } from "@/lib/env";
import { formatMoney, MONTHS, periodLabel, type Plan } from "@/lib/services/billing";
import { cardFeatures, FEATURES, LEVEL_NAMES } from "@/lib/services/plans";
import { PROVIDERS } from "@/lib/services/payments";
import { PageHeader, RG_LINE } from "@/components/ui";
import { SubscribeAssistant } from "@/components/SubscribeAssistant";
import { subscribeAssistantProps } from "@/lib/services/manual-payments/assistant";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Packages", description: "BETVANTA Premium packages in USD: Monthly, 3 Month, 6 Month, 1 Year and Lifetime." };

const Tick = ({ className = "" }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={`shrink-0 mt-[3px] ${className}`}><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const perMonth = (p: Plan) => (p.is_lifetime ? null : Number(p.amount_minor) / MONTHS[p.interval]);

export default async function Packages(props: { searchParams: Promise<{ subscribe?: string; method?: string }> }) {
  const sp = await props.searchParams;
  const [plans, user] = await Promise.all([q<Plan>("select * from plans where active order by level"), currentUser()]);
  const assistant = await subscribeAssistantProps(user, "/packages", { plan: sp.subscribe, method: sp.method });
  const monthly = plans.find((p) => p.level === 1);
  const periodic = plans.filter((p) => !p.is_lifetime);
  const lifetime = plans.find((p) => p.is_lifetime);
  // Subscribe Now opens the payment assistant on this page (data-subscribe); the link is the no-JavaScript fallback.
  const href = (p: Plan) => `/packages?subscribe=${p.code}`;
  const methods = [
    { label: "Card", detail: "Visa, Mastercard, Amex via Stripe", on: PROVIDERS.stripe.enabled() || PROVIDERS.paystack.enabled() },
    { label: "Crypto", detail: "BTC, ETH, USDT", on: PROVIDERS.nowpayments.enabled() || cryptoApproved(), pending: !cryptoApproved() },
    { label: "PayPal, Venmo, Chime, Apple Pay", detail: "Instructions from BETVANTA in our Discord, verified by our team", on: true },
  ];

  return (
    <div className="wrap py-10 grid gap-12">
      <PageHeader eyebrow="Packages" title="Choose your BETVANTA Premium package">
        All prices in US dollars. Each plan is a one-time payment for its period, with no automatic renewal. Longer plans add more, and every plan includes everything in the one before it.
      </PageHeader>

      <section aria-label="Plans" className="grid gap-4 -mt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
          {periodic.map((p) => {
            const best = p.best_value;
            const pm = perMonth(p)!;
            const saving = monthly && p.level > 1 ? Math.round((1 - pm / Number(monthly.amount_minor)) * 100) : 0;
            return (
              <article key={p.id} aria-label={p.name} className={`relative rounded-xl p-6 flex flex-col gap-5 border ${best ? "bg-brand text-on-brand border-transparent shadow-xl lg:-my-2 lg:py-8" : "bg-surface border-line"}`}>
                {best && <span className="absolute -top-3 left-6 rounded-full bg-accent text-on-accent text-xs font-semibold px-3 py-1">Best value</span>}
                <div className="grid gap-1">
                  <h2 className="display text-[13px] font-bold tracking-[.14em] uppercase" style={best ? { color: "#C47C52" } : undefined}>{p.name}</h2>
                  {p.tagline && <p className={`text-sm ${best ? "opacity-85" : "text-muted"}`}>{p.tagline}</p>}
                </div>
                <div className="grid gap-1">
                  <div className="flex items-baseline gap-2"><span className="display num text-[40px] leading-[44px] font-bold">{formatMoney(p.amount_minor)}</span><span className={`text-sm ${best ? "opacity-80" : "text-subtle"}`}>{periodLabel(p)}</span></div>
                  <span className={`text-xs num ${best ? "opacity-80" : "text-subtle"}`}>{p.level === 1 ? "Billed once for 30 days" : `${formatMoney(Math.round(pm))} per month${saving > 0 ? `, save ${saving}%` : ""}`}</span>
                </div>
                <ul className="grid gap-2.5 text-sm">
                  {cardFeatures(p.level).map((f, i) => <li key={f} className={`flex gap-2.5 ${i === 0 && p.level > 1 ? "font-semibold" : ""}`}><Tick className={best ? "text-[#C47C52]" : "text-link"} />{f}</li>)}
                </ul>
                <a href={href(p)} data-subscribe={p.code} aria-label={`Subscribe Now to ${p.name}`} className={`btn btn-lg w-full mt-auto ${best ? "btn-accent" : "btn-secondary"}`}>Subscribe Now</a>
              </article>
            );
          })}
        </div>

        {lifetime && (
          <article aria-label={lifetime.name} className="rounded-xl border border-line bg-sunken p-6 md:p-8 grid gap-6 md:grid-cols-[1.1fr_1.4fr_auto] md:items-center">
            <div className="grid gap-1">
              <h2 className="display text-[13px] font-bold tracking-[.14em] uppercase">{lifetime.name}</h2>
              <div className="flex items-baseline gap-2"><span className="display num text-[40px] leading-[44px] font-bold">{formatMoney(lifetime.amount_minor)}</span><span className="text-sm text-subtle">one-time payment</span></div>
              {lifetime.tagline && <p className="text-sm text-muted">{lifetime.tagline}</p>}
            </div>
            <ul className="grid gap-2.5 text-sm sm:grid-cols-2">{cardFeatures(5).map((f) => <li key={f} className="flex gap-2.5"><Tick className="text-link" />{f}</li>)}<li className="flex gap-2.5"><Tick className="text-link" />Everything in 1 Year, with no expiry</li></ul>
            <a href={href(lifetime)} data-subscribe={lifetime.code} aria-label={`Subscribe Now to ${lifetime.name}`} className="btn btn-primary btn-lg w-full md:w-auto">Subscribe Now</a>
          </article>
        )}
        <p className="text-sm text-muted">Questions before you subscribe? <Link href="/contact" className="text-link font-semibold underline">Contact BETVANTA</Link> or read the <Link href="/faq" className="text-link font-semibold underline">FAQ</Link>.</p>
      </section>

      <section aria-labelledby="pay-h" className="grid gap-3">
        <h2 id="pay-h" className="font-semibold text-[17px]">Payment options</h2>
        <div className="flex flex-wrap gap-3">
          {methods.map((m) => (
            <div key={m.label} className="card px-4 py-3 flex items-center gap-3 min-w-[240px]">
              <div className="grid"><span className="font-semibold text-sm">{m.label}</span><span className="text-xs text-subtle">{m.detail}</span></div>
              <span className={`ml-auto text-xs font-semibold rounded-sm px-2 py-0.5 ${m.on ? "bg-success-subtle text-success" : "bg-sunken text-muted"}`}>{m.on ? "Available" : m.pending ? "Coming soon" : "Not yet available"}</span>
            </div>))}
        </div>
        <p className="text-xs text-subtle">Press Subscribe Now and the payment assistant walks you through your chosen method. Card details are handled by the payment processor and never reach BETVANTA. Subscription payments are kept separate from any betting funds; BETVANTA does not take bets or deposits.</p>
      </section>

      <section aria-labelledby="cmp-h" className="grid gap-3">
        <h2 id="cmp-h" className="font-semibold text-[17px]">Compare packages</h2>
        <div className="card overflow-x-auto relative">
          <table className="table min-w-[760px]">
            <caption className="sr-only">Features included in each BETVANTA Premium plan</caption>
            <thead><tr>
              <th scope="col" className="sticky left-0 z-10 bg-sunken min-w-[220px]">Feature</th>
              {plans.map((p) => <th key={p.id} scope="col" className={`text-center ${p.best_value ? "text-ink" : ""}`}>{LEVEL_NAMES[p.level]}<div className="num normal-case tracking-normal font-semibold text-ink">{formatMoney(p.amount_minor)}</div></th>)}
            </tr></thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.key}>
                  <th scope="row" className="sticky left-0 bg-surface text-left font-normal normal-case tracking-normal text-[14px] text-ink">{f.label}</th>
                  {plans.map((p) => {
                    const yes = p.level >= f.level;
                    return <td key={p.id} className={`text-center ${p.best_value ? "bg-teal-subtle" : ""}`}>{yes ? <span className="inline-flex text-link"><Tick /><span className="sr-only">Included</span></span> : <span className="text-subtle" aria-label="Not included">·</span>}</td>;
                  })}
                </tr>))}
              <tr><th scope="row" className="sticky left-0 bg-surface text-left font-normal normal-case tracking-normal text-[14px] text-ink">Access period</th>{plans.map((p) => <td key={p.id} className={`text-center text-xs ${p.best_value ? "bg-teal-subtle" : ""}`}>{p.is_lifetime ? "Lifetime" : `${p.duration_days} days`}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-subtle">Prices in USD. Giveaways, lotto selections, video sessions, consultations and support are provided by the BETVANTA team to eligible members. {RG_LINE}{env().DISCORD_INVITE_URL ? " Community access is through Discord." : ""}</p>
      <SubscribeAssistant {...assistant} />
    </div>
  );
}
