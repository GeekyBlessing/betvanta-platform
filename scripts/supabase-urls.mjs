// Derives the app connection string (betvanta_app via the transaction pooler, port 6543) from the admin
// session-pooler string and APP_DB_PASSWORD, and writes both to $GITHUB_ENV with masking. Prints no secrets.
import fs from "node:fs";
const admin = process.env.SUPABASE_ADMIN_DB_URL, pw = process.env.APP_DB_PASSWORD;
if (!admin || !pw) { console.error("SUPABASE_ADMIN_DB_URL and APP_DB_PASSWORD secrets are required"); process.exit(1); }
const u = new URL(admin);
if (!/pooler\.supabase\.com$/.test(u.hostname)) {
  console.error("Use the Session pooler connection string (…pooler.supabase.com:5432). The direct db.<ref>.supabase.co host is IPv6-only and unreachable from GitHub runners.");
  process.exit(1);
}
const [, ref] = decodeURIComponent(u.username).split(".");
if (!ref) { console.error("Admin username should look like postgres.<project-ref>"); process.exit(1); }
const app = new URL(admin);
app.username = encodeURIComponent(`betvanta_app.${ref}`);
app.password = encodeURIComponent(pw);
app.port = "6543";
const out = process.env.GITHUB_ENV;
for (const v of [admin, app.toString(), pw]) console.log(`::add-mask::${v}`);
if (out) fs.appendFileSync(out, `MIGRATION_DATABASE_URL=${admin}\nDATABASE_URL=${app.toString()}\n`);
console.log(`project ref ${ref}; app role connects via ${u.hostname}:6543 (transaction pooler)`);
