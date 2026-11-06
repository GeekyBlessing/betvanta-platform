import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "./env";

declare global { var __bvPool: Pool | undefined; }

function makePool() {
  const url = env().DATABASE_URL;
  const ssl = /sslmode=require|supabase|neon\.tech|render\.com/.test(url) ? { rejectUnauthorized: false } : undefined;
  return new Pool({ connectionString: url, ssl, max: 5, idleTimeoutMillis: 10_000 });
}
export function pool(): Pool {
  if (!globalThis.__bvPool) globalThis.__bvPool = makePool();
  return globalThis.__bvPool;
}
export type Db = Pick<PoolClient, "query">;

/** Parameterised query only. Never interpolate user input into `text`. */
export async function q<T extends QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = pool()): Promise<T[]> {
  const r = await db.query<T>(text, params as any[]);
  return r.rows;
}
export async function one<T extends QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = pool()): Promise<T | null> {
  const rows = await q<T>(text, params, db);
  return rows[0] ?? null;
}
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
