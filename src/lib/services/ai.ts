import { env } from "../env";
import type { EngineOutput, MatchInput } from "./engine";

/** Grounded analysis: the model only sees numbers we computed, and is told not to add facts. */
export async function generateAiAnalysis(d: { home: string; away: string; input: MatchInput; homeForm: string | null; awayForm: string | null; model: EngineOutput }) {
  const facts = {
    home_team: d.home, away_team: d.away,
    home_record_at_home: d.input.home, away_record_away: d.input.away,
    league_avg_goals: { home: +d.input.leagueHomeAvg.toFixed(2), away: +d.input.leagueAwayAvg.toFixed(2) },
    recent_form_latest_first: { home: d.homeForm, away: d.awayForm },
    model_expected_goals: { home: +d.model.lambdaHome.toFixed(2), away: +d.model.lambdaAway.toFixed(2) },
    model_probabilities: d.model.probs,
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env().OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env().OPENAI_MODEL, temperature: 0.2, max_tokens: 450,
      messages: [
        { role: "system", content: "You are a careful football analyst for BETVANTA. Use ONLY the JSON facts provided. Do not invent players, injuries, statistics, odds or history. Never claim certainty or guarantee an outcome. Write 3 short paragraphs: summary, statistical observations, potential outcomes with the given probabilities. Then a final line starting 'Limitations:' naming what the data does not cover." },
        { role: "user", content: JSON.stringify(facts) },
      ],
    }),
  });
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  const text = j.choices?.[0]?.message?.content?.trim();
  if (!res.ok || !text) throw new Error(`OpenAI error: ${j.error?.message ?? res.status}`);
  return text;
}
