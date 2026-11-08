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
/**
 * How the app's DATABASE_URL reaches Supabase, without exposing it: which pooler mode (by port) and whether it uses the
 * least-privilege app role. The app must use the Transaction pooler (6543) as betvanta_app; the Session pooler (5432)
 * allows only pool_size clients in total, which serverless instances exhaust, and the postgres role bypasses the app's grants.
 */
export function dbConnectionShape(url = process.env.DATABASE_URL ?? "") {
  try {
    const u = new URL(url);
    const pooler = /pooler\.supabase\.com$/.test(u.hostname);
    const user = decodeURIComponent(u.username).split(".")[0];
    return { pooler, mode: !pooler ? "n/a" : u.port === "6543" ? "transaction" : "session", appRole: user === "betvanta_app" };
  } catch { return { pooler: false, mode: "n/a", appRole: false }; }
}
const isSupabaseDirectHost = (url: string) => { try { return /^db\.[a-z0-9]+\.supabase\.co$/.test(new URL(url).hostname); } catch { return false; } };
function makePool() {
  const url = env().DATABASE_URL;
  if (!url) throw Object.assign(new Error("DATABASE_URL is not set"), { code: "NO_DATABASE_URL" });
  if (isSupabaseDirectHost(url)) console.error("[db] DATABASE_URL uses Supabase's IPv6-only direct host (db.<ref>.supabase.co); Vercel cannot reach it. Use the Transaction pooler string (…pooler.supabase.com:6543). See docs/SUPABASE.md.");
  const shape = dbConnectionShape(url);
  if (shape.pooler && (shape.mode !== "transaction" || !shape.appRole)) console.error(`[db] DATABASE_URL should be the betvanta_app Transaction pooler string (port 6543); it is using the ${shape.mode} pooler${shape.appRole ? "" : " with an admin role"}. See docs/SUPABASE.md.`);
  // Serverless instances are many and short-lived: one connection each keeps the total small.
  return new Pool({ connectionString: stripSslMode(url), ssl: sslFor(url), max: process.env.VERCEL ? 1 : 3, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 10_000 });
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
