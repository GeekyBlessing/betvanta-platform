export type ProviderFixture = {
  ref: string; kickoff: string; venue: string | null; status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  homeGoals: number | null; awayGoals: number | null;
  home: { ref: string; name: string; short: string }; away: { ref: string; name: string; short: string };
};
export type ProviderCompetition = { ref: string; name: string; country: string; season: number; sport?: "football" | "american_football" | "basketball" | "baseball"; fixtures: ProviderFixture[] };
export interface SportsProvider { source: "mock" | "api-football"; fetchCompetitions(): Promise<ProviderCompetition[]>; }
