import { one, q } from "../db";
import { audit } from "../audit";
import { MARKET_LABEL, MODEL_VERSION, predict, settle } from "./engine";
import { canAccess, type Tier } from "./entitlements";
import { badRequest, notFound } from "../errors";
import { aiEnabled } from "../env";
import { generateAiAnalysis } from "./ai";
import { announcePrediction } from "./discord";

const DEFAULT_TIER: Record<string, Tier> = { "1X2": "free", BTTS: "premium", OU25: "vip" };

type StatRow = { home_played: number; home_goals_for: number; home_goals_against: number; away_played: number; away_goals_for: number; away_goals_against: number; form: string | null };

export async function matchModelInput(fixtureId: string) {
  const f = await one<{ competition_id: string; home_team_id: string; away_team_id: string; season: number; home: string; away: string }>(
    `select f.competition_id, f.home_team_id, f.away_team_id, c.season, ht.name home, at.name away from fixtures f join competitions c on c.id = f.competition_id
     join teams ht on ht.id = f.home_team_id join teams at on at.id = f.away_team_id where f.id = $1`, [fixtureId]);
  if (!f) throw notFound("Fixture not found.");
  const lg = await one<{ hg: string; ag: string; n: string }>(
    `select coalesce(sum(home_goals_for),0) hg, coalesce(sum(away_goals_for),0) ag, coalesce(sum(home_played),0) n from team_stats where competition_id = $1 and season = $2`, [f.competition_id, f.season]);
  const hs = await one<StatRow>("select * from team_stats where team_id = $1 and competition_id = $2 and season = $3", [f.home_team_id, f.competition_id, f.season]);
  const as = await one<StatRow>("select * from team_stats where team_id = $1 and competition_id = $2 and season = $3", [f.away_team_id, f.competition_id, f.season]);
  const n = Number(lg?.n ?? 0);
  return {
    names: { home: f.home, away: f.away }, homeStats: hs, awayStats: as,
    input: {
      home: { played: hs?.home_played ?? 0, goalsFor: hs?.home_goals_for ?? 0, goalsAgainst: hs?.home_goals_against ?? 0 },
      away: { played: as?.away_played ?? 0, goalsFor: as?.away_goals_for ?? 0, goalsAgainst: as?.away_goals_against ?? 0 },
      leagueHomeAvg: n ? Number(lg!.hg) / n : 0, leagueAwayAvg: n ? Number(lg!.ag) / n : 0,
    },
  };
}

function modelAnalysis(names: { home: string; away: string }, m: Awaited<ReturnType<typeof matchModelInput>>, out: NonNullable<ReturnType<typeof predict>>) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const i = m.input;
  return [
    `${names.home} have scored ${i.home.goalsFor} and conceded ${i.home.goalsAgainst} in ${i.home.played} home matches this season. ${names.away} have scored ${i.away.goalsFor} and conceded ${i.away.goalsAgainst} in ${i.away.played} away matches.`,
    `The model expects about ${out.lambdaHome.toFixed(2)} goals for ${names.home} and ${out.lambdaAway.toFixed(2)} for ${names.away}. Estimated chances: home win ${pct(out.probs.home)}, draw ${pct(out.probs.draw)}, away win ${pct(out.probs.away)}; both teams score ${pct(out.probs.bttsYes)}; over 2.5 goals ${pct(out.probs.over25)}.`,
    `Recent form (latest first): ${names.home} ${m.homeStats?.form ?? "n/a"}, ${names.away} ${m.awayStats?.form ?? "n/a"}.`,
    `Limitations: based only on this season's league goals for and against. It does not account for injuries, suspensions, lineups, travel or motivation. Probabilities are estimates, not certainties.`,
  ].join("\n\n");
}

