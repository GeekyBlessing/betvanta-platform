import { one, q, tx } from "../db";
import { env, sampleDataAllowed } from "../env";
import { mockProvider } from "./mock";
import { apiFootballProvider } from "./apifootball";
import type { SportsProvider } from "./types";
import { badRequest } from "../errors";

export function activeProvider(): SportsProvider {
  if (env().API_FOOTBALL_KEY) return apiFootballProvider;
  if (sampleDataAllowed()) return mockProvider;
  throw badRequest("No sports data provider is configured. Set API_FOOTBALL_KEY, or ALLOW_SAMPLE_DATA=true for labelled sample data.");
}

/** Pull fixtures from the provider, upsert them, then rebuild team stats from finished matches. */
export async function syncSportsData(provider: SportsProvider = activeProvider()) {
  const comps = await provider.fetchCompetitions();
  let fixtures = 0;
  for (const comp of comps) {
    await tx(async (c) => {
      const cr = await one<{ id: string }>(
        `insert into competitions(name, country, season, provider_ref, data_source, sport) values ($1,$2,$3,$4,$5,$6)
         on conflict (provider_ref) do update set name = excluded.name, sport = excluded.sport returning id`, [comp.name, comp.country, comp.season, comp.ref, provider.source, comp.sport ?? "football"], c);
      const teamIds = new Map<string, string>();
      for (const f of comp.fixtures) for (const t of [f.home, f.away]) {
        if (teamIds.has(t.ref)) continue;
        const tr = await one<{ id: string }>(
          `insert into teams(name, short_name, provider_ref, data_source) values ($1,$2,$3,$4)
           on conflict (provider_ref) do update set name = excluded.name, short_name = excluded.short_name returning id`, [t.name, t.short, t.ref, provider.source], c);
        teamIds.set(t.ref, tr!.id);
      }
      for (const f of comp.fixtures) {
        await q(`insert into fixtures(competition_id, home_team_id, away_team_id, kickoff_at, venue, status, home_goals, away_goals, provider_ref, data_source)
                 values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                 on conflict (provider_ref) do update set kickoff_at = excluded.kickoff_at, status = excluded.status,
                   home_goals = excluded.home_goals, away_goals = excluded.away_goals, venue = excluded.venue, updated_at = now()`,
          [cr!.id, teamIds.get(f.home.ref), teamIds.get(f.away.ref), f.kickoff, f.venue, f.status, f.homeGoals, f.awayGoals, f.ref, provider.source], c);
        fixtures++;
      }
      await rebuildTeamStats(cr!.id, comp.season, provider.source, c);
    });
  }
  return { source: provider.source, competitions: comps.length, fixtures };
}

export async function rebuildTeamStats(competitionId: string, season: number, source: string, c: Parameters<typeof q>[2]) {
  await q("delete from team_stats where competition_id = $1 and season = $2", [competitionId, season], c);
  await q(`insert into team_stats(team_id, competition_id, season, home_played, home_goals_for, home_goals_against, away_played, away_goals_for, away_goals_against, data_source)
    select t.team_id, $1, $2,
      count(*) filter (where t.side = 'h'), coalesce(sum(t.gf) filter (where t.side = 'h'), 0), coalesce(sum(t.ga) filter (where t.side = 'h'), 0),
      count(*) filter (where t.side = 'a'), coalesce(sum(t.gf) filter (where t.side = 'a'), 0), coalesce(sum(t.ga) filter (where t.side = 'a'), 0), $3
    from (
      select home_team_id team_id, 'h' side, home_goals gf, away_goals ga from fixtures where competition_id = $1 and status = 'finished' and home_goals is not null
      union all
      select away_team_id, 'a', away_goals, home_goals from fixtures where competition_id = $1 and status = 'finished' and home_goals is not null
    ) t group by t.team_id`, [competitionId, season, source], c);
  await q(`update team_stats ts set form = f.form from (
      select team_id, string_agg(res, '' order by kickoff_at desc) form from (
        select team_id, kickoff_at, res, row_number() over (partition by team_id order by kickoff_at desc) rn from (
          select home_team_id team_id, kickoff_at, case when home_goals > away_goals then 'W' when home_goals = away_goals then 'D' else 'L' end res from fixtures where competition_id = $1 and status = 'finished' and home_goals is not null
          union all
          select away_team_id, kickoff_at, case when away_goals > home_goals then 'W' when home_goals = away_goals then 'D' else 'L' end from fixtures where competition_id = $1 and status = 'finished' and home_goals is not null
        ) x) y where rn <= 5 group by team_id) f
    where ts.team_id = f.team_id and ts.competition_id = $1 and ts.season = $2`, [competitionId, season], c);
}
