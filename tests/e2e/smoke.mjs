// End-to-end check of the running app over HTTP: auth, gating, admin flow, payments, webhooks, CSRF, headers.
import crypto from "node:crypto";
import pg from "pg";
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const STUB = process.env.E2E_STUB ?? "http://127.0.0.1:4599";
// Test-only direct queries use the admin URL when given, so the app itself can run as the restricted role.
const db = new pg.Client({ connectionString: process.env.E2E_ADMIN_DATABASE_URL || process.env.DATABASE_URL }); await db.connect();
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
check("deep health refuses without the cron secret", (await anon("/api/health/deep")).status === 401);
{ const d = await anon("/api/health/deep", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  check("deep health: every real app query succeeds", d.status === 200 && d.body.ok, JSON.stringify(d.body.checks?.filter((c) => !c.ok)));
  check("deep health: app runs as the least-privilege role", d.body.checks?.find((c) => c.name === "connection")?.detail === `connected as ${process.env.E2E_EXPECT_DB_USER ?? "betvanta_app"}`, d.body.checks?.[0]?.detail); }
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

console.log("payments (USD)");
const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
r = await member("/api/billing/checkout", { method: "POST", json: { planCode: "premium_1m", provider: "stripe" } });
check("unverified member cannot check out", r.status === 403);
const vt = await tokenFor(memberEmail);
check("verification email recorded", Boolean(vt));
check("email verification succeeds", (await member("/api/auth/verify", { method: "POST", json: { token: vt } })).body.ok);
check("checkout page lists card and crypto options", await (async () => { const x = await member("/checkout/premium_6m"); return x.status === 200 && x.body.includes("Pay with BTC") && x.body.includes("Card (Stripe)") && x.body.includes("$150"); })());
r = await member("/api/billing/checkout", { method: "POST", json: { planCode: "premium_1m", provider: "stripe" } });
check("Stripe checkout starts in USD", r.body.ok && (await db.query("select currency, amount_minor from payments where reference=$1", [r.body.data.reference])).rows[0].currency === "USD", JSON.stringify(r.body));
const sref = r.body.data.reference;
check("Stripe callback before payment does not grant access", (await member(`/billing/callback?reference=${sref}`)).body.includes("still processing") && (await member("/api/predictions")).body.data.tier === "free");
await fetch(`${STUB}/__pay/${sref}`, { method: "POST", body: JSON.stringify({ status: "success" }) });
check("Stripe callback after payment activates Premium", (await member(`/billing/callback?reference=${sref}`)).body.includes("Payment verified") && (await member("/api/predictions")).body.data.tier === "premium");
const stBody = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { client_reference_id: sref } } });
const ts = Math.floor(Date.now() / 1000);
const stSig = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${ts}.${stBody}`).digest("hex");
check("Stripe webhook with bad signature is rejected", (await anon("/api/webhooks/stripe", { method: "POST", raw: stBody, headers: { "stripe-signature": `t=${ts},v1=${"0".repeat(64)}` } })).status === 400);
check("signed Stripe webhook is accepted and idempotent", (await anon("/api/webhooks/stripe", { method: "POST", raw: stBody, headers: { "stripe-signature": `t=${ts},v1=${stSig}` } })).body.ok && (await db.query("select count(*)::int n from subscriptions s join users u on u.id=s.user_id where u.email=$1", [memberEmail])).rows[0].n === 1);

r = await member("/api/billing/checkout", { method: "POST", json: { planCode: "premium_6m", provider: "nowpayments", payCurrency: "USDT" } });
check("crypto checkout records USDT and USD price", r.body.ok && (await db.query("select pay_currency, method, currency from payments where reference=$1", [r.body.data.reference])).rows[0].pay_currency === "USDT", JSON.stringify(r.body));
const cref = r.body.data.reference;
const paid = await (await fetch(`${STUB}/__pay/${cref}`, { method: "POST", body: JSON.stringify({ status: "confirming" }) })).json();
const ipn = (status) => ({ payment_id: Number(paid.paymentId), payment_status: status, price_amount: 150, price_currency: "usd", order_id: cref, pay_currency: "usdttrc20" });
const npSig = (o) => crypto.createHmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET).update(JSON.stringify(sortKeys(o))).digest("hex");
check("crypto IPN with bad signature is rejected", (await anon("/api/webhooks/nowpayments", { method: "POST", raw: JSON.stringify(ipn("finished")), headers: { "x-nowpayments-sig": "00" + npSig(ipn("finished")).slice(2) } })).status === 401);
await anon("/api/webhooks/nowpayments", { method: "POST", raw: JSON.stringify(ipn("confirming")), headers: { "x-nowpayments-sig": npSig(ipn("confirming")) } });
check("crypto still confirming: no VIP yet", (await member("/api/predictions")).body.data.tier === "premium");
await fetch(`${STUB}/__pay/${cref}`, { method: "POST", body: JSON.stringify({ status: "success" }) });
const fin = ipn("finished");
await anon("/api/webhooks/nowpayments", { method: "POST", raw: JSON.stringify(fin), headers: { "x-nowpayments-sig": npSig(fin) } });
check("crypto IPN 'finished' verified with the API activates 6 Month (VIP picks)", (await member("/api/predictions")).body.data.tier === "vip");
const unlocked = (await member("/api/predictions")).body.data.predictions;
check("VIP member sees all selections", unlocked.every((p) => !p.locked && p.selection));

r = await member("/api/billing/checkout", { method: "POST", json: { planCode: "premium_1m", provider: "paystack" } });
const pref = r.body.data.reference;
await fetch(`${STUB}/__pay/${pref}`, { method: "POST", body: JSON.stringify({ status: "success", amount: 100 }) });
check("Paystack underpayment is flagged, not activated", (await member(`/billing/callback?reference=${pref}`)).body.includes("under review"));
const body = JSON.stringify({ event: "charge.success", data: { id: 99, reference: pref } });
const sig = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(body).digest("hex");
check("Paystack webhook with bad signature is rejected", (await anon("/api/webhooks/paystack", { method: "POST", raw: body, headers: { "x-paystack-signature": "00" + sig.slice(2) } })).status === 401);
check("signed Paystack webhook accepted; replay ignored", (await anon("/api/webhooks/paystack", { method: "POST", raw: body, headers: { "x-paystack-signature": sig } })).body.ok && (await anon("/api/webhooks/paystack", { method: "POST", raw: body, headers: { "x-paystack-signature": sig } })).body.duplicate === true);
check("member can cancel and keeps access", (await member("/api/billing/cancel", { method: "POST", json: {} })).body.ok && (await member("/api/predictions")).body.data.tier === "vip");

console.log("five-plan pricing and lifetime");
const pricing = await anon("/pricing");
check("pricing shows the five USD plans", ["Monthly Premium", "3 Month Premium", "6 Month Premium", "1 Year Premium", "Lifetime Premium", "$50", "$100", "$150", "$300", "$600"].every((s) => pricing.body.includes(s)));
check("pricing highlights one best-value plan", (pricing.body.match(/Best value</g) ?? []).length === 1);
check("pricing has comparison table and payment options", pricing.body.includes("Compare plans") && pricing.body.includes("Weekly private video analysis calls") && pricing.body.includes("Payment options"));
check("anonymous plan selection leads to sign-up then checkout", pricing.body.includes("/register?next=/checkout/premium_1y"));
const life = client(); const lifeEmail = `life${stamp}@example.com`;
await life("/api/auth/register", { method: "POST", json: { displayName: "Life", email: lifeEmail, password: "lifetime passphrase", confirmAge: true, acceptTerms: true } });
await life("/api/auth/verify", { method: "POST", json: { token: await tokenFor(lifeEmail) } });
const lref = (await life("/api/billing/checkout", { method: "POST", json: { planCode: "premium_lifetime", provider: "stripe" } })).body.data.reference;
await fetch(`${STUB}/__pay/${lref}`, { method: "POST", body: JSON.stringify({ status: "success" }) });
await life(`/billing/callback?reference=${lref}`);
const ls = (await db.query("select s.is_lifetime, s.plan_level, s.price_minor, s.current_period_end = 'infinity' inf from subscriptions s join users u on u.id = s.user_id where u.email = $1", [lifeEmail])).rows[0];
check("lifetime purchase stores level 5, $600 and no expiry", ls && ls.is_lifetime && ls.plan_level === 5 && Number(ls.price_minor) === 60000 && ls.inf);
check("lifetime member sees lifetime on billing and cannot cancel", (await life("/dashboard/billing")).body.includes("lifetime access") && (await life("/api/billing/cancel", { method: "POST", json: {} })).status === 400);
check("dashboard lists plan benefits", (await life("/dashboard")).body.includes("Your plan benefits"));

console.log("sports, leagues, favourites, admin subscriptions");
const comp = (await db.query("select id from competitions limit 1")).rows[0].id;
check("member saves a favourite league", (await member("/api/account/favourites", { method: "POST", json: { competitionId: comp, favourite: true } })).body.ok);
check("my-leagues fixtures filter works", (await member("/fixtures?mine=1")).body.includes("Schedule"));
check("league page shows a table", (await anon(`/leagues/${comp}`)).body.includes("Pts"));
check("results view shows finished scores", (await anon("/fixtures?mode=results")).body.includes("FT"));
const fixtureId = (await db.query("select fixture_id from predictions limit 1")).rows[0].fixture_id;
check("match page shows statistics and head to head", await (async () => { const x = await anon(`/matches/${fixtureId}`); return x.body.includes("Statistics this season") && x.body.includes("Head to head"); })());
r = await admin("/api/admin/subscriptions", { method: "POST", json: { email: memberEmail, planCode: "premium_1m", days: 7, note: "support credit" } });
check("admin grants complimentary access (audited)", r.body.ok && (await db.query("select count(*)::int n from audit_logs where action='admin.grant_access'")).rows[0].n >= 1, JSON.stringify(r.body));
const subId = (await db.query("select s.id from subscriptions s join users u on u.id=s.user_id where u.email=$1 and s.source='admin_grant' limit 1", [memberEmail])).rows[0].id;
check("admin revokes a subscription", (await admin(`/api/admin/subscriptions/${subId}`, { method: "PATCH", json: { action: "revoke" } })).body.ok);
check("member cannot use admin subscription API", (await member("/api/admin/subscriptions", { method: "POST", json: { email: memberEmail, planCode: "premium_1y", days: 366, note: "self grant" } })).status === 403);
check("sportsbook money tables stay locked", await db.query("insert into sportsbook.wallets(user_id) select id from users limit 1").then(() => false, (e) => /disabled/.test(e.message)));

console.log("homepage sections, links, testimonials, Discord");
const homePage = await anon("/");
check("hero has Explore Predictions to /predictions", /href="\/predictions"[^>]*>[\s\S]{0,400}Explore Predictions/.test(homePage.body));
check("hero has Join Our Community", homePage.body.includes("Join Our Community"));
check("hero uses the stadium artwork for desktop and mobile", homePage.body.includes("/images/hero/stadium-wide.webp") && homePage.body.includes("/images/hero/stadium-tall.webp") && (await anon("/images/hero/stadium-tall.webp")).status === 200);
check("platform section is present", homePage.body.includes("Your Smarter Sports Intelligence Platform"));
const invite = process.env.DISCORD_INVITE_URL;
check("Join Discord opens the configured invite in a new tab", invite ? homePage.body.includes(`href="${invite}" target="_blank" rel="noopener noreferrer"`) : homePage.body.includes('href="/community"'));
const textOf = (html) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const homeText = textOf(homePage.body);
check("homepage shows the four client statistics, each labelled Unverified", ["2,000+ Happy Members Unverified", "100% Win Rate Unverified", "12,500+ Winning Picks Unverified", "10 Sports Covered Unverified"].every((s) => homeText.includes(s)));
check("homepage explains what Unverified means", homeText.includes("have not yet been independently verified"));
check("member cannot edit homepage statistics", (await member("/api/admin/homepage-stats/members", { method: "PATCH", json: { value: "9", label: "x", source: "manual", verification: "unverified", visible: true } })).status === 403);
check("admin cannot mark a figure verified without evidence", (await admin("/api/admin/homepage-stats/win_rate", { method: "PATCH", json: { value: "100%", label: "Win Rate", source: "manual", verification: "verified", visible: true } })).status === 400);
check("admin switches members to the live figure", (await admin("/api/admin/homepage-stats/members", { method: "PATCH", json: { value: "2,000+", label: "Members", source: "live", verification: "unverified", visible: true } })).body.ok);
const memberCount = (await db.query("select count(*)::int n from users where role='member' and status='active'")).rows[0].n;
{ const t = textOf((await anon("/")).body);
  check("live member statistic matches the database and is labelled as live", t.includes(`${new Intl.NumberFormat("en-US").format(memberCount)} Members Live record`)); }
check("admin records a verified figure with its evidence", (await admin("/api/admin/homepage-stats/sports", { method: "PATCH", json: { value: "4", label: "Sports Covered", source: "manual", verification: "verified", verificationNote: "Counted from the live coverage list on 6 Nov 2026 by the admin team.", visible: true } })).body.ok);
check("verified figure shows as Verified", textOf((await anon("/")).body).includes("4 Sports Covered Verified"));
check("homepage statistic edits are audited", (await db.query("select count(*)::int n from audit_logs where action = 'admin.update_homepage_stat'")).rows[0].n >= 2);
check("admin homepage statistics page loads", (await admin("/admin/homepage")).status === 200);
// restore the client placeholders for later runs
await db.query("update homepage_stats set value_text = v, label = l, source = 'manual', verification = 'unverified', verification_note = null, verified_by = null, verified_at = null, visible = true from (values ('members','2,000+','Happy Members'),('sports','10','Sports Covered')) x(k, v, l) where key = k");
check("sports coverage links to all four sports", ["/sports/american-football", "/sports/soccer", "/sports/basketball", "/sports/baseball"].every((h) => homePage.body.includes(`href="${h}"`)));
const links = [...new Set([...homePage.body.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&")))].filter((h) => !h.startsWith("/_next") && !h.startsWith("/api/"));
const broken = [];
for (const h of links) { const x = await anon(h); if (x.status >= 400) broken.push(`${h} ${x.status}`); }
check(`every homepage link resolves (${links.length} links)`, broken.length === 0, broken.join(", "));
for (const s of ["american-football", "soccer", "basketball", "baseball"]) {
  const x = await anon(`/sports/${s}`); check(`sport page /sports/${s} renders with scores`, x.status === 200 && x.body.includes("Latest scores"));
}
check("soccer page shows predictions; basketball says predictions are not live", (await anon("/sports/soccer")).body.includes("Predictions and analysis") && (await anon("/sports/basketball")).body.includes("Predictions for this sport are not live yet"));
check("American football standings use W/L/Pct", await (async () => { const id = (await db.query("select id from competitions where sport='american_football' limit 1")).rows[0].id; const x = await anon(`/leagues/${id}`); return x.body.includes(">Pct<") && x.body.includes("Standings"); })());
check("community page renders", (await anon("/community")).status === 200);
check("no reviews are shown before approval", homePage.body.includes("Reviews from verified members will appear here"));
check("anonymous visitors cannot post reviews", (await anon("/api/testimonials", { method: "POST", json: { displayName: "X", rating: 5, body: "A long enough review body.", consent: true } })).status === 401);
check("review without consent is rejected", (await member("/api/testimonials", { method: "POST", json: { displayName: "Mia", rating: 5, body: "Clear, honest analysis every week.", consent: false } })).status === 422);
r = await member("/api/testimonials", { method: "POST", json: { displayName: "Mia", location: "Denver, CO", rating: 5, body: "Clear, honest analysis every week.", consent: true } });
check("member submits a review with consent", r.body.ok, JSON.stringify(r.body));
check("pending review is not public", !(await anon("/")).body.includes("Clear, honest analysis every week."));
const tid = (await db.query("select t.id from testimonials t join users u on u.id=t.user_id where u.email=$1 order by t.created_at desc limit 1", [memberEmail])).rows[0].id;
check("member cannot approve their own review", (await member(`/api/admin/testimonials/${tid}`, { method: "PATCH", json: { action: "approve" } })).status === 403);
check("admin approves the review", (await admin(`/api/admin/testimonials/${tid}`, { method: "PATCH", json: { action: "approve" } })).body.ok);
const withReview = (await anon("/")).body;
check("approved review shows with name, rating and verified badge", withReview.includes("Clear, honest analysis every week.") && withReview.includes("Mia") && withReview.includes("5 out of 5 stars") && withReview.includes("Verified subscriber"));
check("member withdraws the review and it disappears", (await member(`/api/testimonials/${tid}`, { method: "DELETE" })).body.ok && !(await anon("/")).body.includes("Clear, honest analysis every week."));

console.log("customer support contact");
const contactPage = await anon("/contact");
check("contact page shows support email and phone links", contactPage.body.includes('href="mailto:betvanta098@gmail.com"') && contactPage.body.includes('href="tel:+13143436703"') && contactPage.body.includes("(314) 343-6703"));
check("footer shows support contact on every page", (await anon("/pricing")).body.includes("betvanta098@gmail.com") && (await anon("/sports")).body.includes("(314) 343-6703"));
check("structured data lists the support contact", homePage.body.includes('"contactType":"customer support"'));
const before = (await db.query("select count(*)::int n from email_outbox where to_email = 'betvanta098@gmail.com'")).rows[0].n;
check("contact form message is accepted", (await anon("/api/contact", { method: "POST", json: { name: "Jordan", email: "jordan@example.com", message: "How do I change my plan?" } })).body.ok);
check("contact form is forwarded to the support inbox", (await db.query("select count(*)::int n from email_outbox where to_email = 'betvanta098@gmail.com' and template = 'support_contact'")).rows[0].n === before + 1);

console.log("account and cron");
check("settings save", (await member("/api/account", { method: "PATCH", json: { displayName: "Member Two", notifyPredictions: false, notifyBilling: true } })).body.ok);
check("password change requires current password", (await member("/api/account/password", { method: "POST", json: { currentPassword: "nope", newPassword: "another long passphrase" } })).status === 400);
check("cron rejects missing secret", (await anon("/api/cron/daily")).status === 401);
check("cron runs with secret", (await anon("/api/cron/daily", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).body.ok);
check("logout clears session", (await member("/api/auth/logout", { method: "POST", json: {} })).body.ok && (await member("/dashboard")).status === 307);

console.log("headers and pages");
const h = (await anon("/")).headers;
check("security headers present", h.get("content-security-policy")?.includes("frame-ancestors 'none'") && h.get("x-frame-options") === "DENY" && h.get("x-content-type-options") === "nosniff" && !h.get("x-powered-by"));
for (const p of ["/community", "/sports/soccer", "/sports", "/fixtures", "/fixtures?mode=live", "/", "/pricing", "/performance", "/about", "/faq", "/contact", "/legal/terms", "/legal/privacy", "/responsible-gambling", "/login", "/register", "/forgot-password"]) {
  const x = await anon(p); check(`page ${p} renders with BETVANTA title`, x.status === 200 && /<title>[^<]*BETVANTA/.test(x.body));
}
for (const p of ["/admin/testimonials", "/admin/subscriptions", "/admin", "/admin/predictions", "/admin/users", "/admin/payments", "/admin/plans", "/admin/audit", "/admin/data", "/admin/emails"]) check(`admin page ${p}`, (await admin(p)).status === 200);
check("rate limit kicks in on repeated failed logins", await (async () => { let last; for (let i = 0; i < 10; i++) last = await anon("/api/auth/login", { method: "POST", json: { email: "ratelimit@example.com", password: "wrong" } }); return last.status === 429; })());
await db.end();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
