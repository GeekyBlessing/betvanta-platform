// Read-only inspection of a live database against the schema BETVANTA's migrations produce.
//
//   node scripts/db-inspect.mjs                 report only (never fails on drift)
//   node scripts/db-inspect.mjs --preflight     exit 1 if applying pending migrations is unsafe (partial or foreign schema)
//   node scripts/db-inspect.mjs --strict        exit 1 on any drift from db/schema.expected.json or any pending migration
//   node scripts/db-inspect.mjs --write-expected   regenerate db/schema.expected.json (run against a fresh, fully migrated database)
//
// Connects with MIGRATION_DATABASE_URL (or DATABASE_URL). The session is set to read-only, so this script cannot change anything.
// It prints table names, column names, row counts and migration versions. It never prints connection strings or row contents.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { connectionHint, describeConnectError, sslFor, stripSslMode } from "./pg-ssl.mjs";

const args = new Set(process.argv.slice(2));
const SCHEMAS = ["public", "sportsbook"];
const root = process.cwd();
const expectedPath = path.join(root, "db", "schema.expected.json");
const migrationsDir = path.join(root, "db", "migrations");

export async function snapshot(client) {
  const rows = async (sql) => (await client.query(sql, [SCHEMAS])).rows;
  // Objects that belong to an extension (pgcrypto in public locally, in "extensions" on Supabase) are not ours.
  const notExt = (cls, col) => `not exists (select 1 from pg_depend d where d.classid = '${cls}'::regclass and d.objid = ${col} and d.deptype = 'e')`;
  const tables = await rows(`select n.nspname s, c.relname t, c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','p') and n.nspname = any($1) and ${notExt("pg_class", "c.oid")} order by 1, 2`);
  const columns = await rows(`select n.nspname s, c.relname t, a.attname col, format_type(a.atttypid, a.atttypmod) type, a.attnotnull notnull
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','p') and n.nspname = any($1) and a.attnum > 0 and not a.attisdropped and ${notExt("pg_class", "c.oid")} order by 1, 2, a.attnum`);
  const constraints = await rows(`select n.nspname s, c.relname t, k.conname name, k.contype type,
      case when k.contype = 'f' then (select fn.nspname||'.'||fc.relname from pg_class fc join pg_namespace fn on fn.oid = fc.relnamespace where fc.oid = k.confrelid) end ref
    from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = any($1) and k.contype in ('p','f','u','c','x') order by 1, 2, 3`);
  const indexes = await rows(`select schemaname s, tablename t, indexname name from pg_indexes where schemaname = any($1) order by 1, 2, 3`);
  // Event-trigger functions are installed by the platform (Supabase's rls_auto_enable, for example); BETVANTA's migrations
  // create none. They are reported separately and never counted as drift.
  const allFunctions = await rows(`select n.nspname s, p.proname name, pg_get_function_identity_arguments(p.oid) args, p.prorettype = 'event_trigger'::regtype platform
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = any($1) and ${notExt("pg_proc", "p.oid")} order by 1, 2, 3`);
  const functions = allFunctions.filter((r) => !r.platform);
  const triggers = await rows(`select n.nspname s, c.relname t, tg.tgname name, pr.proname fn from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace join pg_proc pr on pr.oid = tg.tgfoid where not tg.tgisinternal and n.nspname = any($1) order by 1, 2, 3`);
  const policies = await rows(`select schemaname s, tablename t, policyname name, cmd, array_to_string(roles, ',') roles from pg_policies
    where schemaname = any($1) order by 1, 2, 3`);
  return {
    tables: tables.map((r) => `${r.s}.${r.t}`),
    rls: tables.filter((r) => r.rls).map((r) => `${r.s}.${r.t}`),
    columns: columns.map((r) => `${r.s}.${r.t}.${r.col} ${r.type}${r.notnull ? " not null" : ""}`),
    constraints: constraints.map((r) => `${r.s}.${r.t}: ${r.name} [${r.type}]${r.ref ? ` -> ${r.ref}` : ""}`),
    indexes: indexes.map((r) => `${r.s}.${r.t}: ${r.name}`),
    functions: functions.map((r) => `${r.s}.${r.name}(${r.args})`),
    triggers: triggers.map((r) => `${r.s}.${r.t}: ${r.name} -> ${r.fn}`),
    policies: policies.map((r) => `${r.s}.${r.t}: ${r.name} ${r.cmd} to ${r.roles}`),
    platformFunctions: allFunctions.filter((r) => r.platform).map((r) => `${r.s}.${r.name}(${r.args})`),
  };
}

// Tables each migration creates without "if not exists": if one already exists before that migration runs, the migration fails.
export function plannedCreates(files) {
  const out = {};
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, f), "utf8").replace(/--.*$/gm, "");
    out[f] = [...sql.matchAll(/create\s+table\s+(?!if\s+not\s+exists)([a-z_][a-z0-9_.]*)/gi)].map((m) => (m[1].includes(".") ? m[1] : `public.${m[1]}`).toLowerCase());
  }
  return out;
}

