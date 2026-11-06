import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { listCompetitions, SPORTS } from "@/lib/services/sports";
import { FavouriteToggle } from "@/components/FavouriteToggle";
import { Badge, PageHeader, SampleBadge } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sports and leagues", description: "Choose a sport and league to follow on BETVANTA." };
export default async function Sports() {
  const u = await currentUser();
  const comps = await listCompetitions(u?.id ?? null);
  return (
    <div className="wrap py-10">
      <PageHeader eyebrow="Coverage" title="Sports and leagues">Pick the leagues you follow. Signed-in members can save them to filter their dashboard.</PageHeader>
      <div className="grid gap-8">
        {SPORTS.map((s) => {
          const list = comps.filter((c) => c.sport === s.id);
          return (
            <section key={s.id} className="grid gap-3">
              <div className="flex items-center gap-3"><h2 className="display text-[22px] font-bold">{s.name}</h2>{!list.length && <Badge>No data feed connected yet</Badge>}</div>
              {list.length > 0 && <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{list.map((c) => (
                <div key={c.id} className="card p-5 grid gap-3">
                  <div className="flex justify-between gap-3 items-start"><div><Link href={`/leagues/${c.id}`} className="font-semibold text-[17px] hover:underline">{c.name}</Link><div className="text-sm text-subtle">{c.country} · {c.season}</div></div>{c.data_source === "mock" && <SampleBadge />}</div>
                  <div className="text-sm text-muted">{c.upcoming} upcoming fixtures</div>
                  <div className="flex gap-2 flex-wrap"><Link href={`/leagues/${c.id}`} className="btn btn-secondary btn-sm">Table and fixtures</Link>{u && <FavouriteToggle competitionId={c.id} initial={c.favourite} />}</div>
                </div>))}</div>}
            </section>);
        })}
      </div>
    </div>
  );
}
