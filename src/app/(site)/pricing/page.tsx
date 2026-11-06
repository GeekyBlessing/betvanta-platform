import type { Metadata } from "next";
import Link from "next/link";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { paymentsEnabled } from "@/lib/env";
import { formatMoney, type Plan } from "@/lib/services/billing";
import { ApiForm } from "@/components/ApiForm";
import { Notice, PageHeader, RG_LINE } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pricing", description: "BETVANTA plans: Free, Premium and VIP, monthly, quarterly or annual." };
const INTERVALS = ["monthly", "quarterly", "annual"] as const;

export default async function Pricing(props: { searchParams: Promise<{ interval?: string }> }) {
  const searchParams = await props.searchParams;
  const interval = INTERVALS.includes(searchParams.interval as never) ? searchParams.interval! : "monthly";
  const [plans, user] = await Promise.all([q<Plan>("select * from plans where active and interval = $1 order by sort", [interval]), currentUser()]);
  const per = interval === "monthly" ? "per month" : interval === "quarterly" ? "per quarter" : "per year";
  return (
    <div className="wrap py-10">
      <PageHeader eyebrow="Pricing" title="Plans built for serious analysis">Every plan is paid upfront for its period and does not renew automatically. Cancel any time; access runs to the end of the period.</PageHeader>
      <div className="inline-flex p-1 gap-1 bg-sunken rounded-full border border-line mb-8" role="group" aria-label="Billing interval">
        {INTERVALS.map((i) => <Link key={i} href={`/pricing?interval=${i}`} aria-pressed={i === interval} className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize ${i === interval ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>{i}</Link>)}
      </div>
      {!paymentsEnabled() && <div className="mb-6"><Notice tone="warning" title="Checkout is not switched on yet.">Payments will open once the payment provider is connected.</Notice></div>}
      <div className="grid gap-4 md:grid-cols-3 items-start">
        <section className="card p-6 grid gap-5 rounded-xl" aria-label="Free plan">
          <span className="display text-[13px] font-bold tracking-[.14em] uppercase">Free</span>
          <div className="display text-[40px] leading-[44px] font-bold">₦0</div>
          <ul className="grid gap-2 text-sm"><li>Free daily predictions</li><li>Public track record</li><li>Match pages and form</li></ul>
          <Link href={user ? "/dashboard" : "/register"} className="btn btn-secondary btn-lg w-full">{user ? "Go to dashboard" : "Create free account"}</Link>
        </section>
        {plans.map((p) => {
          const vip = p.tier === "vip";
          return (
            <section key={p.id} className={`p-6 grid gap-5 rounded-xl border ${vip ? "bg-brand text-on-brand border-transparent shadow-xl" : "card"}`} aria-label={`${p.name} plan`}>
              <div className="flex justify-between items-center"><span className="display text-[13px] font-bold tracking-[.14em] uppercase" style={vip ? { color: "#C47C52" } : undefined}>{p.name}</span>{vip && <span className="text-xs font-semibold rounded-sm px-2 py-0.5 bg-accent-subtle text-accent-text">Most complete</span>}</div>
              <div className="flex items-baseline gap-2"><span className="display text-[40px] leading-[44px] font-bold num">{formatMoney(p.amount_minor, p.currency)}</span><span className={`text-sm ${vip ? "opacity-80" : "text-subtle"}`}>{per}</span></div>
              <ul className="grid gap-2 text-sm">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
              {user ? (
                <ApiForm action="/api/billing/checkout" extra={{ planCode: p.code }} submitLabel={`Choose ${p.name}`} variant={vip ? "accent" : "primary"} size="lg" block className="grid gap-2"><span className="sr-only">{p.code}</span></ApiForm>
              ) : <Link href={`/register?next=/pricing`} className={`btn btn-lg w-full ${vip ? "btn-accent" : "btn-primary"}`}>Create account to subscribe</Link>}
            </section>
          );
        })}
      </div>
      <p className="mt-8 text-xs text-subtle">Prices in Nigerian naira. Payments are processed by Paystack. {RG_LINE}</p>
    </div>
  );
}
