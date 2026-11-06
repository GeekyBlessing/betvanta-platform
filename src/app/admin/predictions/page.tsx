import type { Metadata } from "next";
import Link from "next/link";
import { q } from "@/lib/db";
import { aiEnabled } from "@/lib/env";
import { MARKET_LABEL } from "@/lib/services/engine";
import { ActionButton } from "@/components/ActionButton";
import { Confidence, fmtKickoff, Notice, PageHeader, resultBadge, SampleBadge, tierBadge } from "@/components/ui";
export const metadata: Metadata = { title: "Admin predictions" };
const TIERS = ["free", "premium", "vip"] as const;
export default async function AdminPredictions() {
  const rows = await q(`select p.*, f.kickoff_at, f.data_source, ht.name home, at.name away from predictions p join fixtures f on f.id = p.fixture_id
    join teams ht on ht.id = f.home_team_id join teams at on at.id = f.away_team_id
    where p.status <> 'settled' or p.settled_at > now() - interval '3 days' order by f.kickoff_at, p.market limit 300`);
  const drafts = rows.filter((r) => r.status === "draft");
  return (<>
    <PageHeader eyebrow="Admin" title="Predictions">Review engine drafts, choose who can see them, and publish before kickoff. Published picks lock at kickoff.</PageHeader>
    <div className="flex gap-3 flex-wrap mb-6"><ActionButton action="/api/admin/engine" label="Generate drafts from data" variant="primary" /><ActionButton action="/api/admin/settle" label="Settle finished matches" /></div>
    {!rows.length && <Notice>No predictions yet. Sync sports data, then generate drafts.</Notice>}
    {drafts.length > 0 && <h2 className="font-semibold text-[17px] mb-3">Drafts ({drafts.length})</h2>}
    <div className="grid gap-3">
      {rows.map((p) => (
        <div key={p.id} className="card p-4 grid gap-3">
          <div className="flex flex-wrap justify-between gap-2 items-baseline">
            <Link href={`/matches/${p.fixture_id}`} className="font-semibold hover:underline">{p.home} vs {p.away}</Link>
            <span className="num text-xs text-subtle">{fmtKickoff(p.kickoff_at)}</span>
          </div>
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <span className="text-muted">{MARKET_LABEL[p.market]}:</span><strong>{p.selection}</strong><span className="num text-xs">{Math.round(Number(p.probability) * 100)}%</span>
            <Confidence band={p.confidence} />{tierBadge(p.access_tier)}
            {p.status === "settled" ? resultBadge(p.result) : <span className="text-xs font-semibold uppercase tracking-wide text-subtle">{p.status}</span>}
            {p.analysis_source && <span className="text-xs text-subtle">analysis: {p.analysis_source}</span>}
            {p.data_source === "mock" && <SampleBadge />}
          </div>
          {p.status === "draft" && new Date(p.kickoff_at) > new Date() && (
            <div className="flex flex-wrap gap-2 items-center">
              {TIERS.map((t) => <ActionButton key={t} action={`/api/admin/predictions/${p.id}`} method="PATCH" payload={{ action: "publish", accessTier: t }} label={`Publish as ${t === "vip" ? "VIP" : t}`} variant={t === p.access_tier ? "primary" : "secondary"} />)}
              {aiEnabled() && <ActionButton action={`/api/admin/predictions/${p.id}`} method="PATCH" payload={{ action: "ai" }} label="Add AI analysis" />}
              <ActionButton action={`/api/admin/predictions/${p.id}`} method="PATCH" payload={{ action: "delete" }} label="Discard" confirmText="Confirm discard" variant="ghost" />
            </div>)}
        </div>))}
    </div>
  </>);
}
