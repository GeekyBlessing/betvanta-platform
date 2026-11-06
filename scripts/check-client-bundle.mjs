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
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|css|json|map)$/.test(f)) {
  const s = fs.readFileSync(p, "utf8");
  for (const re of patterns) if (re.test(s)) hits.push(`${path.relative(dir, p)}: matches ${re}`);
  for (const v of values) if (s.includes(v)) hits.push(`${path.relative(dir, p)}: contains the value of a server-only secret`);
} } };
walk(dir);
const leakedPublic = Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_") && /SECRET|KEY|TOKEN|PASSWORD|DATABASE/.test(k));
for (const k of leakedPublic) hits.push(`env ${k}: secret-like variable exposed to the browser via NEXT_PUBLIC_`);
if (hits.length) { console.error("Secret exposure check FAILED:\n" + hits.join("\n")); process.exit(1); }
console.log(`Secret exposure check passed (${values.length} secret values and ${patterns.length} patterns scanned in browser assets).`);
