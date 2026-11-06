// End-to-end check of the running app over HTTP: auth, gating, admin flow, payments, webhooks, CSRF, headers.
import crypto from "node:crypto";
import pg from "pg";
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const STUB = process.env.E2E_STUB ?? "http://127.0.0.1:4599";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { if (cond) { pass++; console.log("  ok  ", name); } else { fail++; console.log("  FAIL", name, extra); } };

function client() {
  const jar = {};
  return async (path, { method = "GET", json, headers = {}, raw } = {}) => {
    const h = { origin: BASE, ...headers, cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") };
    if (json) h["content-type"] = "application/json";
    const res = await fetch(BASE + path, { method, headers: h, body: raw ?? (json ? JSON.stringify(json) : undefined), redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const [k, v] = kv.split("="); if (v) jar[k] = v; else delete jar[k]; }
    const text = await res.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body, headers: res.headers };
  };
}
const tokenFor = async (email) => (await db.query("select body_text from email_outbox where to_email = $1 order by created_at desc limit 1", [email])).rows[0]?.body_text.match(/token=([A-Za-z0-9_-]+)/)?.[1];

const stamp = Date.now();
const admin = client(), member = client(), anon = client();
console.log("auth");
check("health endpoint reports database up", (await anon("/api/health")).body.db === "up");
let r = await admin("/api/auth/register", { method: "POST", json: { displayName: "Admin", email: "admin@betvanta.test", password: "admin passphrase long", confirmAge: true, acceptTerms: true } });
if (r.status === 409) r = await admin("/api/auth/login", { method: "POST", json: { email: "admin@betvanta.test", password: "admin passphrase long" } });
check("admin can register or log in", r.body.ok, JSON.stringify(r.body));
const memberEmail = `member${stamp}@example.com`;
r = await member("/api/auth/register", { method: "POST", json: { displayName: "Member", email: memberEmail, password: "member passphrase long", confirmAge: true, acceptTerms: true } });
check("member registers and gets a session", r.status === 201 && r.body.ok);
r = await member("/api/auth/register", { method: "POST", json: { displayName: "Member", email: memberEmail, password: "short", confirmAge: false, acceptTerms: true } });
check("invalid registration is rejected with field errors", r.status === 422 && r.body.error.details.password);
check("wrong password is rejected", (await anon("/api/auth/login", { method: "POST", json: { email: memberEmail, password: "not the password" } })).status === 401);
check("dashboard requires login", (await anon("/dashboard")).status === 307);
check("member cannot open admin API", (await member("/api/admin/engine", { method: "POST", json: {} })).status === 403);
check("anonymous cannot open admin API", (await anon("/api/admin/engine", { method: "POST", json: {} })).status === 401);
check("cross-site POST is blocked (CSRF)", (await member("/api/billing/cancel", { method: "POST", json: {}, headers: { origin: "https://evil.example" } })).status === 403);

console.log("sports data and predictions");
r = await admin("/api/admin/sync", { method: "POST", json: {} }); check("admin syncs sports data", r.body.ok, JSON.stringify(r.body));
r = await admin("/api/admin/engine", { method: "POST", json: {} }); check("engine generates drafts", r.body.ok, JSON.stringify(r.body));
const drafts = (await db.query("select p.id from predictions p join fixtures f on f.id = p.fixture_id where p.status = 'draft' and f.kickoff_at > now()")).rows;
for (const d of drafts) await admin(`/api/admin/predictions/${d.id}`, { method: "PATCH", json: { action: "publish" } });
check("admin publishes drafts (rerun-safe)", (await db.query("select count(*)::int n from predictions where status='published'")).rows[0].n > 0 && (await db.query("select count(*)::int n from predictions p join fixtures f on f.id=p.fixture_id where p.status='draft' and f.kickoff_at > now()")).rows[0].n === 0);
r = await member("/api/predictions");
const locked = r.body.data.predictions.filter((p) => p.locked);
check("free member sees premium picks as locked", r.body.data.tier === "free" && locked.length > 0 && locked.every((p) => p.selection === null && p.analysis === null));
const home = await anon("/predictions");
const lockedSel = (await db.query("select p.selection, ht.name from predictions p join fixtures f on f.id=p.fixture_id join teams ht on ht.id=f.home_team_id where p.access_tier='vip' and p.status='published' limit 1")).rows[0];
check("public predictions page renders", home.status === 200 && home.body.includes("Upcoming predictions"));
check("locked analysis text never reaches the browser", !home.body.includes("Model probability"));

console.log("payments");
r = await member("/api/billing/checkout", { method: "POST", json: { planCode: "premium_monthly" } });
check("unverified member cannot check out", r.status === 403);
const vt = await tokenFor(memberEmail);
check("verification email recorded", Boolean(vt));
check("email verification succeeds", (await member("/api/auth/verify", { method: "POST", json: { token: vt } })).body.ok);
r = await member("/api/billing/checkout", { method: "POST", json: { planCode: "vip_monthly" } });
check("verified member starts checkout", r.body.ok && r.body.data.next.includes("/checkout/"), JSON.stringify(r.body));
const ref = r.body.data.reference;
r = await member(`/billing/callback?reference=${ref}`);
check("callback before payment does not grant access", r.body.includes("still processing") && (await member("/api/predictions")).body.data.tier === "free");
await fetch(`${STUB}/__pay/${ref}`, { method: "POST", body: JSON.stringify({ status: "success", amount: 2500000, currency: "NGN" }) });
r = await member(`/billing/callback?reference=${ref}`);
check("callback after verified payment activates VIP", r.body.includes("Payment verified") && (await member("/api/predictions")).body.data.tier === "vip");
const unlocked = (await member("/api/predictions")).body.data.predictions;
check("VIP member sees all selections", unlocked.every((p) => !p.locked && p.selection));
const body = JSON.stringify({ event: "charge.success", data: { id: 99, reference: ref } });
const sig = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(body).digest("hex");
check("webhook with bad signature is rejected", (await anon("/api/webhooks/paystack", { method: "POST", raw: body, headers: { "x-paystack-signature": "00" + sig.slice(2), "content-type": "application/json" } })).status === 401);
check("signed webhook is accepted", (await anon("/api/webhooks/paystack", { method: "POST", raw: body, headers: { "x-paystack-signature": sig, "content-type": "application/json" } })).body.ok);
const replay = await anon("/api/webhooks/paystack", { method: "POST", raw: body, headers: { "x-paystack-signature": sig, "content-type": "application/json" } });
check("replayed webhook is ignored", replay.body.duplicate === true);
check("exactly one subscription after callback + webhook", (await db.query("select count(*)::int n from subscriptions s join users u on u.id=s.user_id where u.email=$1", [memberEmail])).rows[0].n === 1);
const ref2 = (await member("/api/billing/checkout", { method: "POST", json: { planCode: "premium_monthly" } })).body.data.reference;
await fetch(`${STUB}/__pay/${ref2}`, { method: "POST", body: JSON.stringify({ status: "success", amount: 50000, currency: "NGN" }) });
check("underpayment is flagged, not activated", (await member(`/billing/callback?reference=${ref2}`)).body.includes("under review"));
check("member can cancel and keeps access", (await member("/api/billing/cancel", { method: "POST", json: {} })).body.ok && (await member("/api/predictions")).body.data.tier === "vip");

console.log("account and cron");
check("settings save", (await member("/api/account", { method: "PATCH", json: { displayName: "Member Two", notifyPredictions: false, notifyBilling: true } })).body.ok);
check("password change requires current password", (await member("/api/account/password", { method: "POST", json: { currentPassword: "nope", newPassword: "another long passphrase" } })).status === 400);
check("cron rejects missing secret", (await anon("/api/cron/daily")).status === 401);
check("cron runs with secret", (await anon("/api/cron/daily", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).body.ok);
check("logout clears session", (await member("/api/auth/logout", { method: "POST", json: {} })).body.ok && (await member("/dashboard")).status === 307);

console.log("headers and pages");
const h = (await anon("/")).headers;
check("security headers present", h.get("content-security-policy")?.includes("frame-ancestors 'none'") && h.get("x-frame-options") === "DENY" && h.get("x-content-type-options") === "nosniff" && !h.get("x-powered-by"));
for (const p of ["/", "/pricing", "/performance", "/about", "/faq", "/contact", "/legal/terms", "/legal/privacy", "/responsible-gambling", "/login", "/register", "/forgot-password"]) {
  const x = await anon(p); check(`page ${p} renders with BETVANTA title`, x.status === 200 && /<title>[^<]*BETVANTA/.test(x.body));
}
for (const p of ["/admin", "/admin/predictions", "/admin/users", "/admin/payments", "/admin/plans", "/admin/audit", "/admin/data", "/admin/emails"]) check(`admin page ${p}`, (await admin(p)).status === 200);
check("rate limit kicks in on repeated failed logins", await (async () => { let last; for (let i = 0; i < 10; i++) last = await anon("/api/auth/login", { method: "POST", json: { email: "ratelimit@example.com", password: "wrong" } }); return last.status === 429; })());
await db.end();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
