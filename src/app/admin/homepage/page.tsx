import type { Metadata } from "next";
import Link from "next/link";
import { pageRole } from "@/lib/auth";
import { homeStats } from "@/lib/services/stats";
import { listHomepageStats, liveValue } from "@/lib/services/homepage-stats";
import { ApiForm, Check } from "@/components/ApiForm";
import { Badge, fmtDate, Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Homepage statistics" };

export default async function HomepageStatsAdmin() {
  await pageRole("/admin/homepage", "admin");
  const [rows, live] = await Promise.all([listHomepageStats(), homeStats()]);
  return (<>
    <PageHeader eyebrow="Admin" title="Homepage statistics">
      The four figures in the homepage hero. Each one shows either a figure you enter, or the live figure from BETVANTA&apos;s own records.
      An entered figure appears on the site <strong>only after you mark it verified</strong> and record the evidence. Until then the homepage shows the live figure from BETVANTA&apos;s records in its place.
    </PageHeader>
    <Notice tone="warning" title="Advertising claims.">
      A win rate or results claim shown to US customers has to be truthful and substantiated. Mark a figure verified only when you hold the evidence
      (for example an independent audit of settled picks), and describe it below. The graded record on the <Link href="/performance" className="underline">Performance</Link> page is always live.
    </Notice>
    <div className="grid gap-4 mt-6 lg:grid-cols-2">{rows.map((r) => {
      const lv = liveValue(r.key, live);
      const id = (n: string) => `hs-${r.key}-${n}`;
      return (
        <section key={r.key} className="card p-5 grid gap-4 content-start" aria-labelledby={id("h")}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={id("h")} className="font-semibold">{r.label}</h2>
            {r.source === "live" ? <Badge tone="teal">Live from records</Badge> : r.verification === "verified" ? <Badge tone="success" dot>Verified</Badge> : <Badge tone="warning" dot>Unverified, not shown</Badge>}
            {!r.visible && <Badge>Hidden</Badge>}
            <span className="text-xs text-subtle ml-auto">Updated {fmtDate(r.updated_at)}{r.updated_by_name ? ` by ${r.updated_by_name}` : ""}</span>
          </div>
          <p className="text-sm text-muted">Live figure right now: <span className="num font-semibold text-ink">{lv.value}</span>{lv.note ? ` (${lv.note})` : ""}</p>
          {r.verification === "verified" && r.source === "manual" && <p className="text-xs text-muted">Verified {r.verified_at ? fmtDate(r.verified_at) : ""}{r.verified_by_name ? ` by ${r.verified_by_name}` : ""}: {r.verification_note}</p>}
          <ApiForm action={`/api/admin/homepage-stats/${r.key}`} method="PATCH" submitLabel="Save" size="sm" className="grid gap-3">
            <fieldset className="grid gap-2">
              <legend className="label mb-1">Show on the homepage</legend>
              <label className="flex gap-2 items-center text-sm"><input type="radio" name="source" value="manual" defaultChecked={r.source === "manual"} className="accent-[var(--primary)]" />The figure I enter below</label>
              <label className="flex gap-2 items-center text-sm"><input type="radio" name="source" value="live" defaultChecked={r.source === "live"} className="accent-[var(--primary)]" />The live figure from BETVANTA&apos;s records</label>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><label htmlFor={id("v")} className="label">Figure</label><input id={id("v")} name="value" className="input num" defaultValue={r.value_text} maxLength={16} required aria-describedby={id("vh")} /><span id={id("vh")} className="text-[13px] text-subtle">For example 2,000+ or 58.4%</span></div>
              <div className="grid gap-1.5"><label htmlFor={id("l")} className="label">Label</label><input id={id("l")} name="label" className="input" defaultValue={r.label} maxLength={40} required /></div>
            </div>
            <fieldset className="grid gap-2">
              <legend className="label mb-1">Verification of the entered figure</legend>
              <label className="flex gap-2 items-center text-sm"><input type="radio" name="verification" value="unverified" defaultChecked={r.verification === "unverified"} className="accent-[var(--primary)]" />Not yet verified (not shown publicly; the live figure is shown instead)</label>
              <label className="flex gap-2 items-center text-sm"><input type="radio" name="verification" value="verified" defaultChecked={r.verification === "verified"} className="accent-[var(--primary)]" />Independently verified</label>
            </fieldset>
            <div className="grid gap-1.5"><label htmlFor={id("n")} className="label">How it was verified</label>
              <textarea id={id("n")} name="verificationNote" className="input min-h-[72px]" maxLength={280} defaultValue={r.verification_note ?? ""} aria-describedby={id("nh")} />
              <span id={id("nh")} className="text-[13px] text-subtle">Required to mark a figure verified: source, who checked it and when. Kept in the audit log.</span>
            </div>
            <Check name="visible" defaultChecked={r.visible}>Show this statistic on the homepage</Check>
          </ApiForm>
        </section>);
    })}</div>
  </>);
}
