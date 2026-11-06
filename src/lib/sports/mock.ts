import type { ProviderCompetition, ProviderFixture, SportsProvider } from "./types";
// Development and demo data. Fictional teams only, so no statistic can be mistaken for a real club's record.
const TEAMS = [
  ["Lagos Lions", "LAG"], ["Abuja Arrows", "ABU"], ["Kano Kestrels", "KAN"], ["Ibadan Ironmen", "IBA"], ["Enugu Eagles", "ENU"],
  ["Port City FC", "PRT"], ["Benin Bulls", "BEN"], ["Jos Jaguars", "JOS"], ["Calabar Comets", "CAL"], ["Owerri Owls", "OWE"],
] as const;
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
function goals(r: () => number, mean: number) { let g = 0, L = Math.exp(-mean), p = 1; do { g++; p *= r(); } while (p > L); return g - 1; }

export function buildMockCompetition(now = new Date()): ProviderCompetition {
  const r = rng(20261106);
  const strength = TEAMS.map(() => 0.7 + r() * 0.9);
  const fixtures: ProviderFixture[] = [];
  const day = 86400000, base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 18, 0);
  // 9 past rounds and 2 upcoming rounds, 5 matches each.
  for (let round = -9; round < 2; round++) {
    const order = TEAMS.map((_, i) => i).sort(() => r() - 0.5);
    for (let m = 0; m < 5; m++) {
      const h = order[m * 2], a = order[m * 2 + 1];
      const kickoff = new Date(base + round * 3.5 * day + m * 2 * 3600000 + (round >= 0 ? day : 0));
      const done = kickoff.getTime() < now.getTime() - 2 * 3600000;
      fixtures.push({
        ref: `mock-${round + 9}-${m}`, kickoff: kickoff.toISOString(), venue: `${TEAMS[h][0].split(" ")[0]} Stadium`,
        status: done ? "finished" : "scheduled",
        homeGoals: done ? goals(r, 1.45 * strength[h] / strength[a] ** 0.5) : null,
        awayGoals: done ? goals(r, 1.1 * strength[a] / strength[h] ** 0.5) : null,
        home: { ref: `mock-t${h}`, name: TEAMS[h][0], short: TEAMS[h][1] }, away: { ref: `mock-t${a}`, name: TEAMS[a][0], short: TEAMS[a][1] },
      });
    }
  }
  return { ref: "mock-league", name: "Sample League", country: "Sample", season: now.getUTCFullYear(), fixtures };
}
export const mockProvider: SportsProvider = { source: "mock", async fetchCompetitions() { return [buildMockCompetition()]; } };
