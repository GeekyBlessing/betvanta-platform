import { env } from "../env";
import { hmacSha512Hex, safeEqualHex } from "../crypto";
import { unavailable } from "../errors";

type PsResponse<T> = { status: boolean; message: string; data: T };
async function call<T>(path: string, init: RequestInit = {}): Promise<PsResponse<T>> {
  const key = env().PAYSTACK_SECRET_KEY;
  if (!key) throw unavailable("Payments are not configured yet.");
  const res = await fetch(env().PAYSTACK_BASE_URL + path, {
    ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as PsResponse<T> | null;
  if (!json) throw unavailable(`Payment provider error (HTTP ${res.status}).`);
  return json;
}

export async function initializeTransaction(p: { email: string; amountMinor: number; currency: string; reference: string; callbackUrl: string; metadata: Record<string, string> }) {
  const r = await call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({ email: p.email, amount: p.amountMinor, currency: p.currency, reference: p.reference, callback_url: p.callbackUrl, metadata: p.metadata, channels: ["card", "bank", "ussd", "bank_transfer"] }),
  });
  if (!r.status) throw unavailable(r.message || "Could not start checkout.");
  return r.data;
}

export type VerifiedTx = { status: string; reference: string; amount: number; currency: string; paid_at: string | null; customer?: { email?: string }; id?: number };
export async function verifyTransaction(reference: string) {
  const r = await call<VerifiedTx>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return r.status ? r.data : null;
}

/** Paystack signs the raw request body with HMAC-SHA512 using the secret key. */
export function validWebhookSignature(rawBody: string, signature: string | null) {
  const key = env().PAYSTACK_SECRET_KEY;
  if (!key || !signature || !/^[a-f0-9]+$/i.test(signature)) return false;
  return safeEqualHex(hmacSha512Hex(key, rawBody), signature.toLowerCase());
}
