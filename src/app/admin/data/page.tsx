import type { Metadata } from "next";
import { q } from "@/lib/db";
import { env, sampleDataAllowed } from "@/lib/env";
import { ActionButton } from "@/components/ActionButton";
import { Badge, fmtKickoff, Notice, PageHeader, SampleBadge } from "@/components/ui";
export const metadata: Metadata = { title: "Sports data" };
export default async function Data() {
  const fx = await q(`select f.*, c.name comp, ht.name home, at.name away from fixtures f join competitions c on c.id = f.competition_id join teams ht on ht.id = f.home_team_id join teams at on at.id = f.away_team_id
    where f.kickoff_at between now() - interval '4 days' and now() + interval '10 days' order by f.kickoff_at limit 150`);
  const source = env().API_FOOTBALL_KEY ? "API-Football (live data)" : sampleDataAllowed() ? "Sample league (fictional teams)" : "None configured";
  return (<>
    <PageHeader eyebrow="Admin" title="Sports data">Source: <strong>{source}</strong>. Syncing updates fixtures, results and team stats; it never edits published predictions.</PageHeader>
    {!env().API_FOOTBALL_KEY && sampleDataAllowed() && <div className="mb-4"><Notice tone="warning" title="Sample data in use.">Fixtures and stats are generated for a fictional league and labelled as sample data everywhere. Add API_FOOTBALL_KEY to switch to real data.</Notice></div>}
    <div className="flex gap-3 mb-6 flex-wrap"><ActionButton action="/api/admin/sync" label="Sync fixtures and results now" variant="primary" /></div>
    {fx.length ? <div className="card overflow-x-auto relative"><table className="table"><thead><tr><th>Kickoff</th><th>Competition</th><th>Match</th><th>Status</th><th>Score</th><th>Source</th></tr></thead><tbody>
      {fx.map((f) => <tr key={f.id}><td className="num whitespace-nowrap">{fmtKickoff(f.kickoff_at)}</td><td>{f.comp}</td><td>{f.home} vs {f.away}</td><td><Badge tone={f.status === "finished" ? "neutral" : f.status === "live" ? "copper" : "teal"}>{f.status}</Badge></td><td className="num">{f.home_goals ?? "-"}:{f.away_goals ?? "-"}</td><td>{f.data_source === "mock" ? <SampleBadge /> : "API-Football"}</td></tr>)}
    </tbody></table></div> : <Notice>No fixtures yet. Run a sync.</Notice>}
  </>);
}
