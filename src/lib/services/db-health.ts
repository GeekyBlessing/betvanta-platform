import { q, one } from "../db";
import { homeStats } from "./stats";
import { listPredictions } from "./predictions";
import { approvedTestimonials } from "./testimonials";
import { listCompetitions, standings, listFixtures } from "./sports";
import { userFromToken } from "../session";

/** The newest file in db/migrations. A unit test keeps this in step with the folder. */
export const LATEST_MIGRATION = "009_rls_and_app_role.sql";

export type CheckResult = { name: string; ok: boolean; ms: number; detail?: string; code?: string };

/**
 * Runs the same reads the public pages and sign-in run, against the configured database.
 * Read-only: every check is a select, except the session lookup, which matches no row for a random token.
 */
export async function runDbHealth(): Promise<{ ok: boolean; checks: CheckResult[] }> {
  const checks: CheckResult[] = [];
  const run = async (name: string, fn: () => Promise<string | void>) => {
    const t = Date.now();
    try { const detail = await fn(); checks.push({ name, ok: true, ms: Date.now() - t, ...(detail ? { detail } : {}) }); }
    catch (e) {
      const err = e as { code?: string; message?: string };
      checks.push({ name, ok: false, ms: Date.now() - t, code: err.code ?? "error", detail: (err.message ?? String(e)).slice(0, 200) });
    }
  };
  await run("connection", async () => {
    const r = await one<{ u: string }>("select current_user u");
    return `connected as ${r!.u}`;
  });
  await run("migrations", async () => {
    const r = await one<{ n: number; latest: string | null }>("select count(*)::int n, max(version) latest from schema_migrations");
    if (r!.latest !== LATEST_MIGRATION) throw Object.assign(new Error(`latest applied ${r!.latest ?? "none"}, expected ${LATEST_MIGRATION}`), { code: "PENDING_MIGRATIONS" });
    return `${r!.n} applied, latest ${r!.latest}`;
  });
  await run("homepage statistics (users, predictions, competitions, fixtures)", async () => { const s = await homeStats(); return `${s.members} members, ${s.settled} settled`; });
  await run("predictions list (free view)", async () => `${(await listPredictions("free", { upcoming: true, limit: 12 })).length} upcoming`);
  await run("settled predictions", async () => `${(await listPredictions("free", { settled: true, limit: 5 })).length} rows`);
  await run("testimonials", async () => `${(await approvedTestimonials(6)).length} approved`);
  await run("plans", async () => {
    const r = await q<{ code: string }>("select code from plans where active and currency = 'USD' order by level");
    if (r.length !== 5) throw Object.assign(new Error(`${r.length} active USD plans, expected 5`), { code: "PLANS" });
    return r.map((p) => p.code).join(", ");
  });
  await run("competitions and standings", async () => {
    const comps = await listCompetitions(null);
    if (comps[0]) await standings(comps[0].id);
    return `${comps.length} active competitions`;
  });
  await run("fixtures", async () => `${(await listFixtures({ mode: "upcoming", limit: 5 })).length} upcoming`);
  await run("session lookup (sign-in path)", async () => { await userFromToken("health-check-token-that-matches-no-session"); });
  return { ok: checks.every((c) => c.ok), checks };
}
