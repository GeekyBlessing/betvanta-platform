// Applies db/migrations/*.sql in order, once each, inside a transaction with an advisory lock.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

import { sslFor, stripSslMode } from "./pg-ssl.mjs";
// Migrations run as the schema owner (Supabase: the postgres role via the session pooler, port 5432).
// The running app uses DATABASE_URL with the least-privilege betvanta_app role.
const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  if (process.env.SKIP_MIGRATIONS === "1") { console.log("migrate: skipped (no DATABASE_URL)"); process.exit(0); }
  console.error("migrate: MIGRATION_DATABASE_URL or DATABASE_URL is not set"); process.exit(1);
}
const client = new pg.Client({ connectionString: stripSslMode(url), ssl: sslFor(url) });
const dir = path.join(process.cwd(), "db", "migrations");
await client.connect();
try {
  await client.query("select pg_advisory_lock(727274)");
  await client.query("create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await client.query("select version from schema_migrations")).rows.map((r) => r.version));
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations(version) values ($1)", [f]);
      await client.query("commit");
      console.log("migrate: applied", f);
    } catch (e) { await client.query("rollback"); throw e; }
  }
  console.log("migrate: up to date");
} finally {
  await client.query("select pg_advisory_unlock(727274)").catch(() => {});
  await client.end();
}