export function diff(expected, live) {
  const out = {};
  for (const k of Object.keys(expected)) {
    const have = new Set(live[k] ?? []), want = new Set(expected[k]);
    const missing = expected[k].filter((x) => !have.has(x)), unexpected = (live[k] ?? []).filter((x) => !want.has(x));
    if (missing.length || unexpected.length) out[k] = { missing, unexpected };
  }
  return out;
}

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) { console.error("db-inspect: MIGRATION_DATABASE_URL or DATABASE_URL is not set"); process.exit(1); }
  const client = new pg.Client({ connectionString: stripSslMode(url), ssl: sslFor(url), connectionTimeoutMillis: 15000 });
  try { await client.connect(); } catch (e) {
    console.error(`db-inspect: cannot connect (${describeConnectError(e)})`);
    const hint = connectionHint(e, url); if (hint) console.error(`db-inspect: ${hint}`);
    process.exit(1);
  }
  let problems = 0, unsafe = 0;
  try {
    await client.query("set session characteristics as transaction read only");
    const live = await snapshot(client);
    if (args.has("--write-expected")) {
      const { platformFunctions: _platform, ...ours } = live; void _platform;
      fs.writeFileSync(expectedPath, JSON.stringify(ours, null, 2) + "\n");
      console.log(`db-inspect: wrote ${path.relative(root, expectedPath)} (${live.tables.length} tables, ${live.columns.length} columns)`);
      return;
    }
    const id = (await client.query(`select current_user u, current_database() d, current_setting('server_version') v,
      current_setting('search_path') sp, exists(select 1 from pg_roles where rolname = 'betvanta_app') app_role,
      exists(select 1 from pg_roles where rolname = 'anon') supabase`)).rows[0];
    console.log(`== Connection\n   user ${id.u}, database ${id.d}, Postgres ${id.v}, search_path "${id.sp}"`);
    console.log(`   Supabase API roles present: ${id.supabase ? "yes" : "no"}; betvanta_app role exists: ${id.app_role ? "yes" : "no"}`);

    // Migrations
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    const hasTracker = live.tables.includes("public.schema_migrations");
    const applied = hasTracker ? (await client.query("select version, applied_at from schema_migrations order by version")).rows : [];
    const done = new Set(applied.map((r) => r.version));
    const pending = files.filter((f) => !done.has(f));
    const unknown = applied.filter((r) => !files.includes(r.version)).map((r) => r.version);
    console.log(`\n== Migrations (${files.length} in repo)`);
    console.log(`   schema_migrations table: ${hasTracker ? "present" : "MISSING (no migration has ever been applied to this database)"}`);
    for (const f of files) console.log(`   ${done.has(f) ? "applied" : "PENDING"}  ${f}${done.has(f) ? `  ${applied.find((r) => r.version === f).applied_at.toISOString()}` : ""}`);
    if (unknown.length) { console.log(`   NOT IN REPO: ${unknown.join(", ")} (applied here but missing from this branch)`); unsafe++; }
    if (pending.length) problems++;

    // Existing tables and data
    console.log(`\n== Tables in ${SCHEMAS.join(", ")} (${live.tables.length})`);
    for (const t of live.tables) {
      const [s, n] = t.split(".");
      const c = (await client.query(`select count(*)::bigint n from ${client.escapeIdentifier(s)}.${client.escapeIdentifier(n)}`)).rows[0].n;
      console.log(`   ${t.padEnd(42)} ${String(c).padStart(8)} rows${live.rls.includes(t) ? "" : "  (RLS off)"}`);
    }
    if (!live.tables.length) console.log("   (none)");

    // Conflicts: tables a pending migration will create that already exist (manual or foreign schema).
    const creates = plannedCreates(pending);
    const conflicts = Object.entries(creates).flatMap(([f, ts]) => ts.filter((t) => live.tables.includes(t)).map((t) => `${f} creates ${t}, which already exists`));
    console.log(`\n== Pre-flight for applying ${pending.length} pending migration(s)`);
    if (conflicts.length) { for (const c of conflicts) console.log(`   CONFLICT  ${c}`); unsafe += conflicts.length; }
    else console.log(pending.length ? "   OK: no pending migration creates a table that already exists; migrations only add objects" : "   Nothing to apply");

    // Drift against the committed expected schema (what a full migration run produces).
    if (!fs.existsSync(expectedPath)) { console.error("db-inspect: db/schema.expected.json is missing"); process.exit(1); }
    const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
    const d = diff(expected, live);
    console.log(`\n== Schema compared with db/schema.expected.json`);
    if (live.platformFunctions?.length) console.log(`   (platform event-trigger functions, not part of BETVANTA's schema and not counted: ${live.platformFunctions.join(", ")})`);
    if (!Object.keys(d).length) console.log("   MATCH: every table, column, constraint, index, function, trigger, RLS flag and policy is present");
    for (const [k, { missing, unexpected }] of Object.entries(d)) {
      const show = (label, xs) => { if (!xs.length) return; console.log(`   ${k}: ${xs.length} ${label}`); for (const x of xs.slice(0, 60)) console.log(`      ${x}`); if (xs.length > 60) console.log(`      ... ${xs.length - 60} more`); };
      show("missing", missing); show("not in BETVANTA's schema", unexpected);
      problems++;
    }
  } finally { await client.end(); }

  if (args.has("--preflight") && unsafe) { console.error(`\ndb-inspect: ${unsafe} conflict(s); not safe to apply migrations automatically. Nothing was changed.`); process.exit(1); }
  if (args.has("--strict") && problems) { console.error("\ndb-inspect: the live schema does not match the migrations (see above)."); process.exit(1); }
  console.log("\ndb-inspect: done (read-only, nothing was changed)");
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
