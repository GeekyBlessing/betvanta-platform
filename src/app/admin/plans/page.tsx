import type { Metadata } from "next";
import { pageRole } from "@/lib/auth";
import { q } from "@/lib/db";
import { formatMoney, type Plan } from "@/lib/services/billing";
import { cardFeatures } from "@/lib/services/plans";
import { ApiForm, Check, Field } from "@/components/ApiForm";
import { Badge, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Plans" };
export default async function Plans() {
  await pageRole("/admin/plans", "admin");
  const plans = await q<Plan>("select * from plans where active or exists (select 1 from subscriptions s where s.plan_id = plans.id) order by active desc, level, sort");
  return (<>
    <PageHeader eyebrow="Admin" title="Plans and prices">Five client-confirmed plans in USD. Price changes apply to new checkouts only; existing subscriptions keep the price and duration they were bought with. Features are fixed by the plan level.</PageHeader>
    <div className="grid gap-4 md:grid-cols-2">{plans.map((p) => (
      <section key={p.id} className={`card p-5 grid gap-3 ${p.active ? "" : "opacity-70"}`}>
        <div className="flex flex-wrap gap-2 items-center"><h2 className="font-semibold">{p.name}</h2><Badge tone="teal">Level {p.level}</Badge>{p.best_value && <Badge tone="copper">Best value</Badge>}{!p.active && <Badge>Retired</Badge>}<span className="text-xs text-subtle ml-auto">{p.is_lifetime ? "Lifetime" : `${p.duration_days} days`} · now {formatMoney(p.amount_minor)}</span></div>
        <ul className="text-xs text-muted grid gap-1">{cardFeatures(p.level).map((f) => <li key={f}>✓ {f}</li>)}</ul>
        {p.active && <ApiForm action={`/api/admin/plans/${p.id}`} method="PATCH" submitLabel="Save plan" size="sm" className="grid gap-3">
          <Field label="Price (USD)" name="amountUsd" type="number" min={1} step="0.01" defaultValue={String(Number(p.amount_minor) / 100)} required />
          <Field label="Tagline" name="tagline" defaultValue={p.tagline ?? ""} maxLength={80} />
          <Check name="active" defaultChecked={p.active}>Available for purchase</Check>
        </ApiForm>}
      </section>))}</div>
  </>);
}
