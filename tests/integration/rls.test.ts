import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers";
import { pool, q } from "@/lib/db";

/** Run SQL as a given role inside a transaction that is always rolled back. */
async function asRole(role: string, sql: string, params: unknown[] = []) {
  const c = await pool().connect();
  try { await c.query("begin"); await c.query(`set local role ${role}`); return await c.query(sql, params); }
  finally { await c.query("rollback"); c.release(); }
}
const denied = (role: string, sql: string, params: unknown[] = []) => asRole(role, sql, params).then(() => false, () => true);

describe("row level security and roles", () => {
  beforeEach(resetDb);
  it("has RLS enabled on every table in public and sportsbook", async () => {
    const missing = await q(`select n.nspname||'.'||c.relname t from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname in ('public','sportsbook') and not c.relrowsecurity`);
    expect(missing).toEqual([]);
  });
  it("gives Supabase's anon and authenticated roles no access to any table", async () => {
    for (const role of ["anon", "authenticated"]) {
      const grants = await q("select count(*)::int n from information_schema.role_table_grants where grantee = $1 and table_schema in ('public','sportsbook')", [role]);
      expect(grants[0].n).toBe(0);
      for (const t of ["users", "payments", "sessions", "plans", "predictions"]) expect(await denied(role, `select * from ${t} limit 1`)).toBe(true);
    }
  });
  it("lets the app role do its job", async () => {
    expect((await asRole("betvanta_app", "select count(*)::int n from plans where active")).rows[0].n).toBe(5);
    await asRole("betvanta_app", `insert into users(email, password_hash, display_name, age_confirmed_at, terms_accepted_at) values ('rls@x.com','x','R',now(),now())`);
  });
  it("blocks the app role from destructive or privileged operations", async () => {
    expect(await denied("betvanta_app", "delete from users")).toBe(true);
    expect(await denied("betvanta_app", "delete from payments")).toBe(true);
    expect(await denied("betvanta_app", "update audit_logs set action = 'x'")).toBe(true);
    expect(await denied("betvanta_app", "truncate sessions")).toBe(true);
    expect(await denied("betvanta_app", "create table public.x(i int)")).toBe(true);
    expect(await denied("betvanta_app", "update schema_migrations set version = version")).toBe(true);
    expect(await denied("betvanta_app", "insert into sportsbook.bets(user_id, fixture_id, market, selection, price, stake_minor) values (gen_random_uuid(), gen_random_uuid(), 'x','x',2,1)")).toBe(true);
  });
  it("lets the app delete draft predictions but never published ones (policy, not just code)", async () => {
    const c = await pool().connect();
    try {
      await c.query("begin");
      const comp = (await c.query("insert into competitions(name, country, season, provider_ref, data_source) values ('L','C',2026,'rls-c','mock') returning id")).rows[0].id;
      const t1 = (await c.query("insert into teams(name, short_name, provider_ref, data_source) values ('A','A','rls-a','mock') returning id")).rows[0].id;
      const t2 = (await c.query("insert into teams(name, short_name, provider_ref, data_source) values ('B','B','rls-b','mock') returning id")).rows[0].id;
      const f = (await c.query("insert into fixtures(competition_id, home_team_id, away_team_id, kickoff_at, provider_ref, data_source) values ($1,$2,$3, now() + interval '1 day','rls-f','mock') returning id", [comp, t1, t2])).rows[0].id;
      await c.query("insert into predictions(fixture_id, market, selection, confidence, status) values ($1,'1X2','Home win','low','draft'), ($1,'BTTS','Yes','low','published')", [f]);
      await c.query("set local role betvanta_app");
      const del = await c.query("delete from predictions where fixture_id = $1 returning status", [f]);
      expect(del.rows.map((r) => r.status)).toEqual(["draft"]);
      expect((await c.query("select status from predictions where fixture_id = $1", [f])).rows.map((r) => r.status)).toEqual(["published"]);
    } finally { await c.query("rollback"); c.release(); }
  });
});
