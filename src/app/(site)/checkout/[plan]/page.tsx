import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { enabledProviders } from "@/lib/services/payments";
import { formatMoney, type Plan } from "@/lib/services/billing";
import { cardFeatures } from "@/lib/services/plans";
import { ApiForm } from "@/components/ApiForm";
import { Notice, PageHeader, RG_LINE } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };
export default async function Checkout(props: { params: Promise<{ plan: string }> }) {
  const { plan: code } = await props.params;
  const user = await pageUser(`/checkout/${code}`);
  if (!/^[a-z0-9_]{3,40}$/.test(code)) notFound();
  const plan = await one<Plan>("select * from plans where code = $1 and active", [code]);
  if (!plan) notFound();
  const providers = enabledProviders();
  const card = providers.filter((p) => p.method === "card");
  const crypto = providers.find((p) => p.method === "crypto");
  return (
    <div className="wrap py-10 max-w-[720px] grid gap-6">
      <PageHeader eyebrow="Checkout" title={plan.name}>
        <span className="num text-ink text-[20px] font-semibold">{formatMoney(plan.amount_minor)}</span> {plan.is_lifetime ? "one-time payment for lifetime access." : `for ${plan.duration_days} days. One-time payment, no automatic renewal.`}
      </PageHeader>
      <section className="card p-5 grid gap-2"><h2 className="font-semibold">What you get</h2><ul className="grid gap-1.5 text-sm sm:grid-cols-2">{cardFeatures(plan.level).map((f) => <li key={f}>✓ {f}</li>)}</ul></section>
      {!user.email_verified_at && <Notice tone="warning" title="Verify your email first.">Check your inbox for the verification link, then come back here.</Notice>}
      {!providers.length && <Notice tone="warning" title="Checkout is not switched on yet.">No payment provider is connected. Please check back soon.</Notice>}
      {card.length > 0 && <section className="card p-6 grid gap-4"><h2 className="font-semibold text-[17px]">Pay by card</h2>
        <div className="flex flex-wrap gap-3">{card.map((p) => <ApiForm key={p.id} action="/api/billing/checkout" extra={{ planCode: plan.code, provider: p.id }} submitLabel={p.label} variant={p.id === card[0].id ? "accent" : "secondary"} className="grid gap-2" />)}</div>
        <p className="text-xs text-subtle">You will be sent to the provider&apos;s secure page. Card details never reach BETVANTA.</p></section>}
      {crypto && <section className="card p-6 grid gap-4"><h2 className="font-semibold text-[17px]">Pay with crypto</h2>
        <p className="text-sm text-muted">Priced in USD; you pay the equivalent in the coin you choose. Access starts once the network confirms the payment, which can take a few minutes. USDT is collected on the TRC-20 network.</p>
        <div className="flex flex-wrap gap-3">{(["BTC", "ETH", "USDT"] as const).map((c) => <ApiForm key={c} action="/api/billing/checkout" extra={{ planCode: plan.code, provider: crypto.id, payCurrency: c }} submitLabel={`Pay with ${c}`} variant="secondary" className="grid gap-2" />)}</div></section>}
      <p className="text-xs text-subtle">Subscription payments are for access to analysis only. BETVANTA does not take bets, deposits or withdrawals. {RG_LINE}</p>
      <Link href="/pricing" className="text-sm text-link font-semibold hover:underline">Back to plans</Link>
    </div>
  );
}
