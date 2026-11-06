import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { closePool, resetDb } from "../helpers";
import { q } from "@/lib/db";
import { LATEST_MIGRATION, runDbHealth } from "@/lib/services/db-health";
// @ts-expect-error plain ESM script without type declarations
import { diff, plannedCreates, snapshot } from "../../scripts/db-inspect.mjs";

const expected = JSON.parse(fs.readFileSync(path.join(process.cwd(), "db/schema.expected.json"), "utf8"));
beforeAll(resetDb);
afterAll(closePool);

describe("database schema", () => {
  it("LATEST_MIGRATION is the newest migration file", () => {
    const files = fs.readdirSync(path.join(process.cwd(), "db/migrations")).filter((f) => f.endsWith(".sql")).sort();
    expect(LATEST_MIGRATION).toBe(files.at(-1));
  });

  it("the migrations produce exactly db/schema.expected.json", async () => {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    try { expect(diff(expected, await snapshot(c))).toEqual({}); } finally { await c.end(); }
  });

  it("includes the tables the production errors named", () => {
    for (const t of ["public.users", "public.predictions", "public.testimonials"]) expect(expected.tables).toContain(t);
  });

  it("every table has row level security", () => {
    expect([...expected.tables].sort()).toEqual([...expected.rls].sort());
  });

  it("pre-flight detects migrations that would collide with existing tables", () => {
    const creates = plannedCreates(["001_init.sql", "008_testimonials.sql"]);
    expect(creates["001_init.sql"]).toEqual(expect.arrayContaining(["public.users", "public.predictions", "public.sessions"]));
    expect(creates["008_testimonials.sql"]).toContain("public.testimonials");
  });

  it("diff reports missing and unexpected objects", () => {
    expect(diff({ tables: ["public.a", "public.b"] }, { tables: ["public.b", "public.c"] })).toEqual({ tables: { missing: ["public.a"], unexpected: ["public.c"] } });
  });
});

describe("deep database health", () => {
  it("passes every real app query on a migrated database", async () => {
    const r = await runDbHealth();
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("reports a missing table with its Postgres error code instead of hiding it", async () => {
    await q("alter table testimonials rename to testimonials_moved");
    try {
      const r = await runDbHealth();
      const t = r.checks.find((c) => c.name === "testimonials")!;
      expect(r.ok).toBe(false);
      expect(t).toMatchObject({ ok: false, code: "42P01" });
      expect(t.detail).toContain('relation "testimonials" does not exist');
    } finally { await q("alter table testimonials_moved rename to testimonials"); }
  });
});
