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
const btcTx = "b" + stamp.toString(16).padStart(63, "0"); // unique per run: one transaction can activate only one plan
const admin = client(), member = client(), anon = client();
console.log("auth");
{ const h = (await anon("/api/health")).body; check("health endpoint reports database up and schema current", h.db === "up" && h.schema === "current", JSON.stringify(h)); }
check("deep health refuses without the cron secret", (await anon("/api/health/deep")).status === 401);
{ const d = await anon("/api/health/deep", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  check("deep health: every real app query succeeds", d.status === 200 && d.body.ok, JSON.stringify(d.body.checks?.filter((c) => !c.ok)));
  check("deep health: app runs as the least-privilege role", d.body.checks?.find((c) => c.name === "connection")?.detail === `connected as ${process.env.E2E_EXPECT_DB_USER ?? "betvanta_app"}`, d.body.checks?.[0]?.detail); }
let r = await admin("/api/auth/register", { method: "POST", json: { displayName: "Admin", email: "admin@betvanta.test", password: "admin passphrase long", confirmAge: true, acceptTerms: true } });
if (r.status === 409) r = await admin("/api/auth/login", { method: "POST", json: { email: "admin@betvanta.test", password: "admin passphrase long" } });
check("admin can register or log in", r.body.ok, JSON.stringify(r.body));
{ const at = await tokenFor("admin@betvanta.test"); if (at) await admin("/api/auth/verify", { method: "POST", json: { token: at } });
  await admin("/api/auth/login", { method: "POST", json: { email: "admin@betvanta.test", password: "admin passphrase long" } });
  check("the ADMIN_EMAILS account becomes admin once its email is verified", (await db.query("select role from users where email = 'admin@betvanta.test'")).rows[0].role === "admin"); }
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
const home = await anon("/");
const lockedSel = (await db.query("select p.selection, ht.name from predictions p join fixtures f on f.id=p.fixture_id join teams ht on ht.id=f.home_team_id where p.access_tier='vip' and p.status='published' limit 1")).rows[0];
check("the public predictions page now opens the sportsbook", await (async () => { const x = await anon("/predictions"); return [307, 308].includes(x.status) && /\/$/.test(x.headers.get("location") ?? ""); })());
check("locked analysis text never reaches the browser", !home.body.includes("Model probability"));

console.log("payments (USD)");
const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
r = await member("/api/billing/checkout", { method: "POST", json: { planCode: "premium_1m", provider: "stripe" } });
check("unverified member cannot check out", r.status === 403);
const vt = await tokenFor(memberEmail);
check("verification email recorded", Boolean(vt));
check("email verification succeeds", (await member("/api/auth/verify", { method: "POST", json: { token: vt } })).body.ok);
check("old checkout links open the payment assistant for that plan", await (async () => { const x = await member("/checkout/premium_6m"); return [307, 308].includes(x.status) && /\/packages\?subscribe=premium_6m$/.test(x.headers.get("location") ?? ""); })());
check("the assistant offers card and crypto with the verified wallets", await (async () => { const x = await member("/packages?subscribe=premium_6m"); return x.status === 200 && x.body.includes("Stripe") && x.body.includes("bc1qu2pq8h060lpu3g5yg8zzc39lr85mal3vpek4dv"); })());
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
const pricing = await anon("/packages");
check("pricing shows the five USD plans", ["Monthly Premium", "3 Month Premium", "6 Month Premium", "1 Year Premium", "Lifetime Premium", "$50", "$100", "$150", "$300", "$600"].every((s) => pricing.body.includes(s)));
check("pricing highlights one best-value plan", (pricing.body.match(/Best value</g) ?? []).length === 1);
check("pricing has comparison table and payment options", pricing.body.includes("Compare packages") && pricing.body.includes("Weekly private video analysis calls") && pricing.body.includes("Payment options"));
check("every plan has a Subscribe Now button that opens the assistant", ["premium_1m", "premium_3m", "premium_6m", "premium_1y", "premium_lifetime"].every((c) => pricing.body.includes(`data-subscribe="${c}"`)) && (pricing.body.match(/data-subscribe="[^"]*"[^>]*>Subscribe Now</g) ?? []).length === 5);
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

console.log("payment assistant: manual crypto and Discord-arranged payments");
{
  const payer = client(), payerEmail = `payer${stamp}@example.com`;
  await payer("/api/auth/register", { method: "POST", json: { displayName: "Pat Payer", email: payerEmail, password: "payer passphrase long", confirmAge: true, acceptTerms: true } });
  const co = await payer("/packages?subscribe=premium_1m");
  check("the payment assistant lists every method", co.status === 200 && ["Bitcoin (BTC)", "Ethereum (ETH)", "Tether (USDT)", "PayPal", "Venmo", "Chime", "Apple Pay", "Other method"].every((x) => co.body.includes(x)));
  check("the assistant carries the BTC wallet and QR code", co.body.includes("bc1qu2pq8h060lpu3g5yg8zzc39lr85mal3vpek4dv") && (co.body.match(/crispEdges/g) ?? []).length >= 1);
  check("ETH and USDT addresses are not shown while their network is unconfirmed", !co.body.includes("0x283bed6B2dB8b70FB245a9734fc6479C60C59E9C") && !co.body.includes("0x7EE5E8D5149A55c6049f7b1042834cDAEB2f246d") && co.body.includes("network_unconfirmed"));
  check("the assistant never shows a PayPal, Venmo or Chime account", !/paypal\.me|venmo\.com\/|\$cashtag|@[a-z0-9_]+ on venmo/i.test(co.body));
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
  const form = (o, file) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); if (file) f.set("proof", new Blob([file.data], { type: file.type }), file.name); return f; };
  const base = { planCode: "premium_1m", fullName: "Pat Payer", email: payerEmail, discordUsername: "pat_payer" };
  check("anonymous visitors cannot submit payments", (await anon("/api/billing/manual", { method: "POST", raw: form({ ...base, method: "btc", reference: "x" }) })).status === 401);
  check("submission without a reference or proof is refused", (await payer("/api/billing/manual", { method: "POST", raw: form({ ...base, method: "btc" }) })).status === 400);
  check("a disguised file is refused", (await payer("/api/billing/manual", { method: "POST", raw: form({ ...base, method: "btc" }, { data: Buffer.from("<script>alert(1)</script>"), type: "image/png", name: "x.png" }) })).status === 400);
  check("USDT cannot be submitted while its network is unconfirmed", (await payer("/api/billing/manual", { method: "POST", raw: form({ ...base, method: "usdt", reference: "0x" + "a".repeat(64) }) })).status === 400);
  const sub = await payer("/api/billing/manual", { method: "POST", raw: form({ ...base, method: "btc", reference: btcTx }, { data: png, type: "image/png", name: "wallet screenshot.png" }) });
  check("member submits BTC payment proof and gets a reference", sub.status === 201 && /^BV-M-[0-9A-Z]{8}$/.test(sub.body.data?.reference) && sub.body.data.status === "pending_review", JSON.stringify(sub.body));
  const ref = sub.body.data?.reference;
  check("a pending submission grants no access", (await db.query("select count(*)::int n from subscriptions s join users u on u.id = s.user_id where u.email = $1", [payerEmail])).rows[0].n === 0);
  check("a second submission for the same plan is refused while one is pending", (await payer("/api/billing/manual", { method: "POST", raw: form({ ...base, method: "paypal", reference: "PP-1" }) })).status === 409);
  check("the assistant shows the pending status for that plan", (await payer("/packages?subscribe=premium_1m")).body.includes(ref));
  { const st = await payer("/api/billing/manual"); check("members can refresh their payment status", st.body.ok && st.body.data.statuses.some((x) => x.reference === ref && x.status === "pending")); }
  check("member sees the Pending status in billing", />Pending</.test((await payer("/dashboard/billing")).body));
  check("member and admin were emailed", (await db.query("select count(*)::int n from email_outbox where template in ('manual_received','manual_to_review') and body_text like $1", [`%${ref}%`])).rows[0].n === 2);
  const row = (await db.query("select m.id, f.id proof_id, f.mime from manual_payments m join manual_payment_proofs f on f.manual_payment_id = m.id where m.reference = $1", [ref])).rows[0];
  check("proof is stored with its real type", row?.mime === "image/png");
  check("members cannot open payment proofs", (await payer(`/api/admin/manual-payments/proofs/${row.proof_id}`)).status === 403);
  const pf = await admin(`/api/admin/manual-payments/proofs/${row.proof_id}`);
  check("admin opens the proof with safe headers", pf.status === 200 && pf.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(pf.headers.get("content-security-policy") ?? ""), `${pf.status} ${pf.headers.get("x-content-type-options")} ${pf.headers.get("content-security-policy")} ${String(pf.body).slice(0, 120)}`);
  const list = await admin("/admin/manual-payments");
  check("admin review queue lists the submission with an explorer link", list.status === 200 && list.body.includes(ref) && list.body.includes(`https://mempool.space/tx/${btcTx}`));
  check("members cannot approve payments", (await payer(`/api/admin/manual-payments/${row.id}`, { method: "POST", json: { action: "approve" } })).status === 403);
  check("rejecting needs a reason", (await admin(`/api/admin/manual-payments/${row.id}`, { method: "POST", json: { action: "reject" } })).status === 422);
  { const ck = await admin(`/api/admin/manual-payments/${row.id}`, { method: "POST", json: { action: "check" } });
    check("admin checks the BTC transaction on the blockchain", ck.body.ok && ck.body.data.chain.status === "verified" && /0.0011 BTC/.test(ck.body.data.chain.summary), JSON.stringify(ck.body)); }
  check("admin overview shows the payment assistant setup", /Payment assistant setup/.test((await admin("/admin")).body));
  check("a verified BTC payment still needs the admin to confirm its dollar value", /covers the plan price/.test(JSON.stringify((await admin(`/api/admin/manual-payments/${row.id}`, { method: "POST", json: { action: "approve", note: "received, 2 confirmations" } })).body)));
  const ap = await admin(`/api/admin/manual-payments/${row.id}`, { method: "POST", json: { action: "approve", note: "0.0011 BTC received, worth about $60 when it arrived", amountConfirmed: true } });
  check("admin approves after verification and access is granted", ap.body.ok && (await db.query("select s.plan_level, s.source from subscriptions s join users u on u.id = s.user_id where u.email = $1 and s.status = 'active'", [payerEmail])).rows[0]?.plan_level === 1, JSON.stringify(ap.body));
  check("a submission cannot be approved twice", (await admin(`/api/admin/manual-payments/${row.id}`, { method: "POST", json: { action: "approve" } })).status === 409);
  check("approval is audited and a confirmation email is sent", (await db.query("select count(*)::int n from audit_logs where action = 'admin.manual_payment_approved' and entity_id = $1", [ref])).rows[0].n === 1
    && (await db.query("select count(*)::int n from email_outbox where template = 'manual_confirmed' and body_text like $1", [`%${ref}%`])).rows[0].n === 1);
  const pp = await payer("/api/billing/manual", { method: "POST", raw: form({ ...base, planCode: "premium_3m", method: "other", methodOther: "Cash App", reference: "CA-12345" }) });
  check("member submits a Discord-arranged payment", pp.status === 201, JSON.stringify(pp.body));
  const ppId = (await db.query("select id from manual_payments where reference = $1", [pp.body.data?.reference])).rows[0]?.id;
  check("admin rejects it with a reason the member can see", (await admin(`/api/admin/manual-payments/${ppId}`, { method: "POST", json: { action: "reject", note: "No Cash App payment found with this ID." } })).body.ok
    && (await payer("/dashboard/billing")).body.includes("No Cash App payment found with this ID."));
  check("a rejected submission grants nothing", (await db.query("select count(*)::int n from subscriptions s join users u on u.id = s.user_id where u.email = $1 and s.plan_level = 2", [payerEmail])).rows[0].n === 0);
  check("admin manual payments page loads every tab", (await Promise.all(["pending_review", "approved", "rejected", "all"].map((t) => admin(`/admin/manual-payments?status=${t}`)))).every((x) => x.status === 200));
}

console.log("homepage dashboard, links, testimonials, Discord");
const homePage = await anon("/");
const contactLinks = (pg, inv, ig) => pg.status === 200 && pg.body.includes(`href="${inv}"`) && pg.body.includes(`href="${ig}"`);
const textOf = (html) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const homeText = textOf(homePage.body);
check("navigation is Home, Packages, Contact and More, with Join Now and Log in", /aria-label="Main"/.test(homePage.body) && ["/", "/packages", "/contact"].every((h) => homePage.body.includes(`href="${h}"`)) && />More</.test(homePage.body) && /href="\/register"[^>]*>Join Now</.test(homePage.body) && /href="\/login"[^>]*>Log in</.test(homePage.body));
{ const nav = homePage.body.match(/<nav aria-label="Main"[\s\S]*?<\/nav>/)?.[0] ?? "";
  check("main navigation has no Predictions, Fixtures, Sports or Performance links", nav.length > 0 && !/href="\/(predictions|fixtures|sports|performance|results)"/.test(nav) && !/Predictions|Fixtures|Performance/.test(nav), nav.slice(0, 300)); }
check("phones get the bottom bar: Home, A-Z Sports, Virtuals, Bet Slip, Menu", /aria-label="Quick navigation"/.test(homePage.body) && ["A-Z Sports", "Virtuals", "Bet Slip", "Menu"].every((x) => homeText.includes(x)));
check("hero: headline, View Packages and Join Discord", homeText.includes("Smarter Insights. Better Decisions.") && /href="\/packages"[^>]*>View Packages</.test(homePage.body) && homeText.includes("Join Discord"));
check("hero offers Register and Log in to visitors", /href="\/register"[^>]*>Register</.test(homePage.body) && /href="\/login"[^>]*>log in</.test(homePage.body));
for (const [name, text] of [["featured", "Featured"], ["live", "Live"], ["upcoming matches", "Upcoming matches"], ["packages", "Premium packages"], ["popular competitions", "Popular competitions"]])
  check(`homepage section: ${name}`, homeText.includes(text));
check("no member counts, win rates or winning-pick totals on the homepage", !/Happy Members|Win Rate|Winning Picks|Sports Covered/.test(homeText));
check("prices are labelled as BETVANTA model prices and betting is disabled", homeText.includes("Prices are BETVANTA model prices, not bookmaker odds. Betting is not available.") && homeText.includes("We do not accept bets, deposits or withdrawals"));
{ const open = (body, mk) => new RegExp(`\\\\?"key\\\\?":\\\\?"${mk}\\\\?",\\\\?"state\\\\?":\\\\?"open`).test(body);
  const locked = (body, mk) => new RegExp(`\\\\?"key\\\\?":\\\\?"${mk}\\\\?",\\\\?"state\\\\?":\\\\?"locked`).test(body);
  check("visitors see prices only for free picks; premium and VIP markets are locked with no prices sent", open(homePage.body, "1X2") && locked(homePage.body, "BTTS") && locked(homePage.body, "OU25") && !open(homePage.body, "BTTS") && !open(homePage.body, "OU25") && /class="odds-btn/.test(homePage.body));
  const lh = (await life("/")).body;
  check("a member whose package includes VIP picks sees every market priced", open(lh, "1X2") && open(lh, "BTTS") && open(lh, "OU25") && !locked(lh, "BTTS") && !locked(lh, "OU25")); }
check("the board labels demo fixtures", homePage.body.includes("DEMO") && homeText.includes("Fixtures are sample data"));
{ const pk = await anon("/packages"); check("Packages page shows the plans with Subscribe Now", pk.status === 200 && pk.body.includes("Choose your BETVANTA Premium package") && (pk.body.match(/data-subscribe="/g) ?? []).length >= 5); }
{ const old = await anon("/pricing?subscribe=premium_6m&method=usdt"); check("old /pricing links redirect to /packages with the plan kept", [301, 308].includes(old.status) && /\/packages\?subscribe=premium_6m&method=usdt$/.test(old.headers.get("location") ?? ""), `${old.status} ${old.headers.get("location")}`); }
{ const slugs = ["american-football", "soccer", "basketball", "baseball", "ice-hockey", "tennis", "boxing", "mma"];
  check("the sports bar links every sport and Virtuals", ["american-football", "soccer", "basketball", "baseball", "ice-hockey", "tennis", "boxing", "mma"].every((x) => homePage.body.includes(`href="/?sport=${x}"`)) && homePage.body.includes('href="/virtuals"'));
  { const v = await anon("/virtuals"); check("Virtual Sports page shows the games and says no provider is connected", v.status === 200 && ["Instant Football", "Instant Basketball", "Penalty Shootout", "Virtual Racing"].every((x) => v.body.includes(x)) && v.body.includes("No virtual sports provider is connected yet")); }
  const pages = await Promise.all(slugs.map((x) => anon(`/sports/${x}`)));
  check("every sport card opens a working page", pages.every((p) => p.status === 200));
  const art = await Promise.all(slugs.map((x) => fetch(`${BASE}/images/sports/${x}.svg`)));
  check("every sport illustration is served", art.every((a) => a.status === 200 && (a.headers.get("content-type") ?? "").includes("svg")));
  check("sports without a data feed say coverage is coming, not empty numbers", pages[7].body.includes("MMA coverage is on the way")); }
{ const sr = await anon("/search?q=Summit"); check("search finds teams and their matches", sr.status === 200 && sr.body.includes("Summit") && sr.body.includes("/matches/")); }
{ const res = await anon("/results"); check("results page shows final scores and graded picks", res.status === 200 && res.body.includes("Final scores") && res.body.includes("Graded picks")); }
check("homepage plans open the payment assistant for all five plans", ["premium_1m", "premium_3m", "premium_6m", "premium_1y", "premium_lifetime"].every((c) => homePage.body.includes(`data-subscribe="${c}"`)));
check("footer has contact, Discord and legal links", ["mailto:", "/contact", "/legal/terms", "/legal/privacy", "/responsible-gambling"].every((x) => homePage.body.includes(x)) && /Discord/.test(homePage.body));
const invite = process.env.DISCORD_INVITE_URL || "https://discord.com/invite/STDJ29shZS";
check("Join Discord opens the official BETVANTA server in a new tab", homePage.body.includes(`href="${invite}" target="_blank" rel="noopener noreferrer"`));
check("footer links to the official Instagram", homePage.body.includes('href="https://www.instagram.com/bet.vanta/" target="_blank" rel="noopener noreferrer"') && homePage.body.includes("@bet.vanta"));
{ const xu = "https://x.com/betvantaanalyst";
  check("X @betvantaanalyst is linked in the footer and homepage, opening in a new tab", homePage.body.includes(`href="${xu}" target="_blank" rel="noopener noreferrer"`) && homePage.body.includes("@betvantaanalyst"));
  const ct = await anon("/contact"), cm = await anon("/community");
  check("Contact and Community pages link X", ct.body.includes(`href="${xu}"`) && cm.body.includes(`href="${xu}"`) && cm.body.includes("Follow Us on X"));
  check("structured data lists the X profile", homePage.body.includes('"sameAs":') && homePage.body.includes(xu)); }
{ const ig = "https://www.instagram.com/bet.vanta/";
  const cmBody = (await anon("/community")).body; const cmText = textOf(cmBody);
  const sec = cmBody.match(/<section class="community"[\s\S]*?<\/section>/)?.[0] ?? "";
  check("community section: heading and supporting text", cmText.includes("Get daily sports updates, expert picks, match insights and exclusive content. Join our Discord community and follow us on Instagram to stay connected."));
  check("community section: JOIN OUR DISCORD opens the official invite in a new tab", sec.includes(`href="${invite}" target="_blank" rel="noopener noreferrer"`) && sec.includes("Join Our Discord"));
  check("community section: FOLLOW US ON INSTAGRAM opens the official profile in a new tab", sec.includes(`href="${ig}" target="_blank" rel="noopener noreferrer"`) && sec.includes("Follow Us on Instagram"));
  check("free community and premium content are clearly separated", cmText.includes("Free for everyone") && cmText.includes("Paid packages") && cmText.includes("checked on our servers"));
  const pk = await anon("/packages");
  check("Packages page explains free community vs premium and links Discord and Instagram", pk.body.includes("Free community and premium access") && pk.body.includes(`href="${invite}"`) && pk.body.includes(`href="${ig}"`));
  check("Contact page and footer include Instagram and Discord", contactLinks(await anon("/contact"), invite, ig) && homePage.body.includes(`Follow Us on Instagram`) && /footer[\s\S]*instagram\.com\/bet\.vanta/.test(homePage.body));
  const nav = homePage.body.match(/<nav aria-label="Main"[\s\S]*?<\/nav>/)?.[0] ?? "";
  check("navigation is still exactly Home, Packages, Contact, More", [...nav.matchAll(/class="nav-link[^"]*"[^>]*>([^<]+)</g)].map((m) => m[1].trim()).join("|") === "Home|Packages|Contact|More", nav.slice(0, 400)); }
{ const cm = await anon("/community"); check("community page has the Discord invite and Instagram", cm.body.includes(`href="${invite}"`) && cm.body.includes("instagram.com/bet.vanta")); }
check("member cannot edit homepage statistics", (await member("/api/admin/homepage-stats/members", { method: "PATCH", json: { value: "9", label: "x", source: "manual", verification: "unverified", visible: true } })).status === 403);
check("admin cannot mark a figure verified without evidence", (await admin("/api/admin/homepage-stats/win_rate", { method: "PATCH", json: { value: "75%", label: "Win Rate", source: "manual", verification: "verified", visible: true } })).status === 400);
check("admin switches members to the live figure", (await admin("/api/admin/homepage-stats/members", { method: "PATCH", json: { value: "2,000+", label: "Members", source: "live", verification: "unverified", visible: true } })).body.ok);
check("admin records a verified figure with its evidence", (await admin("/api/admin/homepage-stats/sports", { method: "PATCH", json: { value: "4", label: "Sports Covered", source: "manual", verification: "verified", verificationNote: "Counted from the live coverage list on 6 Nov 2026 by the admin team.", visible: true } })).body.ok);
check("admin homepage statistics page says the figures are not shown publicly", /Not shown on the public site/.test((await admin("/admin/homepage")).body));
check("homepage statistic edits are audited", (await db.query("select count(*)::int n from audit_logs where action = 'admin.update_homepage_stat'")).rows[0].n >= 2);
check("admin homepage statistics page loads", (await admin("/admin/homepage")).status === 200);
// restore the client placeholders for later runs
await db.query("update homepage_stats set value_text = v, label = l, source = 'manual', verification = 'unverified', verification_note = null, verified_by = null, verified_at = null, visible = true from (values ('members','2,000','Happy Members'),('sports','10','Sports Covered')) x(k, v, l) where key = k");
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
check("no reviews are shown before approval", !(await anon("/packages")).body.includes("What members say"));
check("anonymous visitors cannot post reviews", (await anon("/api/testimonials", { method: "POST", json: { displayName: "X", rating: 5, body: "A long enough review body.", consent: true } })).status === 401);
check("review without consent is rejected", (await member("/api/testimonials", { method: "POST", json: { displayName: "Mia", rating: 5, body: "Clear, honest analysis every week.", consent: false } })).status === 422);
r = await member("/api/testimonials", { method: "POST", json: { displayName: "Mia", location: "Denver, CO", rating: 5, body: "Clear, honest analysis every week.", consent: true } });
check("member submits a review with consent", r.body.ok, JSON.stringify(r.body));
check("pending review is not public", !(await anon("/packages")).body.includes("Clear, honest analysis every week."));
const tid = (await db.query("select t.id from testimonials t join users u on u.id=t.user_id where u.email=$1 order by t.created_at desc limit 1", [memberEmail])).rows[0].id;
check("member cannot approve their own review", (await member(`/api/admin/testimonials/${tid}`, { method: "PATCH", json: { action: "approve" } })).status === 403);
check("admin approves the review", (await admin(`/api/admin/testimonials/${tid}`, { method: "PATCH", json: { action: "approve" } })).body.ok);
const withReview = (await anon("/packages")).body;
check("approved review shows with name, rating and verified badge", withReview.includes("Clear, honest analysis every week.") && withReview.includes("Mia") && withReview.includes("5 out of 5") && withReview.includes("Verified subscriber"));
check("member withdraws the review and it disappears", (await member(`/api/testimonials/${tid}`, { method: "DELETE" })).body.ok && !(await anon("/packages")).body.includes("Clear, honest analysis every week."));

console.log("customer support contact");
const contactPage = await anon("/contact");
check("contact page shows support email and phone links", contactPage.body.includes('href="mailto:betvanta098@gmail.com"') && contactPage.body.includes('href="tel:+13143436703"') && contactPage.body.includes("(314) 343-6703"));
check("footer shows support contact on every page", (await anon("/packages")).body.includes("betvanta098@gmail.com") && (await anon("/sports")).body.includes("(314) 343-6703"));
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
for (const p of ["/community", "/sports/soccer", "/sports", "/fixtures", "/fixtures?mode=live", "/", "/packages", "/performance", "/about", "/faq", "/contact", "/legal/terms", "/legal/privacy", "/responsible-gambling", "/login", "/register", "/forgot-password"]) {
  const x = await anon(p); check(`page ${p} renders with BETVANTA title`, x.status === 200 && /<title>[^<]*BETVANTA/.test(x.body));
}
for (const p of ["/admin/testimonials", "/admin/subscriptions", "/admin", "/admin/predictions", "/admin/users", "/admin/payments", "/admin/plans", "/admin/audit", "/admin/data", "/admin/emails"]) check(`admin page ${p}`, (await admin(p)).status === 200);
check("rate limit kicks in on repeated failed logins", await (async () => { let last; for (let i = 0; i < 10; i++) last = await anon("/api/auth/login", { method: "POST", json: { email: "ratelimit@example.com", password: "wrong" } }); return last.status === 429; })());
await db.end();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
