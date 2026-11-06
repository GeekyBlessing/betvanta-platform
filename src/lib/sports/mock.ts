import type { ProviderCompetition, ProviderFixture, SportsProvider } from "./types";
// Development and demo data only. Fictional leagues and teams, so no statistic can be mistaken for a real record.
// Every row is stored with data_source = 'mock' and labelled "Sample data" in the UI.
type Sport = NonNullable<ProviderCompetition["sport"]>;
const LEAGUES: { sport: Sport; ref: string; idPrefix?: string; name: string; teams: [string, string][]; score: (r: () => number, h: number, a: number) => [number, number]; draws: boolean }[] = [
  { sport: "football", ref: "mock-league", idPrefix: "mock", name: "Sample League", draws: true, // ids kept stable from the first release
    teams: [["Harbor City FC", "HAR"], ["Summit United", "SUM"], ["Riverside Rovers", "RIV"], ["Ironwood Athletic", "IRO"], ["Lakeshore FC", "LAK"], ["Granite Bay SC", "GRA"], ["Prairie Wolves", "PRA"], ["Bayview Mariners", "BAY"], ["Canyon Rangers", "CAN"], ["Northgate City", "NOR"]],
    score: (r, h, a) => [poisson(r, 1.45 * h / a ** 0.5), poisson(r, 1.1 * a / h ** 0.5)] },
  { sport: "american_football", ref: "mock-gridiron", name: "Sample Gridiron League", draws: false,
    teams: [["Delta Drivers", "DEL"], ["Ridge Rams", "RID"], ["Coastline Captains", "COA"], ["Plains Pioneers", "PLA"], ["Metro Mustangs", "MET"], ["Valley Voyagers", "VAL"], ["Highland Hawks", "HIG"], ["Bay Breakers", "BRK"]],
    score: (r, h, a) => [3 * poisson(r, 2.4 * h) + 7 * poisson(r, 1.4 * h), 3 * poisson(r, 2.2 * a) + 7 * poisson(r, 1.3 * a)] },
  { sport: "basketball", ref: "mock-hoops", name: "Sample Hoops League", draws: false,
    teams: [["Downtown Dynamos", "DYN"], ["Lakeside Lights", "LIT"], ["Summit Spires", "SPI"], ["Harbor Herons", "HER"], ["Canyon Comets", "COM"], ["Prairie Pulse", "PUL"], ["Metro Monarchs", "MON"], ["Northern Nomads", "NOM"]],
    score: (r, h, a) => [Math.round(102 + 14 * (h - 1) + (r() - 0.5) * 30), Math.round(99 + 14 * (a - 1) + (r() - 0.5) * 30)] },
  { sport: "baseball", ref: "mock-diamond", name: "Sample Diamond League", draws: false,
    teams: [["River City Rivets", "RCR"], ["Pine Grove Pilots", "PGP"], ["Bayfront Beacons", "BBC"], ["Iron Hill Owls", "IHO"], ["Sunset Sluggers", "SUN"], ["Glacier Gulls", "GLA"], ["Copperline Kings", "CPK"], ["Redwood Rockets", "RED"]],
    score: (r, h, a) => [poisson(r, 4.5 * h), poisson(r, 4.2 * a)] },
];
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
function poisson(r: () => number, mean: number) { let g = 0, p = 1; const L = Math.exp(-mean); do { g++; p *= r(); } while (p > L); return g - 1; }

export function buildMockCompetitions(now = new Date()): ProviderCompetition[] {
  return LEAGUES.map((lg, li) => {
    const r = rng(20261106 + li * 7919);
    const strength = lg.teams.map(() => 0.7 + r() * 0.9);
    const fixtures: ProviderFixture[] = [];
    const day = 86400000, base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 18, 0);
    const perRound = lg.teams.length / 2;
    const px = lg.idPrefix ?? lg.ref;
    for (let round = -9; round < 2; round++) {
      const order = lg.teams.map((_, i) => i).sort(() => r() - 0.5);
      for (let m = 0; m < perRound; m++) {
        const h = order[m * 2], a = order[m * 2 + 1];
        const kickoff = new Date(base + round * 3.5 * day + m * 2 * 3600000 + (round >= 0 ? day : 0) + li * 1800000);
        const done = kickoff.getTime() < now.getTime() - 3 * 3600000;
        let [hg, ag] = done ? lg.score(r, strength[h], strength[a]) : [null, null];
        if (done && !lg.draws && hg === ag) hg = (hg as number) + (lg.sport === "basketball" ? 3 : 1); // no ties in these sports
        fixtures.push({
          ref: `${px}-${round + 9}-${m}`, kickoff: kickoff.toISOString(), venue: `${lg.teams[h][0].split(" ")[0]} Park`,
          status: done ? "finished" : "scheduled", homeGoals: hg, awayGoals: ag,
          home: { ref: `${px}-t${h}`, name: lg.teams[h][0], short: lg.teams[h][1] }, away: { ref: `${px}-t${a}`, name: lg.teams[a][0], short: lg.teams[a][1] },
        });
      }
    }
    return { ref: lg.ref, name: lg.name, country: "Sample", season: now.getUTCFullYear(), sport: lg.sport, fixtures };
  });
}
/** Back-compat for code and tests that only need the soccer league. */
export const buildMockCompetition = (now = new Date()) => buildMockCompetitions(now)[0];
export const mockProvider: SportsProvider = { source: "mock", async fetchCompetitions() { return buildMockCompetitions(); } };
