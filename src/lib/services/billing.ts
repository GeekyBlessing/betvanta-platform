import { one, q, tx } from "../db";
import { randomToken } from "../crypto";
import { badRequest, forbidden, notFound } from "../errors";
import { env } from "../env";
import { audit } from "../audit";
import { sendEmail, templates } from "../email";
import { initializeTransaction, verifyTransaction } from "./paystack";

export type Plan = { id: string; code: string; name: string; tier: "premium" | "vip"; interval: string; duration_days: number; amount_minor: string; currency: string; features: string[]; active: boolean };
export const formatMoney = (minor: number | string, currency: string) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(minor) / 100);

export async function startCheckout(user: { id: string; email: string; email_verified_at: string | null }, planCode: string) {
  if (!user.email_verified_at) throw forbidden("Verify your email address before subscribing.");
  const plan = await one<Plan>("select * from plans where code = $1 and active", [planCode]);
  if (!plan) throw notFound("That plan is not available.");
  const reference = `BV-${Date.now().toString(36).toUpperCase()}-${randomToken(6).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`;
  await q("insert into payments(user_id, plan_id, reference, amount_minor, currency) values ($1,$2,$3,$4,$5)", [user.id, plan.id, reference, plan.amount_minor, plan.currency]);
  const init = await initializeTransaction({
    email: user.email, amountMinor: Number(plan.amount_minor), currency: plan.currency, reference,
    callbackUrl: `${env().APP_URL}/billing/callback`, metadata: { user_id: user.id, plan_code: plan.code },
  });
  await audit(user.id, "billing.checkout_started", "payment", reference, { plan: plan.code });
  return { reference, authorizationUrl: init.authorization_url };
}

export type ActivationResult = { outcome: "activated" | "already_processed" | "failed" | "flagged" | "pending"; reference: string; until?: string };

/**
 * Verifies a payment with Paystack's API and activates access. Idempotent: callback and webhook can both call it.
 * Access is granted only when the provider confirms success AND amount, currency and reference match our record.
 */
export async function verifyAndActivate(reference: string, via: "callback" | "webhook" | "admin"): Promise<ActivationResult> {
  const pre = await one<{ status: string }>("select status from payments where reference = $1", [reference]);
  if (!pre) throw notFound("Unknown payment reference.");
  if (pre.status === "success") return { outcome: "already_processed", reference };
  const v = await verifyTransaction(reference);

  return tx(async (c) => {
    const p = await one<{ id: string; user_id: string; plan_id: string; amount_minor: string; currency: string; status: string }>(
      "select * from payments where reference = $1 for update", [reference], c);
    if (!p) throw notFound("Unknown payment reference.");
    if (p.status === "success") return { outcome: "already_processed" as const, reference };
    if (!v) return { outcome: "pending" as const, reference };
    if (v.status !== "success") {
      if (["failed", "abandoned", "reversed"].includes(v.status)) {
        await q("update payments set status = 'failed', provider_payload = $2 where id = $1", [p.id, JSON.stringify(v)], c);
        return { outcome: "failed" as const, reference };
      }
      return { outcome: "pending" as const, reference };
    }
    if (Number(v.amount) !== Number(p.amount_minor) || v.currency !== p.currency || v.reference !== reference) {
      await q("update payments set status = 'flagged', provider_payload = $2, note = 'amount/currency/reference mismatch' where id = $1", [p.id, JSON.stringify(v)], c);
      await audit(null, "billing.payment_flagged", "payment", reference, { expected: [p.amount_minor, p.currency], got: [v.amount, v.currency] }, null, c);
      return { outcome: "flagged" as const, reference };
    }
    const plan = await one<{ id: string; tier: "premium" | "vip"; duration_days: number; name: string; interval: string }>("select * from plans where id = $1", [p.plan_id], c);
    // Same-tier renewals extend from the current end; a different tier starts now.
    const cur = await one<{ end: string }>(
      `select max(current_period_end) as end from subscriptions where user_id = $1 and tier = $2 and status in ('active','cancelled') and current_period_end > now()`,
      [p.user_id, plan!.tier], c);
    const sub = await one<{ id: string; current_period_end: string }>(
      `insert into subscriptions(user_id, plan_id, tier, status, current_period_start, current_period_end)
       values ($1, $2, $3, 'active', greatest(now(), coalesce($4::timestamptz, now())), greatest(now(), coalesce($4::timestamptz, now())) + ($5 || ' days')::interval)
       returning id, current_period_end`, [p.user_id, plan!.id, plan!.tier, cur?.end ?? null, String(plan!.duration_days)], c);
    await q("update payments set status = 'success', verified_at = now(), verified_via = $2, provider_payload = $3, subscription_id = $4 where id = $1",
      [p.id, via, JSON.stringify(v), sub!.id], c);
    await audit(p.user_id, "billing.subscription_activated", "subscription", sub!.id, { reference, via, plan: plan!.name, interval: plan!.interval }, null, c);
    return { outcome: "activated" as const, reference, until: sub!.current_period_end, _email: { userId: p.user_id, plan: `${plan!.name} ${plan!.interval}`, amount: formatMoney(p.amount_minor, p.currency) } } as ActivationResult & { _email: { userId: string; plan: string; amount: string } };
  }).then(async (r) => {
    const e = (r as { _email?: { userId: string; plan: string; amount: string } })._email;
    if (r.outcome === "activated" && e) {
      const u = await one<{ email: string; display_name: string }>("select email, display_name from users where id = $1", [e.userId]);
      if (u) await sendEmail({ to: u.email, ...templates.receipt(u.display_name, e.plan, e.amount, reference, new Date(r.until!).toUTCString()) });
    }
    delete (r as { _email?: unknown })._email;
    return r;
  });
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
  return { expired: expired.length, reminded: due.length };
}
