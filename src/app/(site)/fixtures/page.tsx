import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { q } from "@/lib/db";
import { listCompetitions, listFixtures } from "@/lib/services/sports";
import { FixtureList } from "@/components/FixtureList";
import { Notice, PageHeader } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fixtures and scores", description: "Match schedules, live scores and results across BETVANTA's covered leagues." };
const MODES = { upcoming: "Schedule", live: "Live", results: "Results" } as const;
export default async function Fixtures(props: { searchParams: Promise<{ mode?: string; league?: string; mine?: string }> }) {
  const sp = await props.searchParams;
  const mode = (sp.mode && sp.mode in MODES ? sp.mode : "upcoming") as keyof typeof MODES;
  const league = z.string().uuid().safeParse(sp.league).success ? sp.league : undefined;
  const u = await currentUser();
  const comps = await listCompetitions(u?.id ?? null);
  const mine = u && sp.mine === "1" ? (await q<{ competition_id: string }>("select competition_id from user_favourite_competitions where user_id = $1", [u.id])).map((r) => r.competition_id) : undefined;
  const rows = await listFixtures({ mode, competitionId: league, competitionIds: mine, limit: 200 });
  const href = (o: Record<string, string | undefined>) => "/fixtures?" + new URLSearchParams(Object.entries({ mode, league, mine: sp.mine, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div className="wrap py-10">
      <PageHeader eyebrow="Fixtures" title="Fixtures and scores">Times shown in West Africa Time (WAT).</PageHeader>
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="inline-flex p-1 gap-1 bg-sunken rounded-full border border-line" role="group" aria-label="View">
          {Object.entries(MODES).map(([k, v]) => <Link key={k} href={href({ mode: k })} aria-pressed={k === mode} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${k === mode ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>{v}</Link>)}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={href({ league: undefined, mine: undefined })} className={`btn btn-sm ${!league && !mine ? "btn-primary" : "btn-secondary"}`}>All leagues</Link>
          {u && <Link href={href({ league: undefined, mine: "1" })} className={`btn btn-sm ${mine ? "btn-primary" : "btn-secondary"}`}>My leagues</Link>}
          {comps.map((c) => <Link key={c.id} href={href({ league: c.id, mine: undefined })} className={`btn btn-sm ${league === c.id ? "btn-primary" : "btn-secondary"}`}>{c.name}</Link>)}
        </div>
      </div>
      {mine && !mine.length ? <Notice>You have not saved any leagues yet. <Link href="/sports" className="text-link font-semibold underline">Choose leagues</Link>.</Notice>
        : rows.length ? <FixtureList rows={rows} /> : <Notice>{mode === "live" ? "No matches are live right now." : "No fixtures to show."}</Notice>}
    </div>
  );
}
