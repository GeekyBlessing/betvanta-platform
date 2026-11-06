import { cryptoApproved, env } from "../../env";
import { hmacSha512Hex, safeEqualHex } from "../../crypto";
import { badRequest, unavailable } from "../../errors";
import type { CryptoCurrency, PaymentProvider } from "./types";

// NOWPayments prices the invoice in USD and collects the chosen coin. USDT defaults to the TRC-20 network.
const COIN: Record<CryptoCurrency, string> = { BTC: "btc", ETH: "eth", USDT: "usdttrc20" };

async function np<T>(path: string, body?: unknown): Promise<T> {
  const key = env().NOWPAYMENTS_API_KEY;
  if (!key) throw unavailable("Crypto payments are not configured.");
  const res = await fetch(env().NOWPAYMENTS_API_BASE + path, { method: body ? "POST" : "GET", cache: "no-store", headers: { "x-api-key": key, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok || !j) throw unavailable(`Crypto processor error: ${j?.message ?? res.status}`);
  return j;
}
type Invoice = { id: string; invoice_url: string };
export type NpPayment = { payment_id: number | string; payment_status: string; price_amount: number | string; price_currency: string; order_id: string; pay_currency?: string; actually_paid?: number };

export const nowpayments: PaymentProvider = {
  id: "nowpayments", label: "Crypto (BTC, ETH, USDT)", method: "crypto",
  // Requires keys AND an explicit approval flag (legal + provider sign-off for the merchant jurisdiction).
  enabled: () => cryptoApproved() && Boolean(env().NOWPAYMENTS_API_KEY && env().NOWPAYMENTS_IPN_SECRET),
  async createCheckout(i) {
    if (!i.payCurrency || !COIN[i.payCurrency]) throw badRequest("Choose BTC, ETH or USDT.");
    const inv = await np<Invoice>("/v1/invoice", {
      price_amount: i.amountMinor / 100, price_currency: "usd", pay_currency: COIN[i.payCurrency], order_id: i.reference,
      order_description: `BETVANTA ${i.planLabel}`, ipn_callback_url: `${env().APP_URL}/api/webhooks/nowpayments`,
      success_url: `${env().APP_URL}/billing/callback?reference=${i.reference}`, cancel_url: `${env().APP_URL}/pricing?cancelled=1`,
    });
    return { redirectUrl: inv.invoice_url, providerSessionId: String(inv.id) };
  },
  async verify(p) {
    // We learn the payment id from the signed IPN; until then there is nothing to confirm.
    if (!p.provider_payment_id) return null;
    const r = await np<NpPayment>(`/v1/payment/${encodeURIComponent(p.provider_payment_id)}`);
    const s = r.payment_status;
    const state = s === "finished" ? "success" : s === "partially_paid" ? "partial" : ["failed", "refunded", "expired"].includes(s) ? "failed" : "pending";
    return { state, amountMinor: Math.round(Number(r.price_amount) * 100), currency: String(r.price_currency).toUpperCase(), reference: r.order_id, providerPaymentId: String(r.payment_id), raw: r };
  },
};

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  return v;
}
/** NOWPayments IPN: HMAC-SHA512 of the JSON body with keys sorted, using the IPN secret. */
export function validNowpaymentsSignature(body: unknown, signature: string | null) {
  const secret = env().NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature || !/^[a-f0-9]+$/i.test(signature)) return false;
  return safeEqualHex(hmacSha512Hex(secret, JSON.stringify(sortKeys(body))), signature.toLowerCase());
}
export { sortKeys };
