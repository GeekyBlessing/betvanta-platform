import { one, q, tx } from "../db";
import { randomToken } from "../crypto";
import { badRequest, forbidden, notFound } from "../errors";
import { audit } from "../audit";
import { sendEmail, templates } from "../email";
import { PROVIDERS, type CryptoCurrency, type PaymentRecord, type ProviderId } from "./payments";
import type { Db } from "../db";
import { resyncDiscordRoles, syncDiscordRoleSafe } from "./discord";

export type Plan = { id: string; code: string; name: string; tier: "premium" | "vip"; interval: string; duration_days: number; amount_minor: string; currency: string; features: string[]; active: boolean };
export const formatMoney = (minor: number | string, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: Number(minor) % 100 ? 2 : 0 }).format(Number(minor) / 100);

export async function startCheckout(user: { id: string; email: string; email_verified_at: string | null }, planCode: string, providerId: ProviderId, payCurrency?: CryptoCurrency) {
  if (!user.email_verified_at) throw forbidden("Verify your email address before subscribing.");
  const provider = PROVIDERS[providerId];
  if (!provider || !provider.enabled()) throw badRequest("That payment method is not available.");
  if (provider.method === "crypto" && !payCurrency) throw badRequest("Choose BTC, ETH or USDT.");
  const plan = await one<Plan>("select * from plans where code = $1 and active", [planCode]);
  if (!plan) throw notFound("That plan is not available.");
  if (plan.currency !== "USD") throw badRequest("Plans must be priced in USD.");
  const reference = `BV-${Date.now().toString(36).toUpperCase()}-${randomToken(6).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`;
  await q("insert into payments(user_id, plan_id, reference, amount_minor, currency, provider, method, pay_currency) values ($1,$2,$3,$4,'USD',$5,$6,$7)",
    [user.id, plan.id, reference, plan.amount_minor, provider.id, provider.method, provider.method === "crypto" ? payCurrency : null]);
  const r = await provider.createCheckout({ reference, amountMinor: Number(plan.amount_minor), currency: "USD", email: user.email, planLabel: `${plan.name} ${plan.interval}`, payCurrency, userId: user.id, planCode: plan.code });
  if (r.providerSessionId) await q("update payments set provider_session_id = $2 where reference = $1", [reference, r.providerSessionId]);
  await audit(user.id, "billing.checkout_started", "payment", reference, { plan: plan.code, provider: provider.id, payCurrency });
  return { reference, authorizationUrl: r.redirectUrl };
}

export type ActivationResult = { outcome: "activated" | "already_processed" | "failed" | "flagged" | "pending"; reference: string; until?: string };

/**
 * Asks the payment provider's own API about a payment and activates access. Idempotent: redirects and webhooks can both call it.
 * Access is granted only when the provider confirms success AND amount, currency and reference match our record.
 */
export async function verifyAndActivate(reference: string, via: "callback" | "webhook" | "admin", hint?: { providerPaymentId?: string }): Promise<ActivationResult> {
  const pre = await one<PaymentRecord & { status: string }>("select * from payments where reference = $1", [reference]);
  if (!pre) throw notFound("Unknown payment reference.");
  if (pre.status === "success") return { outcome: "already_processed", reference };
  if (hint?.providerPaymentId && !pre.provider_payment_id) {
    await q("update payments set provider_payment_id = $2 where reference = $1 and provider_payment_id is null", [reference, hint.providerPaymentId]);
    pre.provider_payment_id = hint.providerPaymentId;
  }
  const v = await PROVIDERS[pre.provider].verify(pre);

  const r = await tx(async (c) => {
    const p = await one<{ id: string; user_id: string; plan_id: string; amount_minor: string; currency: string; status: string }>(
      "select * from payments where reference = $1 for update", [reference], c);
    if (!p) throw notFound("Unknown payment reference.");
    if (p.status === "success") return { outcome: "already_processed" as const, reference };
    if (!v || v.state === "pending") return { outcome: "pending" as const, reference };
    if (v.state === "failed") {
      await q("update payments set status = 'failed', provider_payload = $2 where id = $1", [p.id, JSON.stringify(v.raw)], c);
      return { outcome: "failed" as const, reference };
    }
    if (v.state === "partial" || v.amountMinor !== Number(p.amount_minor) || v.currency !== p.currency || v.reference !== reference) {
      await q("update payments set status = 'flagged', provider_payload = $2, note = $3 where id = $1",
        [p.id, JSON.stringify(v.raw), v.state === "partial" ? "partially paid" : "amount/currency/reference mismatch"], c);
      await audit(null, "billing.payment_flagged", "payment", reference, { expected: [p.amount_minor, p.currency], got: [v.amountMinor, v.currency], state: v.state }, null, c);
      return { outcome: "flagged" as const, reference };
    }
    const sub = await grantAccess(c, p.user_id, p.plan_id, "payment", null, null);
    await q("update payments set status = 'success', verified_at = now(), verified_via = $2, provider_payload = $3, subscription_id = $4, provider_payment_id = coalesce(provider_payment_id, $5) where id = $1",
      [p.id, via, JSON.stringify(v.raw), sub.id, v.providerPaymentId ?? null], c);
    await audit(p.user_id, "billing.subscription_activated", "subscription", sub.id, { reference, via, provider: pre.provider, plan: sub.planLabel }, null, c);
    return { outcome: "activated" as const, reference, until: sub.current_period_end, userId: p.user_id, planLabel: sub.planLabel, amount: formatMoney(p.amount_minor) };
  });
  if (r.outcome === "activated") {
    const x = r as typeof r & { userId: string; planLabel: string; amount: string };
    const u = await one<{ email: string; display_name: string }>("select email, display_name from users where id = $1", [x.userId]);
    if (u) await sendEmail({ to: u.email, ...templates.receipt(u.display_name, x.planLabel, x.amount, reference, new Date(x.until!).toUTCString()) });
    await syncDiscordRoleSafe(x.userId);
    return { outcome: "activated", reference, until: x.until };
  }
  return r;
}

