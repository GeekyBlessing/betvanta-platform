import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closePool, resetDb } from "../helpers";
import { one, q } from "@/lib/db";
import { publicHomepageStats, updateHomepageStat, listHomepageStats } from "@/lib/services/homepage-stats";

const PLACEHOLDERS = [["members", "2,000+", "Happy Members"], ["win_rate", "100%", "Win Rate"], ["winning_picks", "12,500+", "Winning Picks"], ["sports", "10", "Sports Covered"]];
async function admin() { return (await one(`insert into users(email, password_hash, display_name, role, age_confirmed_at, terms_accepted_at) values ('a${Math.random()}@x.com','x','Ada','admin',now(),now()) returning id`))!.id as string; }
const base = { label: "Win Rate", source: "manual" as const, visible: true };

beforeEach(async () => {
  await resetDb();
});
afterAll(closePool);

describe("homepage statistics", () => {
  it("seeds the four client figures as unverified placeholders, in order", async () => {
    const { stats, configMissing } = await publicHomepageStats();
    expect(configMissing).toBe(false);
    expect(stats.map((s) => [s.value, s.label, s.status])).toEqual(PLACEHOLDERS.map(([, v, l]) => [v, l, "unverified"]));
  });

  it("refuses to mark a figure verified without evidence, in the service and in the database", async () => {
    const id = await admin();
    await expect(updateHomepageStat(id, "win_rate", { ...base, value: "100%", verification: "verified" })).rejects.toThrow(/how this figure was verified/);
    await expect(updateHomepageStat(id, "win_rate", { ...base, value: "100%", verification: "verified", verificationNote: "short" })).rejects.toThrow();
    await expect(q("update homepage_stats set verification = 'verified' where key = 'win_rate'")).rejects.toThrow(/homepage_stats_verified_has_evidence/);
  });

  it("records who verified a figure and when, and resets verification when the figure changes", async () => {
    const id = await admin();
    const note = "Independent audit of 1,204 settled picks, Acme Analytics, report dated 1 Nov 2026.";
    await updateHomepageStat(id, "win_rate", { ...base, value: "58.4%", verification: "verified", verificationNote: note });
    let row = (await listHomepageStats()).find((r) => r.key === "win_rate")!;
    expect(row).toMatchObject({ value_text: "58.4%", verification: "verified", verification_note: note, verified_by_name: "Ada" });
    expect((await publicHomepageStats()).stats.find((s) => s.key === "win_rate")!.status).toBe("verified");
    await updateHomepageStat(id, "win_rate", { ...base, value: "100%", verification: "unverified" });
    row = (await listHomepageStats()).find((r) => r.key === "win_rate")!;
    expect(row).toMatchObject({ verification: "unverified", verification_note: null, verified_at: null });
    const logs = await q<{ details: { after: { value: string } } }>("select details from audit_logs where action = 'admin.update_homepage_stat' order by id");
    expect(logs.map((l) => l.details.after.value)).toEqual(["58.4%", "100%"]);
  });

  it("live mode shows the figure from BETVANTA's records, never the typed value", async () => {
    const id = await admin();
    await q(`insert into users(email, password_hash, display_name, age_confirmed_at, terms_accepted_at) values ('m1@x.com','x','M',now(),now()), ('m2@x.com','x','N',now(),now())`);
    await updateHomepageStat(id, "members", { label: "Members", source: "live", value: "2,000+", verification: "unverified", visible: true });
    const m = (await publicHomepageStats()).stats.find((s) => s.key === "members")!;
    expect(m).toMatchObject({ value: "2", status: "live" });
    await updateHomepageStat(id, "win_rate", { ...base, source: "live", value: "100%", verification: "unverified" });
    expect((await publicHomepageStats()).stats.find((s) => s.key === "win_rate")).toMatchObject({ value: "Building", status: "live" });
  });

  it("hidden statistics are not shown", async () => {
    await updateHomepageStat(await admin(), "sports", { label: "Sports Covered", source: "manual", value: "10", verification: "unverified", visible: false });
    expect((await publicHomepageStats()).stats.map((s) => s.key)).toEqual(["members", "win_rate", "winning_picks"]);
  });

  it("rejects unknown slots", async () => {
    await expect(updateHomepageStat(await admin(), "revenue", { ...base, value: "1", verification: "unverified" })).rejects.toThrow(/Unknown statistic/);
  });

  it("the app role can read and update the rows but cannot add or delete slots", async () => {
    const r = await q<{ priv: string }>(`select privilege_type priv from information_schema.role_table_grants where grantee = 'betvanta_app' and table_name = 'homepage_stats' order by 1`);
    expect(r.map((x) => x.priv)).toEqual(["SELECT", "UPDATE"]);
    const anon = await q("select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_name = 'homepage_stats'");
    expect(anon).toEqual([]);
  });

  it("if migration 010 is missing, the homepage shows live figures instead of failing or inventing numbers", async () => {
    await q("alter table homepage_stats rename to homepage_stats_moved");
    try {
      const r = await publicHomepageStats();
      expect(r.configMissing).toBe(true);
      expect(r.stats.every((s) => s.status === "live")).toBe(true);
      expect(r.stats.map((s) => s.value)).not.toContain("100%");
    } finally { await q("alter table homepage_stats_moved rename to homepage_stats"); }
  });
});
