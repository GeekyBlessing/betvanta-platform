import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import { resetDb } from "../helpers";
import { one, q } from "@/lib/db";
import { startCheckout, verifyAndActivate, cancelSubscription, runSubscriptionMaintenance } from "@/lib/services/billing";
import { validWebhookSignature } from "@/lib/services/paystack";
import { tierFor, canAccess } from "@/lib/services/entitlements";
import { hmacSha512Hex } from "@/lib/crypto";

// A stand-in for Paystack's API so we can test our verification logic deterministically.
const ps: Record<string, { status: string; amount: number; currency: string }> = {};
let server: http.Server;
beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.headers.authorization !== "Bearer sk_test_unit_secret") { res.statusCode = 401; return res.end(JSON.stringify({ status: false, message: "bad key" })); }
    if (req.url === "/transaction/initialize") {
      let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { const j = JSON.parse(b); res.end(JSON.stringify({ status: true, message: "ok", data: { authorization_url: `https://checkout.paystack.com/${j.reference}`, access_code: "x", reference: j.reference } })); });
      return;
    }
    const m = req.url!.match(/^\/transaction\/verify\/(.+)$/);
    if (m) { const ref = decodeURIComponent(m[1]); const t = ps[ref]; return res.end(JSON.stringify(t ? { status: true, message: "ok", data: { ...t, reference: ref, paid_at: new Date().toISOString() } } : { status: false, message: "not found" })); }
    res.statusCode = 404; res.end("{}");
  });
  await new Promise<void>((r) => server.listen(4599, "127.0.0.1", r));
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function user(verified = true) {
  return (await one(`insert into users(email, password_hash, display_name, age_confirmed_at, terms_accepted_at, email_verified_at)
     values ('m${Math.random()}@x.com','x','Member', now(), now(), ${verified ? "now()" : "null"}) returning id, email, email_verified_at, role`))!;
}

describe("subscriptions and payments", () => {
  beforeEach(resetDb);
  it("requires a verified email before checkout", async () => {
    const u = await user(false);
    await expect(startCheckout(u, "premium_monthly")).rejects.toThrow(/Verify your email/);
  });
  it("creates a pending payment and returns the Paystack checkout URL", async () => {
    const u = await user();
    const r = await startCheckout(u, "premium_monthly");
    expect(r.authorizationUrl).toContain("checkout.paystack.com");
    const p = await one("select * from payments where reference = $1", [r.reference]);
    expect(p.status).toBe("pending");
    expect(Number(p.amount_minor)).toBe(1000000);
    expect(await tierFor(u)).toBe("free");
  });
  it("does not grant access until Paystack confirms success", async () => {
    const u = await user();
    const { reference } = await startCheckout(u, "premium_monthly");
    ps[reference] = { status: "ongoing", amount: 1000000, currency: "NGN" };
    expect((await verifyAndActivate(reference, "callback")).outcome).toBe("pending");
    expect(await tierFor(u)).toBe("free");
    ps[reference] = { status: "failed", amount: 1000000, currency: "NGN" };
    expect((await verifyAndActivate(reference, "callback")).outcome).toBe("failed");
    expect(await tierFor(u)).toBe("free");
  });
  it("activates on verified success, once, even if callback and webhook both arrive", async () => {
    const u = await user();
    const { reference } = await startCheckout(u, "vip_monthly");
    ps[reference] = { status: "success", amount: 2500000, currency: "NGN" };
    const [a, b] = await Promise.all([verifyAndActivate(reference, "callback"), verifyAndActivate(reference, "webhook")]);
    expect([a.outcome, b.outcome].sort()).toEqual(["activated", "already_processed"]);
    expect((await q("select * from subscriptions where user_id = $1", [u.id])).length).toBe(1);
    expect(await tierFor(u)).toBe("vip");
    expect((await q("select * from email_outbox where template = 'receipt'")).length).toBe(1);
  });
  it("flags and refuses access when the paid amount does not match", async () => {
    const u = await user();
    const { reference } = await startCheckout(u, "premium_monthly");
    ps[reference] = { status: "success", amount: 100, currency: "NGN" };
    expect((await verifyAndActivate(reference, "webhook")).outcome).toBe("flagged");
    expect(await tierFor(u)).toBe("free");
    ps[reference] = { status: "success", amount: 1000000, currency: "USD" };
    await q("update payments set status = 'pending' where reference = $1", [reference]);
    expect((await verifyAndActivate(reference, "webhook")).outcome).toBe("flagged");
  });
  it("extends a same-tier renewal from the current end date", async () => {
    const u = await user();
    for (let i = 0; i < 2; i++) {
      const { reference } = await startCheckout(u, "premium_monthly");
      ps[reference] = { status: "success", amount: 1000000, currency: "NGN" };
      await verifyAndActivate(reference, "callback");
    }
    const [{ days }] = await q("select extract(day from max(current_period_end) - now())::int days from subscriptions where user_id = $1", [u.id]);
    expect(days).toBeGreaterThanOrEqual(59);
  });
  it("keeps access after cancellation until the period ends, then expires", async () => {
    const u = await user();
    const { reference } = await startCheckout(u, "premium_monthly");
    ps[reference] = { status: "success", amount: 1000000, currency: "NGN" };
    await verifyAndActivate(reference, "callback");
    await cancelSubscription(u.id);
    expect(await tierFor(u)).toBe("premium");
    await q("update subscriptions set current_period_end = now() - interval '1 minute' where user_id = $1", [u.id]);
    expect(await tierFor(u)).toBe("free");
    expect((await runSubscriptionMaintenance()).expired).toBe(1);
  });
  it("validates Paystack webhook signatures", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "x" } });
    expect(validWebhookSignature(body, hmacSha512Hex("sk_test_unit_secret", body))).toBe(true);
    expect(validWebhookSignature(body, hmacSha512Hex("wrong", body))).toBe(false);
    expect(validWebhookSignature(body + " ", hmacSha512Hex("sk_test_unit_secret", body))).toBe(false);
    expect(validWebhookSignature(body, null)).toBe(false);
  });
  it("orders tiers correctly", () => {
    expect(canAccess("vip", "premium")).toBe(true);
    expect(canAccess("premium", "vip")).toBe(false);
    expect(canAccess("free", "free")).toBe(true);
  });
});
