import type { Metadata } from "next";
import { pageRole } from "@/lib/auth";
import { q } from "@/lib/db";
import type { Plan } from "@/lib/services/billing";
import { ApiForm, Check, Field } from "@/components/ApiForm";
import { Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Plans" };
export default async function Plans() {
  await pageRole("/admin/plans", "admin");
  const plans = await q<Plan>("select * from plans order by sort");
  return (<>
    <PageHeader eyebrow="Admin" title="Plans and prices" />
    <div className="mb-6"><Notice tone="warning" title="Placeholder prices.">The starting prices were set as placeholders. Set your real prices here before taking live payments.</Notice></div>
    <div className="grid gap-4 md:grid-cols-2">{plans.map((p) => (
      <section key={p.id} className="card p-5 grid gap-3"><h2 className="font-semibold">{p.name} · <span className="capitalize">{p.interval}</span> <span className="text-xs text-subtle">({p.duration_days} days, {p.currency})</span></h2>
        <ApiForm action={`/api/admin/plans/${p.id}`} method="PATCH" submitLabel="Save plan" size="sm" className="grid gap-3">
          <Field label={`Price (${p.currency}, whole units)`} name="amountMajor" type="number" min={100} defaultValue={String(Number(p.amount_minor) / 100)} required />
          <div className="grid gap-1.5"><label className="label" htmlFor={`feat-${p.id}`}>Features, one per line</label><textarea id={`feat-${p.id}`} name="features" rows={3} className="input" defaultValue={p.features.join("\n")} data-keep-empty="1" /></div>
          <Check name="active" defaultChecked={p.active}>Available for purchase</Check>
        </ApiForm></section>))}</div>
  </>);
}
