// Fails if anything secret-looking, or the value of any server-only secret env var, appears in browser JS/CSS.
import fs from "node:fs";
import path from "node:path";
const dir = path.join(process.cwd(), ".next", "static");
if (!fs.existsSync(dir)) { console.error("Run next build first"); process.exit(1); }
const SECRET_VARS = ["DATABASE_URL", "MIGRATION_DATABASE_URL", "APP_DB_PASSWORD", "SUPABASE_ADMIN_DB_URL", "SUPABASE_SERVICE_ROLE_KEY", "PAYSTACK_SECRET_KEY",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NOWPAYMENTS_API_KEY", "NOWPAYMENTS_IPN_SECRET", "RESEND_API_KEY", "OPENAI_API_KEY", "API_FOOTBALL_KEY",
  "DISCORD_CLIENT_SECRET", "DISCORD_BOT_TOKEN", "CRON_SECRET", "DATABASE_CA_CERT"];
const patterns = [/postgres(ql)?:\/\/[^\s"']+/, /\bsk_(test|live)_[A-Za-z0-9]{8,}/, /\bwhsec_[A-Za-z0-9]{8,}/, /service_role/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
const values = SECRET_VARS.map((k) => process.env[k]).filter((v) => v && v.length >= 8);
const hits = [];
function jwtRole(t) { try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).role; } catch { return null; } }
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|css|json|map)$/.test(f)) {
  const s = fs.readFileSync(p, "utf8");
  for (const re of patterns) if (re.test(s)) hits.push(`${path.relative(dir, p)}: matches ${re}`);
  for (const m of s.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []) if (jwtRole(m) === "service_role") hits.push(`${path.relative(dir, p)}: contains a Supabase service_role key`);
  for (const v of values) if (s.includes(v)) hits.push(`${path.relative(dir, p)}: contains the value of a server-only secret`);
} } };
walk(dir);
// The Supabase project URL and anon/publishable key are public by design; anything else secret-looking is not.
const PUBLIC_OK = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
const leakedPublic = Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_") && !PUBLIC_OK.has(k) && /SECRET|KEY|TOKEN|PASSWORD|DATABASE|SERVICE/.test(k));
for (const k of PUBLIC_OK) { const v = process.env[k]; if (v && /^eyJ/.test(v) && jwtRole(v) === "service_role") hits.push(`env ${k}: holds a service_role key; it must be the anon/publishable key`); }
for (const k of leakedPublic) hits.push(`env ${k}: secret-like variable exposed to the browser via NEXT_PUBLIC_`);
if (hits.length) { console.error("Secret exposure check FAILED:\n" + hits.join("\n")); process.exit(1); }
console.log(`Secret exposure check passed (${values.length} secret values and ${patterns.length} patterns scanned in browser assets).`);
