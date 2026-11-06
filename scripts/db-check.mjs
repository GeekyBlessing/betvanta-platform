// Live checks against the configured database (used by the "Supabase check" GitHub Actions workflow).
// Read-only except for an auth smoke test that runs inside a transaction and is always rolled back.
import crypto from "node:crypto";
import pg from "pg";
import { sslFor, stripSslMode } from "./pg-ssl.mjs";

const appUrl = process.env.DATABASE_URL, adminUrl = process.env.MIGRATION_DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL, anonKey = process.env.SUPABASE_ANON_KEY;
let failed = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`); if (!cond) failed++; };
const connect = async (url) => { const c = new pg.Client({ connectionString: stripSslMode(url), ssl: sslFor(url), connectionTimeoutMillis: 15000 }); await c.connect(); return c; };
if (!appUrl || !adminUrl) { console.error("DATABASE_URL and MIGRATION_DATABASE_URL are required"); process.exit(1); }

// 1. Connectivity, TLS and identity for the app role
const app = await connect(appUrl);
const who = (await app.query("select current_user, version() v, inet_server_addr() is not null as remote")).rows[0];
ok("app connects as betvanta_app", who.current_user === "betvanta_app", who.current_user);
// Check TLS on our side of the socket: with Supabase's pooler, the server-side view only shows pooler-to-database traffic.
const sock = app.connection?.stream;
const tls = Boolean(sock?.encrypted);
if (process.env.DB_CHECK_ALLOW_PLAINTEXT === "1" && !tls) console.log("      TLS check skipped (local database, DB_CHECK_ALLOW_PLAINTEXT=1)");
else ok("connection is encrypted (TLS)", tls, tls ? `${sock.getProtocol?.() ?? "TLS"}, ${sock.getCipher?.()?.name ?? ""}` : "plaintext");
console.log(`      server: ${who.v.split(",")[0]}${process.env.DATABASE_CA_CERT ? ", certificate verified" : ", certificate not pinned (set DATABASE_CA_CERT to verify)"}`);

// 2. Schema and migrations
const admin = await connect(adminUrl);
const migs = (await admin.query("select version from schema_migrations order by version")).rows.map((r) => r.version);
ok("migrations applied", migs.includes("009_rls_and_app_role.sql"), `${migs.length} applied, latest ${migs.at(-1)}`);
const noRls = (await admin.query(`select n.nspname||'.'||c.relname t from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname in ('public','sportsbook') and not c.relrowsecurity`)).rows.map((r) => r.t);
ok("RLS enabled on every table", noRls.length === 0, noRls.join(", "));
const plans = (await app.query("select count(*)::int n from plans where active and currency = 'USD'")).rows[0].n;
ok("app role can read plans (5 USD plans)", plans === 5, `${plans}`);

// 3. Least privilege for the app role
const denied = async (sql) => { try { await app.query("begin"); await app.query(sql); return false; } catch { return true; } finally { await app.query("rollback").catch(() => {}); } };
ok("app role cannot delete users", await denied("delete from users where false"));
ok("app role cannot change the audit log", await denied("update audit_logs set action = action where false"));
ok("app role cannot alter the schema", await denied("create table public.should_not_exist(x int)"));
ok("app role cannot write sportsbook money tables", await denied("insert into sportsbook.wallets(user_id) select id from users limit 1"));

// 4. Supabase public API roles see nothing
for (const role of ["anon", "authenticated"]) {
  const exists = (await admin.query("select 1 from pg_roles where rolname = $1", [role])).rowCount;
  if (!exists) { console.log(`      ${role}: role not present (not a Supabase database)`); continue; }
  const grants = (await admin.query(`select count(*)::int n from information_schema.role_table_grants where grantee = $1 and table_schema in ('public','sportsbook')`, [role])).rows[0].n;
  ok(`${role} has no table privileges`, grants === 0, `${grants} grants`);
}
if (supabaseUrl && anonKey) {
  for (const table of ["users", "payments", "sessions", "plans"]) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
    const body = await res.text();
    const leaked = res.ok && body.trim() !== "[]";
    ok(`Supabase REST API with the anon key cannot read ${table}`, !leaked, `HTTP ${res.status}`);
  }
} else console.log("      skipped REST API check (SUPABASE_URL / SUPABASE_ANON_KEY not set)");

// 5. Authentication smoke test as the app role, rolled back
await app.query("begin");
try {
  const email = `dbcheck-${crypto.randomUUID()}@example.invalid`;
  const salt = crypto.randomBytes(16), key = crypto.scryptSync("db check passphrase", salt, 64, { N: 16384, r: 8, p: 1 });
  const hash = `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
  const u = (await app.query("insert into users(email, password_hash, display_name, age_confirmed_at, terms_accepted_at) values ($1,$2,'DB Check',now(),now()) returning id", [email, hash])).rows[0];
  const stored = (await app.query("select password_hash from users where email = $1", [email])).rows[0].password_hash.split("$");
  const again = crypto.scryptSync("db check passphrase", Buffer.from(stored[4], "base64"), 64, { N: 16384, r: 8, p: 1 });
  ok("auth: password hash round-trips (login would succeed)", crypto.timingSafeEqual(again, Buffer.from(stored[5], "base64")));
  const tok = crypto.createHash("sha256").update(crypto.randomBytes(32)).digest("hex");
  await app.query("insert into sessions(id, user_id, expires_at) values ($1,$2, now() + interval '1 day')", [tok, u.id]);
  const s = (await app.query("select u.email from sessions s join users u on u.id = s.user_id where s.id = $1 and s.expires_at > now()", [tok])).rows[0];
  ok("auth: session lookup resolves the user", s?.email === email);
  await app.query("insert into audit_logs(actor_id, action, entity, entity_id) values ($1::uuid,'dbcheck','user',$2::text)", [u.id, u.id]);
  ok("auth: audit log accepts inserts", true);
} catch (e) { ok("auth smoke test", false, String(e.message ?? e)); }
finally { await app.query("rollback"); }
const leftovers = (await admin.query("select count(*)::int n from users where email like 'dbcheck-%@example.invalid'")).rows[0].n;
ok("auth smoke test left no data behind", leftovers === 0);

await app.end(); await admin.end();
console.log(failed ? `\n${failed} check(s) failed` : "\nAll database checks passed");
process.exit(failed ? 1 : 0);