/** Generate draft predictions for upcoming fixtures that have enough data. Never overwrites published picks. */
export async function runEngine(actorId: string | null, days = 7) {
  const fixtures = await q<{ id: string }>(
    `select f.id from fixtures f join competitions c on c.id = f.competition_id where c.sport = 'football' and f.status = 'scheduled' and f.kickoff_at > now() and f.kickoff_at < now() + ($1 || ' days')::interval order by f.kickoff_at`, [String(days)]);
  let created = 0, skipped = 0;
  for (const f of fixtures) {
    const m = await matchModelInput(f.id);
    const out = predict(m.input);
    if (!out) { skipped++; continue; }
    const analysis = modelAnalysis(m.names, m, out);
    for (const p of out.picks) {
      const r = await q(`insert into predictions(fixture_id, market, selection, probability, confidence, access_tier, rationale, analysis, analysis_source, model_version, author_id)
        values ($1,$2,$3,$4,$5,$6,$7,$8,'model',$9,$10) on conflict (fixture_id, market) do nothing returning id`,
        [f.id, p.market, p.selection, p.probability, p.confidence, DEFAULT_TIER[p.market], `Model probability ${Math.round(p.probability * 100)}% for ${p.selection} (${MARKET_LABEL[p.market]}).`, analysis, MODEL_VERSION, actorId]);
      created += r.length;
    }
  }
  await audit(actorId, "engine.run", "prediction", null, { fixtures: fixtures.length, created, skipped });
  return { fixtures: fixtures.length, created, skipped };
}

export async function publishPrediction(id: string, actorId: string, accessTier?: Tier) {
  const row = await one<{ id: string }>(
    `update predictions p set status = 'published', published_at = now(), access_tier = coalesce($2, p.access_tier), updated_at = now()
     from fixtures f where p.id = $1 and f.id = p.fixture_id and p.status = 'draft' and f.kickoff_at > now() returning p.id`, [id, accessTier ?? null]);
  if (!row) throw badRequest("Only drafts for matches that have not started can be published.");
  await audit(actorId, "prediction.publish", "prediction", id, { accessTier });
  await announcePrediction(id);
}

export async function updateDraft(id: string, actorId: string, patch: { selection?: string; confidence?: string; accessTier?: Tier; analysis?: string }) {
  const row = await one(`update predictions set selection = coalesce($2, selection), confidence = coalesce($3, confidence), access_tier = coalesce($4, access_tier),
      analysis = coalesce($5, analysis), analysis_source = case when $5::text is null then analysis_source else 'analyst' end, updated_at = now()
      where id = $1 and status = 'draft' returning id`, [id, patch.selection ?? null, patch.confidence ?? null, patch.accessTier ?? null, patch.analysis ?? null]);
  if (!row) throw badRequest("Only drafts can be edited.");
  await audit(actorId, "prediction.update_draft", "prediction", id, patch);
}

export async function deleteDraft(id: string, actorId: string) {
  const r = await q("delete from predictions where id = $1 and status = 'draft' returning id", [id]);
  if (!r.length) throw badRequest("Only drafts can be deleted.");
  await audit(actorId, "prediction.delete_draft", "prediction", id);
}

export async function addAiAnalysis(id: string, actorId: string) {
  if (!aiEnabled()) throw badRequest("AI analysis is not configured. Set OPENAI_API_KEY.");
  const p = await one<{ fixture_id: string; status: string }>("select fixture_id, status from predictions where id = $1", [id]);
  if (!p || p.status !== "draft") throw badRequest("AI analysis can only be added to drafts.");
  const m = await matchModelInput(p.fixture_id);
  const out = predict(m.input);
  if (!out) throw badRequest("Not enough data for this match.");
  const text = await generateAiAnalysis({ ...m.names, input: m.input, homeForm: m.homeStats?.form ?? null, awayForm: m.awayStats?.form ?? null, model: out });
  await q("update predictions set analysis = $2, analysis_source = 'ai', updated_at = now() where id = $1", [id, text]);
  await audit(actorId, "prediction.ai_analysis", "prediction", id);
}

