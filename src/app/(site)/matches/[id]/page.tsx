import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { one } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { tierFor } from "@/lib/services/entitlements";
import { listPredictions } from "@/lib/services/predictions";
import { matchStats } from "@/lib/services/sports";
import { MARKET_LABEL } from "@/lib/services/engine";
import { Confidence, fmtKickoff, Notice, RG_LINE, resultBadge, SampleBadge, tierBadge } from "@/components/ui";
export const dynamic = "force-dynamic";

export default async function Match(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const f = await one(`select f.*, c.name competition, ht.name home, at.name away from fixtures f join competitions c on c.id = f.competition_id
     join teams ht on ht.id = f.home_team_id join teams at on at.id = f.away_team_id where f.id = $1`, [params.id]);
  if (!f) notFound();
  const tier = await tierFor(await currentUser());
  const preds = await listPredictions(tier, { fixtureId: params.id });
  const analysis = preds.find((p) => p.analysis)?.analysis;
  const anyLocked = preds.some((p) => p.locked);
  const stats = await matchStats(params.id);
  const avg = (g: number, n: number) => (n ? (g / n).toFixed(2) : "n/a");
  return (
    <div className="wrap py-10 grid gap-8 max-w-[860px]">
      <div className="grid gap-2">
        <div className="flex gap-3 items-center flex-wrap"><span className="eyebrow">{f.competition}</span>{f.data_source === "mock" && <SampleBadge />}</div>
        <h1 className="display text-[28px] leading-[34px] font-bold">{f.home} vs {f.away}</h1>
        <p className="num text-sm text-subtle">{f.status === "finished" ? `Full time ${f.home_goals}-${f.away_goals}` : fmtKickoff(f.kickoff_at)}{f.venue ? ` · ${f.venue}` : ""}</p>
      </div>
      <section className="grid gap-3">
        <h2 className="font-semibold text-[17px]">Predictions</h2>
        {preds.length ? preds.map((p) => (
          <div key={p.id} className="card px-5 py-4 flex flex-wrap justify-between gap-3 items-center">
            <div><div className="text-xs text-muted">{MARKET_LABEL[p.market]}</div><div className="font-semibold">{p.selection ?? "Locked"}{p.probability && <span className="num text-xs text-subtle ml-2">{Math.round(Number(p.probability) * 100)}%</span>}</div></div>
            <div className="flex gap-2 items-center flex-wrap">{p.status === "settled" ? resultBadge(p.result) : <Confidence band={p.confidence} />}{tierBadge(p.access_tier)}</div>
          </div>)) : <Notice>No predictions are published for this match.</Notice>}
      </section>
      {stats && (stats.home || stats.away) && (
        <section className="grid gap-3">
          <h2 className="font-semibold text-[17px]">Statistics this season</h2>
          <div className="card overflow-x-auto relative"><table className="table"><thead><tr><th>Team</th><th className="text-right">Played</th><th className="text-right">Scored</th><th className="text-right">Conceded</th><th className="text-right">Goals per game</th><th>Form</th></tr></thead><tbody>
            <tr><td>{f.home} (home)</td><td className="num text-right">{stats.home?.home_played ?? 0}</td><td className="num text-right">{stats.home?.home_goals_for ?? 0}</td><td className="num text-right">{stats.home?.home_goals_against ?? 0}</td><td className="num text-right">{avg(stats.home?.home_goals_for ?? 0, stats.home?.home_played ?? 0)}</td><td className="num text-xs tracking-[.08em]">{stats.home?.form ?? ""}</td></tr>
            <tr><td>{f.away} (away)</td><td className="num text-right">{stats.away?.away_played ?? 0}</td><td className="num text-right">{stats.away?.away_goals_for ?? 0}</td><td className="num text-right">{stats.away?.away_goals_against ?? 0}</td><td className="num text-right">{avg(stats.away?.away_goals_for ?? 0, stats.away?.away_played ?? 0)}</td><td className="num text-xs tracking-[.08em]">{stats.away?.form ?? ""}</td></tr>
          </tbody></table></div>
          <h3 className="font-semibold mt-2">Head to head</h3>
          {stats.h2h.length ? <ul className="card divide-y divide-[var(--border)] text-sm">{stats.h2h.map((m, i) => <li key={i} className="px-4 py-2.5 flex justify-between gap-3"><span>{m.home} vs {m.away}</span><span className="num font-semibold">{m.home_goals}-{m.away_goals}</span></li>)}</ul> : <p className="text-sm text-muted">No previous meetings in our data.</p>}
          <p className="text-xs text-subtle">Form is the last five league results, latest first. Statistics come only from matches in our data feed.</p>
        </section>)}
      <section className="grid gap-3">
        <h2 className="font-semibold text-[17px]">Analysis</h2>
        {analysis ? <div className="card p-6 prose-bv text-[16px] leading-7">{analysis.split("\n\n").map((para, i) => <p key={i}>{para}</p>)}</div>
          : anyLocked ? <Notice tone="info" title="Analysis is for members.">Full analysis is included with Premium and VIP. <Link href="/packages" className="font-semibold text-link underline">See plans</Link>.</Notice>
          : <Notice>No analysis has been published for this match yet.</Notice>}
      </section>
      <p className="text-xs text-subtle">{RG_LINE}</p>
    </div>
  );
}
