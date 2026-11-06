// Turns on LOGIN for the least-privilege betvanta_app role and sets its password from APP_DB_PASSWORD.
// Run as the schema owner (MIGRATION_DATABASE_URL). The password is passed as a parameter-free literal
// built with quote_literal on the server, and is never printed.
import pg from "pg";
import { sslFor, stripSslMode } from "./pg-ssl.mjs";
const admin = process.env.MIGRATION_DATABASE_URL, pw = process.env.APP_DB_PASSWORD;
if (!admin || !pw) { console.error("db-app-role: MIGRATION_DATABASE_URL and APP_DB_PASSWORD are required"); process.exit(1); }
if (pw.length < 24) { console.error("db-app-role: APP_DB_PASSWORD must be at least 24 characters"); process.exit(1); }
const c = new pg.Client({ connectionString: stripSslMode(admin), ssl: sslFor(admin) });
await c.connect();
try {
  const { rows } = await c.query("select format('alter role betvanta_app with login password %L', $1::text) as sql", [pw]);
  await c.query(rows[0].sql);
  await c.query("alter role betvanta_app set statement_timeout = '15s'");
  console.log("db-app-role: betvanta_app can log in (password set from secret)");
} finally { await c.end(); }
