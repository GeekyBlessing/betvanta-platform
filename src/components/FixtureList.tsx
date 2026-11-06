import Link from "next/link";
import type { FixtureRow } from "@/lib/services/sports";
import { Badge, SampleBadge } from "./ui";

const dayKey = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" }).format(new Date(iso));
const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));

/** Fixtures grouped by day. Times shown in WAT. */
export function FixtureList({ rows, showCompetition = true }: { rows: FixtureRow[]; showCompetition?: boolean }) {
  const days = new Map<string, FixtureRow[]>();
  for (const r of rows) days.set(dayKey(r.kickoff_at), [...(days.get(dayKey(r.kickoff_at)) ?? []), r]);
  return (
    <div className="grid gap-6">
      {[...days.entries()].map(([d, list]) => (
        <section key={d} className="grid gap-2">
          <h3 className="eyebrow">{d}</h3>
          <ul className="card divide-y divide-[var(--border)]">
            {list.map((f) => (
              <li key={f.id}>
                <Link href={`/matches/${f.id}`} className="grid grid-cols-[52px_1fr_auto] md:grid-cols-[64px_1fr_auto_auto] gap-3 items-center px-4 py-3 hover:bg-sunken">
                  <span className="num text-xs text-subtle">{f.status === "finished" ? "FT" : f.status === "live" ? <Badge tone="copper" dot>Live</Badge> : time(f.kickoff_at)}</span>
                  <span className="grid gap-1 min-w-0">
                    <span className="flex justify-between gap-3"><span className="truncate font-medium">{f.home}</span><span className="num font-semibold">{f.home_goals ?? ""}</span></span>
                    <span className="flex justify-between gap-3"><span className="truncate font-medium">{f.away}</span><span className="num font-semibold">{f.away_goals ?? ""}</span></span>
                    {showCompetition && <span className="text-xs text-subtle md:hidden">{f.competition}</span>}
                  </span>
                  {showCompetition && <span className="hidden md:block text-xs text-subtle max-w-[180px] truncate">{f.competition}</span>}
                  <span className="flex gap-2 justify-end items-center">{f.predictions > 0 && <Badge tone="teal">{f.predictions} picks</Badge>}{f.data_source === "mock" && <SampleBadge />}</span>
                </Link>
              </li>))}
          </ul>
        </section>))}
    </div>
  );
}
