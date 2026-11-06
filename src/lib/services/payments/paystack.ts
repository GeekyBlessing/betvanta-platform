import { env } from "../../env";
import { hmacSha512Hex, safeEqualHex } from "../../crypto";
import { unavailable } from "../../errors";
import type { PaymentProvider } from "./types";

type PsResponse<T> = { status: boolean; message: string; data: T };
async function call<T>(path: string, init: RequestInit = {}): Promise<PsResponse<T>> {
  const key = env().PAYSTACK_SECRET_KEY;
  if (!key) throw unavailable("Paystack is not configured.");
  const res = await fetch(env().PAYSTACK_BASE_URL + path, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, cache: "no-store" });
  const json = (await res.json().catch(() => null)) as PsResponse<T> | null;
  if (!json) throw unavailable(`Paystack error (HTTP ${res.status}).`);
  return json;
}

export const paystack: PaymentProvider = {
  id: "paystack", label: "Card or bank (Paystack)", method: "card",
  enabled: () => Boolean(env().PAYSTACK_SECRET_KEY),
  async createCheckout(i) {
    const r = await call<{ authorization_url: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({ email: i.email, amount: i.amountMinor, currency: i.currency, reference: i.reference, callback_url: `${env().APP_URL}/billing/callback?reference=${i.reference}`, metadata: { user_id: i.userId, plan_code: i.planCode } }),
    });
    if (!r.status) throw unavailable(r.message || "Could not start Paystack checkout.");
    return { redirectUrl: r.data.authorization_url };
  },
  async verify(p) {
    const r = await call<{ status: string; reference: string; amount: number; currency: string; id?: number }>(`/transaction/verify/${encodeURIComponent(p.reference)}`);
    if (!r.status) return null;
    const s = r.data.status;
    return { state: s === "success" ? "success" : ["failed", "abandoned", "reversed"].includes(s) ? "failed" : "pending", amountMinor: Number(r.data.amount), currency: r.data.currency, reference: r.data.reference, providerPaymentId: r.data.id ? String(r.data.id) : undefined, raw: r.data };
  },
};

/** Paystack signs the raw body with HMAC-SHA512 using the secret key. */
export function validWebhookSignature(rawBody: string, signature: string | null) {
  const key = env().PAYSTACK_SECRET_KEY;
  if (!key || !signature || !/^[a-f0-9]+$/i.test(signature)) return false;
  return safeEqualHex(hmacSha512Hex(key, rawBody), signature.toLowerCase());
}
