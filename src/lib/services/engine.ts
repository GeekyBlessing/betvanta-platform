/** BETVANTA prediction engine v1: independent Poisson goals model from home/away scoring rates. */
export const MODEL_VERSION = "poisson-v1";
export type SideStats = { played: number; goalsFor: number; goalsAgainst: number };
export type MatchInput = { home: SideStats; away: SideStats; leagueHomeAvg: number; leagueAwayAvg: number };
export type MarketPick = { market: "1X2" | "BTTS" | "OU25"; selection: string; probability: number; confidence: "low" | "medium" | "high" };
export type EngineOutput = { lambdaHome: number; lambdaAway: number; probs: { home: number; draw: number; away: number; bttsYes: number; over25: number }; picks: MarketPick[] };
export const MIN_MATCHES = 3;

function poisson(k: number, l: number) { let f = 1; for (let i = 2; i <= k; i++) f *= i; return (Math.exp(-l) * l ** k) / f; }

export function expectedGoals(m: MatchInput) {
  const rate = (g: number, n: number) => g / n;
  const homeAttack = rate(m.home.goalsFor, m.home.played) / m.leagueHomeAvg;
  const awayDefence = rate(m.away.goalsAgainst, m.away.played) / m.leagueHomeAvg;
  const awayAttack = rate(m.away.goalsFor, m.away.played) / m.leagueAwayAvg;
  const homeDefence = rate(m.home.goalsAgainst, m.home.played) / m.leagueAwayAvg;
  const clamp = (x: number) => Math.min(4.5, Math.max(0.15, x));
  return { lambdaHome: clamp(homeAttack * awayDefence * m.leagueHomeAvg), lambdaAway: clamp(awayAttack * homeDefence * m.leagueAwayAvg) };
}

export function band(p: number, binary: boolean): MarketPick["confidence"] {
  const [hi, mid] = binary ? [0.68, 0.58] : [0.6, 0.48];
  return p >= hi ? "high" : p >= mid ? "medium" : "low";
}

export function predict(m: MatchInput): EngineOutput | null {
  if (m.home.played < MIN_MATCHES || m.away.played < MIN_MATCHES || m.leagueHomeAvg <= 0 || m.leagueAwayAvg <= 0) return null;
  const { lambdaHome, lambdaAway } = expectedGoals(m);
  let home = 0, draw = 0, away = 0, bttsYes = 0, over25 = 0;
  for (let h = 0; h <= 10; h++) for (let a = 0; a <= 10; a++) {
    const p = poisson(h, lambdaHome) * poisson(a, lambdaAway);
    if (h > a) home += p; else if (h === a) draw += p; else away += p;
    if (h > 0 && a > 0) bttsYes += p;
    if (h + a > 2) over25 += p;
  }
  const total = home + draw + away;
  home /= total; draw /= total; away /= total; bttsYes /= total; over25 /= total;
  const x12 = [{ s: "Home win", p: home }, { s: "Draw", p: draw }, { s: "Away win", p: away }].sort((a, b) => b.p - a.p)[0];
  const btts = bttsYes >= 0.5 ? { s: "Yes", p: bttsYes } : { s: "No", p: 1 - bttsYes };
  const ou = over25 >= 0.5 ? { s: "Over 2.5", p: over25 } : { s: "Under 2.5", p: 1 - over25 };
  const r4 = (x: number) => Math.round(x * 10000) / 10000;
  return {
    lambdaHome, lambdaAway, probs: { home: r4(home), draw: r4(draw), away: r4(away), bttsYes: r4(bttsYes), over25: r4(over25) },
    picks: [
      { market: "1X2", selection: x12.s, probability: r4(x12.p), confidence: band(x12.p, false) },
      { market: "BTTS", selection: btts.s, probability: r4(btts.p), confidence: band(btts.p, true) },
      { market: "OU25", selection: ou.s, probability: r4(ou.p), confidence: band(ou.p, true) },
    ],
  };
}

/** Decide a settled result from the final score. */
export function settle(market: string, selection: string, hg: number, ag: number): "won" | "lost" | "void" {
  switch (market) {
    case "1X2": { const r = hg > ag ? "Home win" : hg === ag ? "Draw" : "Away win"; return r === selection ? "won" : "lost"; }
    case "BTTS": { const y = hg > 0 && ag > 0; return (selection === "Yes") === y ? "won" : "lost"; }
    case "OU25": { const o = hg + ag > 2; return (selection === "Over 2.5") === o ? "won" : "lost"; }
    default: return "void";
  }
}
export const MARKET_LABEL: Record<string, string> = { "1X2": "Match result", BTTS: "Both teams to score", OU25: "Total goals 2.5" };
