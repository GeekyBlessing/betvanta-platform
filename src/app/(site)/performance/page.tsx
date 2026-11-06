import type { Metadata } from "next";
import { performance, listPredictions } from "@/lib/services/predictions";
import { MARKET_LABEL } from "@/lib/services/engine";
import { FixtureCard, groupByFixture } from "@/components/PredictionCard";
import { Notice, PageHeader, Stat } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Performance", description: "BETVANTA's settled prediction record. Picks lock at kickoff and settle against the final score." };
const rate = (w: number, l: number) => (w + l ? `${((w / (w + l)) * 100).toFixed(1)}%` : "n/a");
export default async function Performance() {
  const rows = await performance();
  const total = rows.find((r) => !r.market && !r.access_tier);
  const byMarket = rows.filter((r) => r.market);
  const recent = groupByFixture(await listPredictions("free", { settled: true, limit: 60 })).slice(0, 8);
  const w = Number(total?.won ?? 0), l = Number(total?.lost ?? 0);
  return (
    <div className="wrap py-10 grid gap-8">
      <PageHeader eyebrow="Track record" title="Performance">Computed only from settled predictions. Every pick is published before kickoff and cannot be changed afterwards. Void results are excluded from the hit rate.</PageHeader>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Stat label="Settled" value={String(w + l + Number(total?.void ?? 0))} /><Stat label="Won" value={String(w)} /><Stat label="Lost" value={String(l)} /><Stat label="Hit rate" value={rate(w, l)} foot="Settled picks only" />
      </div>
      {byMarket.length > 0 && <div className="card overflow-x-auto relative"><table className="table"><thead><tr><th>Market</th><th className="text-right">Won</th><th className="text-right">Lost</th><th className="text-right">Hit rate</th></tr></thead>
        <tbody>{byMarket.map((r) => <tr key={r.market}><td>{MARKET_LABEL[r.market]}</td><td className="num text-right">{r.won}</td><td className="num text-right">{r.lost}</td><td className="num text-right">{rate(+r.won, +r.lost)}</td></tr>)}</tbody></table></div>}
      <section className="grid gap-4"><h2 className="font-semibold text-[17px]">Recently settled</h2>
        {recent.length ? <div className="grid gap-4 md:grid-cols-2">{recent.map((g) => <FixtureCard key={g[0].fixture_id} preds={g} />)}</div> : <Notice>No predictions have settled yet.</Notice>}</section>
    </div>
  );
}
