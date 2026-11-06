import { notFound } from "next/navigation";
import { z } from "zod";
import { one } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { listFixtures, standings } from "@/lib/services/sports";
import { FixtureList } from "@/components/FixtureList";
import { FavouriteToggle } from "@/components/FavouriteToggle";
import { Notice, PageHeader, SampleBadge } from "@/components/ui";
export const dynamic = "force-dynamic";
export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!z.string().uuid().safeParse(id).success) return {};
  const c = await one("select name from competitions where id = $1", [id]);
  return c ? { title: `${c.name} table and fixtures` } : {};
}
export default async function League(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const c = await one("select * from competitions where id = $1", [id]);
  if (!c) notFound();
  const u = await currentUser();
  const fav = u ? Boolean(await one("select 1 from user_favourite_competitions where user_id = $1 and competition_id = $2", [u.id, id])) : false;
  const [table, upcoming, results] = await Promise.all([standings(id), listFixtures({ competitionId: id, mode: "upcoming", limit: 20 }), listFixtures({ competitionId: id, mode: "results", limit: 10 })]);
  return (
    <div className="wrap py-10 grid gap-8">
      <div className="flex flex-wrap justify-between gap-4 items-start">
        <PageHeader eyebrow={`${c.country} · ${c.season}`} title={c.name}>{c.data_source === "mock" ? "Sample league with fictional teams, used until a live data feed is connected." : "Data from API-Football."}</PageHeader>
        <div className="flex gap-2 items-center">{c.data_source === "mock" && <SampleBadge />}{u && <FavouriteToggle competitionId={c.id} initial={fav} />}</div>
      </div>
      <section className="grid gap-3"><h2 className="font-semibold text-[17px]">Table</h2>
        {table.length ? <div className="card overflow-x-auto"><table className="table"><thead><tr><th>#</th><th>Team</th><th className="text-right">P</th><th className="text-right">W</th><th className="text-right">D</th><th className="text-right">L</th><th className="text-right">GF</th><th className="text-right">GA</th><th className="text-right">GD</th><th className="text-right">Pts</th><th>Form</th></tr></thead><tbody>
          {table.map((t, i) => <tr key={t.team_id}><td className="num">{i + 1}</td><td className="font-medium whitespace-nowrap">{t.team}</td>{[t.p, t.w, t.d, t.l, t.gf, t.ga, t.gd > 0 ? `+${t.gd}` : t.gd].map((v, k) => <td key={k} className="num text-right">{v}</td>)}<td className="num text-right font-semibold">{t.pts}</td><td className="num text-xs tracking-[.08em] text-subtle">{t.form ?? ""}</td></tr>)}
        </tbody></table></div> : <Notice>No completed matches yet.</Notice>}
      </section>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="grid gap-3 content-start"><h2 className="font-semibold text-[17px]">Upcoming</h2>{upcoming.length ? <FixtureList rows={upcoming} showCompetition={false} /> : <Notice>No upcoming fixtures.</Notice>}</section>
        <section className="grid gap-3 content-start"><h2 className="font-semibold text-[17px]">Recent results</h2>{results.length ? <FixtureList rows={results} showCompetition={false} /> : <Notice>No results yet.</Notice>}</section>
      </div>
    </div>
  );
}
