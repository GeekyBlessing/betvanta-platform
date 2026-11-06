import type { Metadata } from "next";
import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { tierFor } from "@/lib/services/entitlements";
import { listPredictions } from "@/lib/services/predictions";
import { MARKET_LABEL } from "@/lib/services/engine";
import { fmtDate, Notice, PageHeader, resultBadge, tierBadge } from "@/components/ui";
export const metadata: Metadata = { title: "Prediction history" };
export default async function History() {
  const u = await pageUser("/dashboard/history");
  const rows = await listPredictions(await tierFor(u), { settled: true, limit: 200 });
  return (<><PageHeader eyebrow="History" title="Settled predictions">Every settled pick, newest first.</PageHeader>
    {rows.length ? <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Date</th><th>Match</th><th>Market</th><th>Pick</th><th>Score</th><th>Tier</th><th>Result</th></tr></thead><tbody>
      {rows.map((p) => <tr key={p.id}><td className="num whitespace-nowrap">{fmtDate(p.kickoff_at)}</td><td><Link href={`/matches/${p.fixture_id}`} className="hover:underline">{p.home} vs {p.away}</Link></td><td>{MARKET_LABEL[p.market]}</td><td>{p.selection}</td><td className="num">{p.home_goals}-{p.away_goals}</td><td>{tierBadge(p.access_tier)}</td><td>{resultBadge(p.result)}</td></tr>)}
    </tbody></table></div> : <Notice>No predictions have settled yet.</Notice>}</>);
}
