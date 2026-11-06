import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "./env";

declare global { var __bvPool: Pool | undefined; }

/**
 * Supabase: connect through the transaction pooler (port 6543) as the least-privilege betvanta_app role.
 * TLS is always on for remote hosts; set DATABASE_CA_CERT to verify the server certificate fully.
 * node-pg uses unnamed statements, which the transaction pooler supports.
 */
export function sslFor(url: string) {
  const remote = /sslmode=(require|verify)|supabase\.(co|com)|pooler\.supabase|neon\.tech|render\.com/.test(url);
  const ca = process.env.DATABASE_CA_CERT;
  if (ca) return { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true };
  return remote ? { rejectUnauthorized: false } : undefined;
}
const stripSslMode = (url: string) => url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
const isSupabaseDirectHost = (url: string) => { try { return /^db\.[a-z0-9]+\.supabase\.co$/.test(new URL(url).hostname); } catch { return false; } };
function makePool() {
  const url = env().DATABASE_URL;
  if (isSupabaseDirectHost(url)) console.error("[db] DATABASE_URL uses Supabase's IPv6-only direct host (db.<ref>.supabase.co); Vercel cannot reach it. Use the Transaction pooler string (…pooler.supabase.com:6543). See docs/SUPABASE.md.");
  return new Pool({ connectionString: stripSslMode(url), ssl: sslFor(url), max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
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
