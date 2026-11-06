import { q } from "../db";

/** US naming: "football" in the database is association football, shown as Soccer. */
export type SportInfo = { id: string; slug: string; name: string; predictions: boolean; blurb: string };
export const SPORTS: SportInfo[] = [
  { id: "american_football", slug: "american-football", name: "American Football", predictions: false, blurb: "Schedules, scores and team records" },
  { id: "football", slug: "soccer", name: "Soccer", predictions: true, blurb: "Predictions, analysis, tables and form" },
  { id: "basketball", slug: "basketball", name: "Basketball", predictions: false, blurb: "Schedules, scores and team records" },
  { id: "baseball", slug: "baseball", name: "Baseball", predictions: false, blurb: "Schedules, scores and team records" },
];
export const sportBySlug = (slug: string) => SPORTS.find((s) => s.slug === slug);
export const sportById = (id: string) => SPORTS.find((s) => s.id === id);

export type Competition = { id: string; name: string; country: string; season: number; sport: string; data_source: string; upcoming: number; favourite: boolean };
export async function listCompetitions(userId: string | null, sport?: string) {
  return q<Competition>(
    `select c.id, c.name, c.country, c.season, c.sport, c.data_source,
       (select count(*)::int from fixtures f where f.competition_id = c.id and f.kickoff_at > now() and f.status = 'scheduled') upcoming,
       exists (select 1 from user_favourite_competitions uf where uf.user_id = $1 and uf.competition_id = c.id) favourite
     from competitions c where c.active and ($2::text is null or c.sport = $2) order by c.sport, c.name`, [userId, sport ?? null]);
}

export type Standing = { team_id: string; team: string; short: string; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number; form: string | null };
/** League table computed from finished fixtures (3 points for a win, 1 for a draw). */
export async function standings(competitionId: string) {
  return q<Standing>(
    `with r as (
       select home_team_id team_id, home_goals gf, away_goals ga from fixtures where competition_id = $1 and status = 'finished' and home_goals is not null
       union all select away_team_id, away_goals, home_goals from fixtures where competition_id = $1 and status = 'finished' and home_goals is not null)
     select r.team_id, t.name team, t.short_name short, count(*)::int p,
       count(*) filter (where gf > ga)::int w, count(*) filter (where gf = ga)::int d, count(*) filter (where gf < ga)::int l,
       sum(gf)::int gf, sum(ga)::int ga, (sum(gf) - sum(ga))::int gd,
       (3 * count(*) filter (where gf > ga) + count(*) filter (where gf = ga))::int pts, ts.form
     from r join teams t on t.id = r.team_id
     left join competitions c on c.id = $1
     left join team_stats ts on ts.team_id = r.team_id and ts.competition_id = $1 and ts.season = c.season
     group by r.team_id, t.name, t.short_name, ts.form order by pts desc, gd desc, gf desc, t.name`, [competitionId]);
}

export type FixtureRow = { id: string; kickoff_at: string; status: string; home_goals: number | null; away_goals: number | null; venue: string | null; data_source: string;
  competition_id: string; competition: string; home: string; home_short: string; away: string; away_short: string; predictions: number };
export async function listFixtures(opts: { competitionId?: string; mode: "upcoming" | "results" | "live"; limit?: number; competitionIds?: string[] }) {
  const where = [opts.mode === "upcoming" ? "f.status = 'scheduled' and f.kickoff_at > now() - interval '2 hours'" : opts.mode === "live" ? "f.status = 'live'" : "f.status = 'finished'"];
  const params: unknown[] = [];
  if (opts.competitionId) { params.push(opts.competitionId); where.push(`f.competition_id = $${params.length}`); }
  if (opts.competitionIds?.length) { params.push(opts.competitionIds); where.push(`f.competition_id = any($${params.length}::uuid[])`); }
  params.push(Math.min(opts.limit ?? 100, 300));
  return q<FixtureRow>(
    `select f.id, f.kickoff_at, f.status, f.home_goals, f.away_goals, f.venue, f.data_source, c.id competition_id, c.name competition,
       ht.name home, ht.short_name home_short, at.name away, at.short_name away_short,
       (select count(*)::int from predictions p where p.fixture_id = f.id and p.status in ('published','settled')) predictions
     from fixtures f join competitions c on c.id = f.competition_id join teams ht on ht.id = f.home_team_id join teams at on at.id = f.away_team_id
     where ${where.join(" and ")} order by f.kickoff_at ${opts.mode === "results" ? "desc" : "asc"} limit $${params.length}`, params);
}

export async function matchStats(fixtureId: string) {
  const [s] = await q(`select f.home_team_id, f.away_team_id, f.competition_id, c.season from fixtures f join competitions c on c.id = f.competition_id where f.id = $1`, [fixtureId]);
  if (!s) return null;
  const stats = await q(`select team_id, home_played, home_goals_for, home_goals_against, away_played, away_goals_for, away_goals_against, form, data_source
     from team_stats where competition_id = $1 and season = $2 and team_id = any($3::uuid[])`, [s.competition_id, s.season, [s.home_team_id, s.away_team_id]]);
  const h2h = await q(`select f.kickoff_at, ht.name home, at.name away, f.home_goals, f.away_goals from fixtures f join teams ht on ht.id = f.home_team_id join teams at on at.id = f.away_team_id
     where f.status = 'finished' and f.id <> $1 and ((f.home_team_id = $2 and f.away_team_id = $3) or (f.home_team_id = $3 and f.away_team_id = $2)) order by f.kickoff_at desc limit 5`,
    [fixtureId, s.home_team_id, s.away_team_id]);
  return { home: stats.find((x) => x.team_id === s.home_team_id) ?? null, away: stats.find((x) => x.team_id === s.away_team_id) ?? null, h2h };
}
