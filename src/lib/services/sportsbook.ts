import { q } from "../db";
import { canAccess, type Tier } from "./entitlements";
import { predict } from "./engine";
import { matchModelInput } from "./predictions";
import { sportById } from "./sports";

/**
 * The sportsbook board. Prices are BETVANTA model prices (1 / model probability), shown only for markets BETVANTA has
 * published a pick on, and only to viewers whose plan includes that pick. For everyone else the market is "locked" and no
 * price leaves the server, so a premium pick can never be read off the prices. Nothing here is a bookmaker's odds, and
 * nothing can be staked: real-money betting is disabled.
 */
export type MarketKey = "1X2" | "OU25" | "BTTS";
export type Outcome = { key: string; label: string; price: number | null };
export type Market =
  | { key: MarketKey; state: "open"; outcomes: Outcome[] }
  | { key: MarketKey; state: "locked"; tier: Tier }
  | { key: MarketKey; state: "unavailable" };
export type BoardMatch = {
  id: string; kickoff_at: string; status: string; home_goals: number | null; away_goals: number | null; sample: boolean;
  competition_id: string; competition: string; country: string; sport: string;
  home: string; home_short: string; away: string; away_short: string; markets: Record<MarketKey, Market>;
};
export const MARKETS: { key: MarketKey; label: string; short: string; outcomes: { key: string; label: string }[] }[] = [
  { key: "1X2", label: "Match result", short: "1X2", outcomes: [{ key: "home", label: "1" }, { key: "draw", label: "X" }, { key: "away", label: "2" }] },
  { key: "OU25", label: "Total goals 2.5", short: "O/U 2.5", outcomes: [{ key: "over", label: "Over" }, { key: "under", label: "Under" }] },
  { key: "BTTS", label: "Both teams to score", short: "GG/NG", outcomes: [{ key: "yes", label: "GG" }, { key: "no", label: "NG" }] },
];
const price = (p: number) => (p > 0.01 ? Math.round((1 / p) * 100) / 100 : null);

type Row = Omit<BoardMatch, "markets" | "sample"> & { data_source: string };
async function loadMatches(where: string, params: unknown[], limit: number): Promise<Row[]> {
  params.push(limit);
  return q<Row>(
    `select f.id, f.kickoff_at, f.status, f.home_goals, f.away_goals, f.data_source, c.id competition_id, c.name competition, c.country, c.sport,
       ht.name home, ht.short_name home_short, at.name away, at.short_name away_short
     from fixtures f join competitions c on c.id = f.competition_id and c.active
     join teams ht on ht.id = f.home_team_id join teams at on at.id = f.away_team_id
     where ${where} order by f.kickoff_at asc limit $${params.length}`, params);
}

async function withMarkets(rows: Row[], tier: Tier): Promise<BoardMatch[]> {
  if (!rows.length) return [];
  const published = await q<{ fixture_id: string; market: MarketKey; access_tier: Tier }>(
    `select fixture_id, market, access_tier from predictions where status = 'published' and fixture_id = any($1::uuid[])`, [rows.map((r) => r.id)]);
  const byFixture = new Map<string, Map<MarketKey, Tier>>();
  for (const p of published) {
    const m = byFixture.get(p.fixture_id) ?? new Map<MarketKey, Tier>();
    m.set(p.market, p.access_tier); byFixture.set(p.fixture_id, m);
  }
  return Promise.all(rows.map(async (r): Promise<BoardMatch> => {
    const pub = byFixture.get(r.id);
    const closed = r.status !== "scheduled" || new Date(r.kickoff_at) <= new Date();
    const markets = {} as Record<MarketKey, Market>;
    // Prices are computed only when at least one market is both published and open to this viewer.
    const needModel = !closed && pub && [...pub.values()].some((t) => canAccess(tier, t));
    const out = needModel ? predict((await matchModelInput(r.id)).input) : null;
    for (const m of MARKETS) {
      const t = pub?.get(m.key);
      if (closed || !t) { markets[m.key] = { key: m.key, state: "unavailable" }; continue; }
      if (!canAccess(tier, t)) { markets[m.key] = { key: m.key, state: "locked", tier: t }; continue; }
      if (!out) { markets[m.key] = { key: m.key, state: "unavailable" }; continue; }
      const p = out.probs;
      const probs: Record<string, number> = m.key === "1X2" ? { home: p.home, draw: p.draw, away: p.away }
        : m.key === "OU25" ? { over: p.over25, under: 1 - p.over25 } : { yes: p.bttsYes, no: 1 - p.bttsYes };
      markets[m.key] = { key: m.key, state: "open", outcomes: m.outcomes.map((o) => ({ ...o, price: price(probs[o.key]) })) };
    }
    const { data_source, ...rest } = r;
    return { ...rest, sample: data_source === "mock", markets };
  }));
}

export async function sportsbookBoard(tier: Tier, opts: { sport?: string; competitionId?: string; window?: "today" | "3h" } = {}) {
  const filters: string[] = []; const params: unknown[] = [];
  if (opts.sport) { params.push(opts.sport); filters.push(`c.sport = $${params.length}`); }
  if (opts.competitionId) { params.push(opts.competitionId); filters.push(`c.id = $${params.length}`); }
  const extra = filters.length ? ` and ${filters.join(" and ")}` : "";
  const horizon = opts.window === "3h" ? "interval '3 hours'" : opts.window === "today" ? "interval '24 hours'" : "interval '7 days'";
  const [upcomingRows, liveRows, competitions] = await Promise.all([
    loadMatches(`f.status = 'scheduled' and f.kickoff_at > now() and f.kickoff_at < now() + ${horizon}${extra}`, [...params], 60),
    loadMatches(`f.status = 'live'${extra}`, [...params], 20),
    q<{ id: string; name: string; country: string; sport: string; upcoming: number }>(
      `select c.id, c.name, c.country, c.sport, count(f.id) filter (where f.status = 'scheduled' and f.kickoff_at > now())::int upcoming
       from competitions c join fixtures f on f.competition_id = c.id where c.active group by c.id order by upcoming desc, c.name limit 12`),
  ]);
  const [upcoming, live] = await Promise.all([withMarkets(upcomingRows, tier), withMarkets(liveRows, tier)]);
  // Featured: published, priced matches first (soonest first), then the next kickoffs.
  const priced = upcoming.filter((m) => Object.values(m.markets).some((x) => x.state !== "unavailable"));
  const featured = [...priced, ...upcoming.filter((m) => !priced.includes(m))].slice(0, 8);
  return { featured, live, upcoming, competitions: competitions.map((c) => ({ ...c, sportName: sportById(c.sport)?.name ?? c.sport })), sample: [...upcoming, ...live].some((m) => m.sample) };
}

/** Header search: teams, competitions and their next fixtures. */
export async function searchSportsbook(term: string) {
  const t = `%${term.trim().replace(/[%_]/g, "")}%`;
  if (term.trim().length < 2) return { competitions: [], matches: [] };
  const [competitions, matches] = await Promise.all([
    q<{ id: string; name: string; country: string; sport: string }>("select id, name, country, sport from competitions where active and (name ilike $1 or country ilike $1) order by name limit 10", [t]),
    loadMatches(`f.kickoff_at > now() - interval '3 hours' and (ht.name ilike $1 or at.name ilike $1 or c.name ilike $1)`, [t], 20),
  ]);
  return { competitions, matches };
}
