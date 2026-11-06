import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers";
import { one, q } from "@/lib/db";
import { syncSportsData } from "@/lib/sports/sync";
import { mockProvider } from "@/lib/sports/mock";
import { runEngine, publishPrediction, listPredictions, settleFinished } from "@/lib/services/predictions";

async function admin() { return (await one(`insert into users(email, password_hash, display_name, role, age_confirmed_at, terms_accepted_at) values ('a@x.com','x','A','admin',now(),now()) returning id`))!.id as string; }

describe("sports data and predictions", () => {
  beforeEach(resetDb);
  it("syncs sample fixtures marked as mock and builds team stats", async () => {
    const r = await syncSportsData(mockProvider);
    expect(r.fixtures).toBe(187); // 55 soccer + 44 each for the sample gridiron, hoops and diamond leagues
    expect((await q("select distinct data_source from fixtures")).map((x) => x.data_source)).toEqual(["mock"]);
    const [s] = await q("select sum(home_played) n from team_stats");
    expect(Number(s.n)).toBeGreaterThan(30);
    await syncSportsData(mockProvider); // idempotent
    expect((await q("select count(*)::int n from fixtures"))[0].n).toBe(187);
  });
  it("generates drafts for upcoming fixtures only, and never duplicates", async () => {
    const a = await admin();
    await syncSportsData(mockProvider);
    const r = await runEngine(a, 10);
    expect(r.created).toBeGreaterThan(0);
    expect((await q("select count(*)::int n from predictions p join fixtures f on f.id = p.fixture_id where f.kickoff_at < now()"))[0].n).toBe(0);
    expect((await runEngine(a, 10)).created).toBe(0);
    const p = await one("select * from predictions limit 1");
    expect(p.status).toBe("draft");
    expect(Number(p.probability)).toBeGreaterThan(0.33);
    expect(p.analysis).toMatch(/Limitations/);
  });
  it("hides premium selections and analysis from free users on the server", async () => {
    const a = await admin();
    await syncSportsData(mockProvider); await runEngine(a, 10);
    const drafts = await q("select id, market from predictions");
    for (const d of drafts) await publishPrediction(d.id, a);
    const free = await listPredictions("free", { upcoming: true });
    const locked = free.filter((p) => p.access_tier !== "free");
    expect(locked.length).toBeGreaterThan(0);
    for (const p of locked) { expect(p.locked).toBe(true); expect(p.selection).toBeNull(); expect(p.analysis).toBeNull(); expect(p.probability).toBeNull(); }
    for (const p of free.filter((p) => p.access_tier === "free")) expect(p.selection).not.toBeNull();
    const vip = await listPredictions("vip", { upcoming: true });
    expect(vip.every((p) => !p.locked && p.selection)).toBe(true);
    const premium = await listPredictions("premium", { upcoming: true });
    expect(premium.filter((p) => p.access_tier === "vip").every((p) => p.locked)).toBe(true);
  });
  it("locks published picks at kickoff and settles them from the final score", async () => {
    const a = await admin();
    await syncSportsData(mockProvider); await runEngine(a, 10);
    const d = await one("select p.id, p.fixture_id from predictions p where market = '1X2' limit 1");
    await publishPrediction(d.id, a);
    await q("update fixtures set kickoff_at = now() - interval '3 hours' where id = $1", [d.fixture_id]);
    await expect(q("update predictions set selection = 'Draw' where id = $1", [d.id])).rejects.toThrow(/locked after kickoff/);
    await q("update fixtures set status = 'finished', home_goals = 2, away_goals = 1 where id = $1", [d.fixture_id]);
    expect((await settleFinished()).settled).toBe(1);
    const s = await one("select status, result, selection from predictions where id = $1", [d.id]);
    expect(s.status).toBe("settled");
    expect(s.result).toBe(s.selection === "Home win" ? "won" : "lost");
  });
  it("refuses to publish after kickoff", async () => {
    const a = await admin();
    await syncSportsData(mockProvider); await runEngine(a, 10);
    const d = await one("select id, fixture_id from predictions limit 1");
    await q("update fixtures set kickoff_at = now() - interval '1 minute' where id = $1", [d.fixture_id]);
    await expect(publishPrediction(d.id, a)).rejects.toThrow(/have not started/);
  });
});
