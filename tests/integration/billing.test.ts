import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type http from "node:http";
import { createHmac } from "node:crypto";
import { resetDb } from "../helpers";
import { startStub, state } from "../providerStub";
import { one, q } from "@/lib/db";
import { startCheckout, verifyAndActivate, cancelSubscription, runSubscriptionMaintenance, formatMoney } from "@/lib/services/billing";
import { validWebhookSignature } from "@/lib/services/payments/paystack";
import { validStripeSignature } from "@/lib/services/payments/stripe";
import { validNowpaymentsSignature, sortKeys } from "@/lib/services/payments/nowpayments";
import { tierFor, canAccess } from "@/lib/services/entitlements";
import { hmacSha512Hex } from "@/lib/crypto";

let server: http.Server;
beforeAll(async () => { server = await startStub(4598); });
afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function user(verified = true) {
  return (await one(`insert into users(email, password_hash, display_name, age_confirmed_at, terms_accepted_at, email_verified_at)
     values ('m${Math.random()}@x.com','x','Member', now(), now(), ${verified ? "now()" : "null"}) returning id, email, email_verified_at, role`))!;
}

describe("subscription checkout in USD", () => {
  beforeEach(resetDb);
  it("prices every plan in USD and formats as dollars", async () => {
    const plans = await q("select currency, amount_minor from plans");
    expect(plans.every((p) => p.currency === "USD")).toBe(true);
    expect(formatMoney(1900)).toBe("$19");
    expect(formatMoney(1950)).toBe("$19.50");
  });
  it("requires a verified email and a configured provider", async () => {
    await expect(startCheckout(await user(false), "premium_monthly", "stripe")).rejects.toThrow(/Verify your email/);
    await expect(startCheckout(await user(), "premium_monthly", "nowpayments")).rejects.toThrow(/Choose BTC, ETH or USDT/);
  });

  it("Stripe: grants access only after Stripe reports the session paid", async () => {
    const u = await user();
    const r = await startCheckout(u, "premium_monthly", "stripe");
    expect(r.authorizationUrl).toContain("checkout.stripe.com");
    const p = await one("select * from payments where reference = $1", [r.reference]);
    expect([p.provider, p.currency, Number(p.amount_minor)]).toEqual(["stripe", "USD", 1900]);
    expect((await verifyAndActivate(r.reference, "callback")).outcome).toBe("pending");
    expect(await tierFor(u)).toBe("free");
    state.stripe.get(p.provider_session_id)!.payment_status = "paid";
    const [a, b] = await Promise.all([verifyAndActivate(r.reference, "callback"), verifyAndActivate(r.reference, "webhook")]);
    expect([a.outcome, b.outcome].sort()).toEqual(["activated", "already_processed"]);
    expect(await tierFor(u)).toBe("premium");
    expect((await q("select * from subscriptions where user_id = $1", [u.id])).length).toBe(1);
  });
  it("Stripe: flags an amount mismatch", async () => {
    const u = await user();
    const r = await startCheckout(u, "vip_monthly", "stripe");
    const p = await one("select provider_session_id from payments where reference = $1", [r.reference]);
    Object.assign(state.stripe.get(p.provider_session_id)!, { payment_status: "paid", amount_total: 100 });
    expect((await verifyAndActivate(r.reference, "webhook")).outcome).toBe("flagged");
    expect(await tierFor(u)).toBe("free");
  });

  it("Paystack (USD): activates only on verified success", async () => {
    const u = await user();
    const r = await startCheckout(u, "vip_monthly", "paystack");
    state.paystack.set(r.reference, { status: "failed", amount: 4900, currency: "USD" });
    expect((await verifyAndActivate(r.reference, "callback")).outcome).toBe("failed");
    const r2 = await startCheckout(u, "vip_monthly", "paystack");
    state.paystack.set(r2.reference, { status: "success", amount: 4900, currency: "USD" });
    expect((await verifyAndActivate(r2.reference, "callback")).outcome).toBe("activated");
    expect(await tierFor(u)).toBe("vip");
  });
  it("Paystack: rejects a payment in the wrong currency", async () => {
    const u = await user();
    const r = await startCheckout(u, "premium_monthly", "paystack");
    state.paystack.set(r.reference, { status: "success", amount: 1900, currency: "NGN" });
    expect((await verifyAndActivate(r.reference, "webhook")).outcome).toBe("flagged");
  });

  it("Crypto (NOWPayments): records the coin, waits for confirmation, activates on 'finished'", async () => {
    const u = await user();
    const r = await startCheckout(u, "premium_monthly", "nowpayments", "USDT");
    const p = await one("select * from payments where reference = $1", [r.reference]);
    expect([p.method, p.pay_currency, p.currency]).toEqual(["crypto", "USDT", "USD"]);
    expect((await verifyAndActivate(r.reference, "callback")).outcome).toBe("pending"); // no payment id yet
    state.np.set("555", { payment_status: "confirming", price_amount: 19, price_currency: "usd", order_id: r.reference });
    expect((await verifyAndActivate(r.reference, "webhook", { providerPaymentId: "555" })).outcome).toBe("pending");
    expect(await tierFor(u)).toBe("free");
    state.np.get("555")!.payment_status = "finished";
    expect((await verifyAndActivate(r.reference, "webhook")).outcome).toBe("activated");
    expect(await tierFor(u)).toBe("premium");
  });
  it("Crypto: partial payments are flagged, not activated", async () => {
    const u = await user();
    const r = await startCheckout(u, "premium_monthly", "nowpayments", "BTC");
    state.np.set("777", { payment_status: "partially_paid", price_amount: 19, price_currency: "usd", order_id: r.reference });
    expect((await verifyAndActivate(r.reference, "webhook", { providerPaymentId: "777" })).outcome).toBe("flagged");
    expect(await tierFor(u)).toBe("free");
  });
  it("Crypto: an IPN pointing at another order's payment cannot unlock this order", async () => {
    const u = await user();
    const r = await startCheckout(u, "vip_annual", "nowpayments", "ETH");
    state.np.set("888", { payment_status: "finished", price_amount: 19, price_currency: "usd", order_id: "BV-SOMEONE-ELSE" });
    expect((await verifyAndActivate(r.reference, "webhook", { providerPaymentId: "888" })).outcome).toBe("flagged");
  });

  it("renewals extend; cancellation keeps access to period end; maintenance expires", async () => {
    const u = await user();
    for (let i = 0; i < 2; i++) {
      const r = await startCheckout(u, "premium_monthly", "paystack");
      state.paystack.set(r.reference, { status: "success", amount: 1900, currency: "USD" });
      await verifyAndActivate(r.reference, "callback");
    }
    const [{ days }] = await q("select extract(day from max(current_period_end) - now())::int days from subscriptions where user_id = $1", [u.id]);
    expect(days).toBeGreaterThanOrEqual(59);
    await cancelSubscription(u.id);
    expect(await tierFor(u)).toBe("premium");
    await q("update subscriptions set current_period_end = now() - interval '1 minute' where user_id = $1", [u.id]);
    expect(await tierFor(u)).toBe("free");
    expect((await runSubscriptionMaintenance()).expired).toBe(2);
  });

  it("validates webhook signatures for every provider", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "x" } });
    expect(validWebhookSignature(body, hmacSha512Hex("sk_test_unit_secret", body))).toBe(true);
    expect(validWebhookSignature(body, hmacSha512Hex("wrong", body))).toBe(false);
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", "whsec_unit").update(`${t}.${body}`).digest("hex");
    expect(validStripeSignature(body, `t=${t},v1=${sig}`)).toBe(true);
    expect(validStripeSignature(body + "x", `t=${t},v1=${sig}`)).toBe(false);
    expect(validStripeSignature(body, `t=${t - 600},v1=${createHmac("sha256", "whsec_unit").update(`${t - 600}.${body}`).digest("hex")}`)).toBe(false);
    const ipn = { payment_status: "finished", order_id: "BV-1", payment_id: 1, price_amount: 19 };
    const npSig = hmacSha512Hex("np_ipn_unit", JSON.stringify(sortKeys(ipn)));
    expect(validNowpaymentsSignature(ipn, npSig)).toBe(true);
    expect(validNowpaymentsSignature({ ...ipn, price_amount: 1 }, npSig)).toBe(false);
  });
  it("orders tiers correctly", () => {
    expect(canAccess("vip", "premium")).toBe(true);
    expect(canAccess("premium", "vip")).toBe(false);
  });
});
