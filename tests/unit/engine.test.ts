import { describe, expect, it } from "vitest";
import { predict, settle, band, MIN_MATCHES } from "@/lib/services/engine";
const side = (played: number, gf: number, ga: number) => ({ played, goalsFor: gf, goalsAgainst: ga });

describe("poisson engine", () => {
  it("returns probabilities that sum to 1 and favour the stronger side", () => {
    const o = predict({ home: side(10, 25, 8), away: side(10, 9, 20), leagueHomeAvg: 1.5, leagueAwayAvg: 1.2 })!;
    expect(o.probs.home + o.probs.draw + o.probs.away).toBeCloseTo(1, 3);
    expect(o.probs.home).toBeGreaterThan(o.probs.away);
    expect(o.picks.find((p) => p.market === "1X2")!.selection).toBe("Home win");
  });
  it("refuses to predict with too little data", () => {
    expect(predict({ home: side(MIN_MATCHES - 1, 3, 2), away: side(5, 5, 5), leagueHomeAvg: 1.4, leagueAwayAvg: 1.1 })).toBeNull();
    expect(predict({ home: side(5, 5, 5), away: side(5, 5, 5), leagueHomeAvg: 0, leagueAwayAvg: 0 })).toBeNull();
  });
  it("bands confidence by probability", () => {
    expect(band(0.62, false)).toBe("high"); expect(band(0.5, false)).toBe("medium"); expect(band(0.4, false)).toBe("low");
    expect(band(0.7, true)).toBe("high"); expect(band(0.6, true)).toBe("medium"); expect(band(0.55, true)).toBe("low");
  });
  it("settles each market from the final score", () => {
    expect(settle("1X2", "Home win", 2, 1)).toBe("won"); expect(settle("1X2", "Draw", 2, 1)).toBe("lost");
    expect(settle("BTTS", "Yes", 1, 1)).toBe("won"); expect(settle("BTTS", "No", 1, 0)).toBe("won");
    expect(settle("OU25", "Over 2.5", 2, 1)).toBe("won"); expect(settle("OU25", "Under 2.5", 2, 1)).toBe("lost");
  });
});
