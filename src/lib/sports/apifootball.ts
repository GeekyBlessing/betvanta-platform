import { env } from "../env";
import type { ProviderCompetition, ProviderFixture, SportsProvider } from "./types";
const STATUS: Record<string, ProviderFixture["status"]> = { TBD: "scheduled", NS: "scheduled", "1H": "live", HT: "live", "2H": "live", ET: "live", BT: "live", P: "live", LIVE: "live", INT: "live", FT: "finished", AET: "finished", PEN: "finished", PST: "postponed", CANC: "cancelled", ABD: "cancelled", AWD: "finished", WO: "finished", SUSP: "postponed" };
type ApiFixture = { fixture: { id: number; date: string; venue?: { name?: string }; status: { short: string } }; league: { id: number; name: string; country: string; season: number }; teams: { home: { id: number; name: string }; away: { id: number; name: string } }; goals: { home: number | null; away: number | null } };
const short = (n: string) => n.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase().padEnd(3, n[1]?.toUpperCase() ?? "X");

export const apiFootballProvider: SportsProvider = {
  source: "api-football",
  async fetchCompetitions() {
    const { API_FOOTBALL_KEY, API_FOOTBALL_LEAGUES, API_FOOTBALL_SEASON } = env();
    const out: ProviderCompetition[] = [];
    for (const league of API_FOOTBALL_LEAGUES.split(",").map((s) => s.trim()).filter(Boolean)) {
      const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=${encodeURIComponent(league)}&season=${API_FOOTBALL_SEASON}`, { headers: { "x-apisports-key": API_FOOTBALL_KEY! }, cache: "no-store" });
      const j = (await res.json()) as { response?: ApiFixture[]; errors?: unknown };
      if (!res.ok || !j.response) throw new Error(`API-Football error for league ${league}: ${JSON.stringify(j.errors ?? res.status)}`);
      if (!j.response.length) continue;
      const lg = j.response[0].league;
      out.push({
        ref: `af-${lg.id}-${lg.season}`, name: lg.name, country: lg.country, season: lg.season, sport: "football",
        fixtures: j.response.map((f) => ({
          ref: `af-${f.fixture.id}`, kickoff: f.fixture.date, venue: f.fixture.venue?.name ?? null, status: STATUS[f.fixture.status.short] ?? "scheduled",
          homeGoals: f.goals.home, awayGoals: f.goals.away,
          home: { ref: `af-t${f.teams.home.id}`, name: f.teams.home.name, short: short(f.teams.home.name) },
          away: { ref: `af-t${f.teams.away.id}`, name: f.teams.away.name, short: short(f.teams.away.name) },
        })),
      });
    }
    return out;
  },
};
