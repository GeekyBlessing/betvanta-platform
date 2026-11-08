import { one } from "../db";
import type { Tier } from "./entitlements";
import { listPredictions, performance, type PublicPrediction } from "./predictions";
import { listFixtures, type FixtureRow } from "./sports";
import { MIN_SETTLED_FOR_RATE } from "./stats";

/**
 * Everything the homepage dashboard shows, read from the database in one place. Every number here is a count of real
 * records; nothing is estimated, padded or typed in by hand. Rows from the development data source are flagged.
 */
export type DashboardRecord = {
  settled: number; won: number; lost: number; voided: number; winRate: number | null; neededForRate: number;
  upcoming7d: number; leagues: number; sports: number;
};
export type MarketRecord = { market: string; won: number; lost: number; void: number };

const TZ = () => process.env.APP_TIMEZONE || "America/New_York";
export const dayKey = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ(), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));

export async function dashboardRecord(sport?: string): Promise<DashboardRecord> {
  const r = await one<{ won: number; lost: number; voided: number; upcoming: number; leagues: number; sports: number }>(`select
      (select count(*)::int from predictions p join fixtures f on f.id = p.fixture_id join competitions c on c.id = f.competition_id where p.status = 'settled' and p.result = 'won' and ($1::text is null or c.sport = $1)) won,
      (select count(*)::int from predictions p join fixtures f on f.id = p.fixture_id join competitions c on c.id = f.competition_id where p.status = 'settled' and p.result = 'lost' and ($1::text is null or c.sport = $1)) lost,
      (select count(*)::int from predictions p join fixtures f on f.id = p.fixture_id join competitions c on c.id = f.competition_id where p.status = 'settled' and p.result = 'void' and ($1::text is null or c.sport = $1)) voided,
      (select count(*)::int from fixtures f join competitions c on c.id = f.competition_id where f.status = 'scheduled' and f.kickoff_at > now() and f.kickoff_at < now() + interval '7 days' and c.active and ($1::text is null or c.sport = $1)) upcoming,
      (select count(distinct c.id)::int from competitions c where c.active and ($1::text is null or c.sport = $1) and exists (select 1 from fixtures f where f.competition_id = c.id)) leagues,
      (select count(distinct c.sport)::int from competitions c where c.active and exists (select 1 from fixtures f where f.competition_id = c.id)) sports`, [sport ?? null]);
  const decided = r!.won + r!.lost;
  return {
    settled: decided + r!.voided, won: r!.won, lost: r!.lost, voided: r!.voided,
    winRate: decided >= MIN_SETTLED_FOR_RATE ? (r!.won / decided) * 100 : null, neededForRate: Math.max(0, MIN_SETTLED_FOR_RATE - decided),
    upcoming7d: r!.upcoming, leagues: r!.leagues, sports: r!.sports,
  };
}

/** Upcoming fixtures with their published picks, best-covered first (most markets, then soonest). */
export function featuredFixtures(preds: PublicPrediction[], n: number) {
  const byFixture = new Map<string, PublicPrediction[]>();
  for (const p of preds) byFixture.set(p.fixture_id, [...(byFixture.get(p.fixture_id) ?? []), p]);
  return [...byFixture.values()]
    .sort((a, b) => (b.some((p) => !p.locked) ? 1 : 0) - (a.some((p) => !p.locked) ? 1 : 0) || +new Date(a[0].kickoff_at) - +new Date(b[0].kickoff_at))
    .slice(0, n);
}

export async function homeDashboard(tier: Tier, sport?: string) {
  const [record, upcomingPreds, upcoming, live, results, settledPicks, perf, sample] = await Promise.all([
    dashboardRecord(sport),
    listPredictions(tier, { upcoming: true, limit: 60, sport }),
    listFixtures({ mode: "upcoming", limit: 60, sport }),
    listFixtures({ mode: "live", limit: 10, sport }),
    listFixtures({ mode: "results", limit: 8, sport }),
    listPredictions(tier, { settled: true, limit: 12, sport }),
    performance(),
    one<{ n: number }>("select count(*)::int n from competitions where active and data_source = 'mock'"),
  ]);
  const today = dayKey(new Date());
  const todays = upcoming.filter((f) => dayKey(f.kickoff_at) === today);
  // If nothing kicks off today, show the next matchday instead of an empty table, and say so.
  const nextDay = todays.length ? today : upcoming[0] ? dayKey(upcoming[0].kickoff_at) : null;
  const fixtures: FixtureRow[] = todays.length ? todays : upcoming.filter((f) => nextDay && dayKey(f.kickoff_at) === nextDay);
  const byMarket: MarketRecord[] = perf.filter((r) => r.market && !r.access_tier).map((r) => ({ market: r.market, won: Number(r.won), lost: Number(r.lost), void: Number(r.void) }));
  return {
    record, featured: featuredFixtures(upcomingPreds, 4), fixtures: fixtures.slice(0, 12), fixturesAreToday: todays.length > 0, fixturesDay: nextDay,
    live, results, settledPicks, byMarket, sampleData: (sample?.n ?? 0) > 0,
  };
}

