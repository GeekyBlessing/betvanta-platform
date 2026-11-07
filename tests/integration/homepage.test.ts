import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers";
import { one, q } from "@/lib/db";
import { homeStats, MIN_SETTLED_FOR_RATE } from "@/lib/services/stats";
import { submitTestimonial, approvedTestimonials, moderateTestimonial, withdrawTestimonial, testimonialSchema } from "@/lib/services/testimonials";
import { syncSportsData } from "@/lib/sports/sync";
import { mockProvider, buildMockCompetitions } from "@/lib/sports/mock";
import { runEngine } from "@/lib/services/predictions";
import { discordInviteUrl, instagramHandle, instagramUrl, resetEnvCache } from "@/lib/env";

async function member(role = "member") { return (await one(`insert into users(email, password_hash, display_name, role, age_confirmed_at, terms_accepted_at) values ('h${Math.random()}@x.com','x','Hana',$1,now(),now()) returning id`, [role]))!.id as string; }
const review = { displayName: "Hana", location: "Austin, TX", rating: 5, body: "Clear picks and honest about the odds. Worth it.", consent: true as const };

describe("homepage statistics", () => {
  beforeEach(resetDb);
  it("reports only real counts and withholds the win rate until enough picks settle", async () => {
    await member(); await member(); await member("admin");
    let s = await homeStats();
    expect([s.members, s.settled, s.winRate, s.sports]).toEqual([2, 0, null, 0]);
    await syncSportsData(mockProvider);
    s = await homeStats();
    expect(s.sports).toBe(4);
    expect(s.sampleData).toBe(true);
    // settle exactly the threshold number of picks with a known split
    const fx = await q("select f.id from fixtures f join competitions c on c.id = f.competition_id where c.sport = 'football' and f.status = 'finished' limit $1", [MIN_SETTLED_FOR_RATE]);
    for (const [i, f] of fx.entries()) await q("insert into predictions(fixture_id, market, selection, confidence, status, result, settled_at) values ($1,'1X2','Home win','medium','settled',$2, now())", [f.id, i < 15 ? "won" : "lost"]);
    s = await homeStats();
    expect([s.settled, s.won, s.lost, s.winRate]).toEqual([20, 15, 5, 75]);
  });
});

describe("multi-sport sample data", () => {
  beforeEach(resetDb);
  it("covers American football, soccer, basketball and baseball with no ties outside soccer", () => {
    const comps = buildMockCompetitions();
    expect(comps.map((c) => c.sport).sort()).toEqual(["american_football", "baseball", "basketball", "football"]);
    for (const c of comps.filter((c) => c.sport !== "football")) for (const f of c.fixtures.filter((f) => f.status === "finished")) expect(f.homeGoals).not.toBe(f.awayGoals);
  });
  it("only generates predictions for soccer, the sport the model is built for", async () => {
    await syncSportsData(mockProvider);
    await runEngine(null, 10);
    const sports = await q("select distinct c.sport from predictions p join fixtures f on f.id = p.fixture_id join competitions c on c.id = f.competition_id");
    expect(sports.map((s) => s.sport)).toEqual(["football"]);
  });
});

describe("testimonials", () => {
  beforeEach(resetDb);
  it("requires explicit publication consent", () => {
    expect(() => testimonialSchema.parse({ ...review, consent: false })).toThrow();
    expect(() => testimonialSchema.parse({ ...review, body: "too short" })).toThrow();
  });
  it("shows nothing until an admin approves, and hides withdrawn reviews", async () => {
    const id = await member(), admin = await member("admin");
    const t = await submitTestimonial(id, testimonialSchema.parse(review));
    expect(await approvedTestimonials()).toEqual([]);
    await expect(submitTestimonial(id, testimonialSchema.parse(review))).rejects.toThrow(/already have a review waiting/);
    await moderateTestimonial(admin, t, "approve");
    const shown = await approvedTestimonials();
    expect(shown.map((r) => [r.display_name, r.rating, r.verified_subscriber])).toEqual([["Hana", 5, false]]);
    const row = await one("select consent_at, consent_text from testimonials where id = $1", [t]);
    expect(row.consent_at).not.toBeNull();
    await withdrawTestimonial(id, t);
    expect(await approvedTestimonials()).toEqual([]);
    await expect(moderateTestimonial(admin, t, "approve")).rejects.toThrow(/withdrawn/);
  });
  it("hides reviews from suspended or deleted accounts", async () => {
    const id = await member(), admin = await member("admin");
    await moderateTestimonial(admin, await submitTestimonial(id, testimonialSchema.parse(review)), "approve");
    await q("update users set status = 'suspended' where id = $1", [id]);
    expect(await approvedTestimonials()).toEqual([]);
  });
  it("has no seeded or pre-approved reviews", async () => {
    expect((await q("select count(*)::int n from testimonials"))[0].n).toBe(0);
  });
});

describe("official community links", () => {
  it("uses the BETVANTA Instagram profile and accepts only instagram.com profiles", () => {
    const set = (v?: string) => { if (v === undefined) delete process.env.INSTAGRAM_URL; else process.env.INSTAGRAM_URL = v; resetEnvCache(); return [instagramUrl(), instagramHandle()]; };
    expect(set(undefined)).toEqual(["https://www.instagram.com/bet.vanta/", "@bet.vanta"]);
    expect(set("https://evil.example/bet.vanta")).toEqual([null, null]);
    expect(set("https://www.instagram.com/bet.vanta/?x=<script>")).toEqual(["https://www.instagram.com/bet.vanta/?x=%3Cscript%3E", "@bet.vanta"]);
    set(undefined);
  });
});

describe("Discord invite link", () => {
  it("accepts only real Discord invite URLs", () => {
    const check = (v?: string) => { if (v === undefined) delete process.env.DISCORD_INVITE_URL; else process.env.DISCORD_INVITE_URL = v; resetEnvCache(); return discordInviteUrl(); };
    expect(check("https://discord.gg/betvanta")).toBe("https://discord.gg/betvanta");
    expect(check("https://discord.com/invite/abc")).toBe("https://discord.com/invite/abc");
    expect(check("https://evil.example/discord.gg")).toBeNull();
    expect(check("http://discord.gg/x")).toBeNull();
    expect(check(undefined)).toBe("https://discord.com/invite/STDJ29shZS"); // the official BETVANTA server by default
  });
});
