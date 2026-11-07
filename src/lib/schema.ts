import { one } from "./db";
import { LATEST_MIGRATION } from "./migrations";

/**
 * Guards for code that ships before its migration has been applied. Vercel deploys on every push, but migrations
 * are a separate, deliberate step, so for a while the code can be ahead of the database. Features that need a newer
 * table check here and switch themselves off with a visible notice, instead of crashing the whole page.
 */
const cache = new Map<string, { ok: boolean; at: number }>();
export async function tableExists(qualified: string): Promise<boolean> {
  const hit = cache.get(qualified);
  if (hit && (hit.ok || Date.now() - hit.at < 30_000)) return hit.ok; // a present table never disappears; recheck absence every 30s
  const r = await one<{ ok: boolean }>("select to_regclass($1) is not null as ok", [qualified]);
  const ok = Boolean(r?.ok);
  cache.set(qualified, { ok, at: Date.now() });
  if (!ok) console.error(`[schema] ${qualified} is missing: the deployed code needs a migration that has not been applied. Run the Supabase check workflow in "apply" mode.`);
  return ok;
}

/** True when table.column exists (for features whose migration adds columns). */
export async function columnExists(table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  const hit = cache.get(key);
  if (hit && (hit.ok || Date.now() - hit.at < 30_000)) return hit.ok;
  const r = await one<{ ok: boolean }>("select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2) ok", [table, column]);
  const ok = Boolean(r?.ok);
  cache.set(key, { ok, at: Date.now() });
  if (!ok) console.error(`[schema] public.${key} is missing: apply the pending migrations (Supabase check workflow, apply mode).`);
  return ok;
}

export async function schemaStatus() {
  const r = await one<{ latest: string | null; n: number }>("select max(version) latest, count(*)::int n from schema_migrations");
  const latest = r?.latest ?? null;
  return { latest, expected: LATEST_MIGRATION, applied: r?.n ?? 0, current: latest !== null && latest >= LATEST_MIGRATION };
}
export function resetSchemaCache() { cache.clear(); }