/** Creates a subscription period. Same-tier renewals extend from the current end; a different tier starts now. */
export async function grantAccess(c: Db, userId: string, planId: string, source: "payment" | "admin_grant", grantedBy: string | null, note: string | null, days?: number) {
  const plan = await one<{ id: string; tier: "premium" | "vip"; duration_days: number; name: string; interval: string }>("select * from plans where id = $1", [planId], c);
  if (!plan) throw notFound("Plan not found.");
  const cur = await one<{ end: string }>(
    `select max(current_period_end) as end from subscriptions where user_id = $1 and tier = $2 and status in ('active','cancelled') and current_period_end > now()`, [userId, plan.tier], c);
  const sub = await one<{ id: string; current_period_end: string }>(
    `insert into subscriptions(user_id, plan_id, tier, status, current_period_start, current_period_end, source, granted_by, note)
     values ($1, $2, $3, 'active', greatest(now(), coalesce($4::timestamptz, now())), greatest(now(), coalesce($4::timestamptz, now())) + ($5 || ' days')::interval, $6, $7, $8)
     returning id, current_period_end`, [userId, plan.id, plan.tier, cur?.end ?? null, String(days ?? plan.duration_days), source, grantedBy, note], c);
  return { ...sub!, planLabel: `${plan.name} ${plan.interval}` };
}

export async function cancelSubscription(userId: string) {
  const subs = await q<{ id: string; current_period_end: string }>(
    `update subscriptions set cancel_at_period_end = true, status = 'cancelled', updated_at = now()
     where user_id = $1 and status = 'active' and current_period_end > now() returning id, current_period_end`, [userId]);
  if (!subs.length) throw badRequest("You have no active subscription to cancel.");
  await audit(userId, "billing.cancel", "subscription", subs[0].id);
  const u = await one<{ email: string; display_name: string }>("select email, display_name from users where id = $1", [userId]);
  const until = subs.map((s) => new Date(s.current_period_end)).sort((a, b) => +b - +a)[0];
  if (u) await sendEmail({ to: u.email, ...templates.cancelled(u.display_name, until.toUTCString()) });
  return { until: until.toISOString() };
}

/** Daily job: expire lapsed subscriptions and remind members 3 days before their access ends. */
export async function runSubscriptionMaintenance() {
  const expired = await q("update subscriptions set status = 'expired', updated_at = now() where status in ('active','cancelled') and current_period_end <= now() returning id");
  const due = await q<{ id: string; email: string; display_name: string; name: string; current_period_end: string }>(
    `select s.id, u.email, u.display_name, p.name, s.current_period_end from subscriptions s join users u on u.id = s.user_id join plans p on p.id = s.plan_id
     where s.status = 'active' and s.reminded_at is null and s.current_period_end between now() and now() + interval '3 days' and u.notify_billing`);
  for (const d of due) {
    await sendEmail({ to: d.email, ...templates.expiring(d.display_name, d.name, new Date(d.current_period_end).toUTCString()) });
    await q("update subscriptions set reminded_at = now() where id = $1", [d.id]);
  }
  const discord = await resyncDiscordRoles();
  return { expired: expired.length, reminded: due.length, discordSynced: discord.synced };
}