/** Settle published predictions whose fixtures have finished. */
export async function settleFinished(actorId: string | null = null) {
  const rows = await q<{ id: string; market: string; selection: string; status: string; home_goals: number; away_goals: number }>(
    `select p.id, p.market, p.selection, f.status, f.home_goals, f.away_goals from predictions p join fixtures f on f.id = p.fixture_id
     where p.status = 'published' and (f.status in ('finished','cancelled')) `);
  for (const r of rows) {
    const result = r.status === "cancelled" || r.home_goals == null ? "void" : settle(r.market, r.selection, r.home_goals, r.away_goals);
    await q("update predictions set status = 'settled', result = $2, settled_at = now(), updated_at = now() where id = $1", [r.id, result]);
  }
  if (rows.length) await audit(actorId, "prediction.settle", "prediction", null, { count: rows.length });
  return { settled: rows.length };
}

export type PublicPrediction = {
  id: string; market: string; access_tier: Tier; status: string; result: string; confidence: string | null; selection: string | null; probability: string | null;
  analysis: string | null; analysis_source: string | null; published_at: string; locked: boolean;
  fixture_id: string; kickoff_at: string; fixture_status: string; home_goals: number | null; away_goals: number | null; data_source: string;
  competition: string; home: string; home_short: string; away: string; away_short: string; home_form: string | null; away_form: string | null;
};

/**
 * Lists published/settled predictions. Content above the viewer's tier is redacted HERE, on the server,
 * so the selection and analysis never reach the browser for users without access.
 * Settled predictions are public (the track record), but their analysis stays gated.
 */
export async function listPredictions(viewerTier: Tier, opts: { upcoming?: boolean; settled?: boolean; fixtureId?: string; limit?: number } = {}): Promise<PublicPrediction[]> {
  const where = ["p.status in ('published','settled')"];
  const params: unknown[] = [];
  if (opts.upcoming) where.push("p.status = 'published'");
  if (opts.settled) where.push("p.status = 'settled'");
  if (opts.fixtureId) { params.push(opts.fixtureId); where.push(`p.fixture_id = $${params.length}`); }
  params.push(Math.min(opts.limit ?? 100, 500));
  const rows = await q<PublicPrediction>(
    `select p.id, p.market, p.access_tier, p.status, p.result, p.confidence, p.selection, p.probability, p.analysis, p.analysis_source, p.published_at,
       f.id fixture_id, f.kickoff_at, f.status fixture_status, f.home_goals, f.away_goals, f.data_source, c.name competition,
       ht.name home, ht.short_name home_short, at.name away, at.short_name away_short, hs.form home_form, ast.form away_form
     from predictions p join fixtures f on f.id = p.fixture_id join competitions c on c.id = f.competition_id
     join teams ht on ht.id = f.home_team_id join teams at on at.id = f.away_team_id
     left join team_stats hs on hs.team_id = f.home_team_id and hs.competition_id = f.competition_id and hs.season = c.season
     left join team_stats ast on ast.team_id = f.away_team_id and ast.competition_id = f.competition_id and ast.season = c.season
     where ${where.join(" and ")} order by ${opts.settled ? "f.kickoff_at desc" : "f.kickoff_at asc"}, p.market limit $${params.length}`, params);
  return rows.map((r) => {
    const allowed = canAccess(viewerTier, r.access_tier);
    const settledPublic = r.status === "settled";
    return {
      ...r, locked: !allowed,
      selection: allowed || settledPublic ? r.selection : null,
      confidence: allowed || settledPublic ? r.confidence : null,
      probability: allowed ? r.probability : null,
      analysis: allowed ? r.analysis : null,
    };
  });
}

export async function performance() {
  const rows = await q<{ market: string; access_tier: string; won: string; lost: string; void: string }>(
    `select market, access_tier, count(*) filter (where result = 'won') won, count(*) filter (where result = 'lost') lost, count(*) filter (where result = 'void') void
     from predictions where status = 'settled' group by grouping sets ((market), (access_tier), ()) `);
  return rows;
}
