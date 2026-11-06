import { createHmac } from "node:crypto";
import { env } from "../../env";
import { safeEqualHex } from "../../crypto";
import { unavailable } from "../../errors";
import type { PaymentProvider } from "./types";

async function stripe<T>(path: string, form?: Record<string, string>): Promise<T> {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw unavailable("Stripe is not configured.");
  const res = await fetch(env().STRIPE_API_BASE + path, {
    method: form ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const j = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok || !j) throw unavailable(`Stripe error: ${j?.error?.message ?? res.status}`);
  return j;
}
type Session = { id: string; url: string; payment_status: string; status: string; amount_total: number; currency: string; client_reference_id: string; payment_intent?: string };

export const stripeProvider: PaymentProvider = {
  id: "stripe", label: "Card (Stripe)", method: "card",
  enabled: () => Boolean(env().STRIPE_SECRET_KEY),
  async createCheckout(i) {
    const s = await stripe<Session>("/v1/checkout/sessions", {
      mode: "payment", customer_email: i.email, client_reference_id: i.reference,
      "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(i.amountMinor), "line_items[0][price_data][product_data][name]": `BETVANTA ${i.planLabel}`,
      "metadata[reference]": i.reference, "metadata[user_id]": i.userId,
      success_url: `${env().APP_URL}/billing/callback?reference=${i.reference}`, cancel_url: `${env().APP_URL}/pricing?cancelled=1`,
    });
    return { redirectUrl: s.url, providerSessionId: s.id };
  },
  async verify(p) {
    if (!p.provider_session_id) return null;
    const s = await stripe<Session>(`/v1/checkout/sessions/${encodeURIComponent(p.provider_session_id)}`);
    const state = s.payment_status === "paid" ? "success" : s.status === "expired" ? "failed" : "pending";
    return { state, amountMinor: Number(s.amount_total), currency: String(s.currency).toUpperCase(), reference: s.client_reference_id, providerPaymentId: s.payment_intent, raw: { id: s.id, payment_status: s.payment_status, status: s.status, amount_total: s.amount_total, currency: s.currency } };
  },
};

/** Stripe-Signature: t=<ts>,v1=<hex>. HMAC-SHA256 of "<ts>.<raw body>" with the endpoint secret; 5-minute tolerance. */
export function validStripeSignature(rawBody: string, header: string | null, now = Date.now()) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return header.split(",").filter((kv) => kv.startsWith("v1=")).some((kv) => safeEqualHex(expected, kv.slice(3)));
}
