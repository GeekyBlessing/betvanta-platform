import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers";
import { one, q, tx } from "@/lib/db";
import { grantAccess, cancelSubscription, runSubscriptionMaintenance } from "@/lib/services/billing";
import { levelFor, tierFor, hasFeature } from "@/lib/services/entitlements";
import { cardFeatures, FEATURES } from "@/lib/services/plans";

async function member() { return (await one(`insert into users(email, password_hash, display_name, age_confirmed_at, terms_accepted_at, email_verified_at) values ('p${Math.random()}@x.com','x','P',now(),now(),now()) returning id, role`))!; }
const planId = async (code: string) => (await one("select id from plans where code = $1", [code]))!.id as string;

describe("five-plan structure", () => {
  beforeEach(resetDb);
  it("offers exactly the five client-confirmed plans in USD", async () => {
    const plans = await q("select code, name, amount_minor, currency, duration_days, is_lifetime, level, best_value from plans where active order by level");
    expect(plans.map((p) => [p.name, Number(p.amount_minor), p.currency, p.duration_days, p.is_lifetime])).toEqual([
      ["Monthly Premium", 5000, "USD", 30, false], ["3 Month Premium", 10000, "USD", 90, false], ["6 Month Premium", 15000, "USD", 180, false],
      ["1 Year Premium", 30000, "USD", 365, false], ["Lifetime Premium", 60000, "USD", null, true]]);
    expect(plans.filter((p) => p.best_value).map((p) => p.name)).toEqual(["1 Year Premium"]);
  });
  it("lists the client's feature copy per card", () => {
    expect(cardFeatures(1)).toContain("Lotto selections");
    expect(cardFeatures(2)[0]).toBe("Everything in Monthly");
    expect(cardFeatures(3)).toEqual(["Everything in 3 Month", "VIP-exclusive picks", "One-on-one bankroll consultation"]);
    expect(cardFeatures(4)).toContain("Weekly private video analysis calls");
    expect(cardFeatures(5)).toEqual(["All premium features for life", "Lifetime VIP status"]);
    expect(FEATURES.length).toBe(22);
  });
  it("records price, duration, level and status on each subscription", async () => {
    const u = await member();
    await tx(async (c) => grantAccess(c, u.id, await planId("premium_3m"), "payment", null, null));
    const row = await one("select plan_level, price_minor, currency, duration_days, is_lifetime, status from subscriptions where user_id = $1", [u.id]);
    expect([row.plan_level, Number(row.price_minor), row.currency, row.duration_days, row.is_lifetime, row.status]).toEqual([2, 10000, "USD", 90, false, "active"]);
  });
  it("enforces features by level: VIP picks from 6 Month, yearly perks from 1 Year", async () => {
    const u = await member();
    expect(await levelFor(u)).toBe(0);
    await tx(async (c) => grantAccess(c, u.id, await planId("premium_3m"), "payment", null, null));
    expect([await levelFor(u), await tierFor(u)]).toEqual([2, "premium"]);
    expect(hasFeature(2, "advanced_ai")).toBe(true);
    expect(hasFeature(2, "vip_picks")).toBe(false);
    await tx(async (c) => grantAccess(c, u.id, await planId("premium_6m"), "payment", null, null));
    expect([await levelFor(u), await tierFor(u)]).toEqual([3, "vip"]);
    expect(hasFeature(3, "private_calls")).toBe(false);
    expect(hasFeature(4, "private_calls")).toBe(true);
  });
  it("renewing the same plan extends from the current end; expiry drops access", async () => {
    const u = await member();
    const id = await planId("premium_1m");
    await tx((c) => grantAccess(c, u.id, id, "payment", null, null));
    await tx((c) => grantAccess(c, u.id, id, "payment", null, null));
    const [{ days }] = await q("select extract(day from max(current_period_end) - now())::int days from subscriptions where user_id = $1", [u.id]);
    expect(days).toBeGreaterThanOrEqual(59);
    await q("update subscriptions set current_period_end = now() - interval '1 minute' where user_id = $1", [u.id]);
    expect(await levelFor(u)).toBe(0);
    expect((await runSubscriptionMaintenance()).expired).toBe(2);
  });
  it("lifetime never expires, is not reminded and cannot be cancelled", async () => {
    const u = await member();
    await tx(async (c) => grantAccess(c, u.id, await planId("premium_lifetime"), "payment", null, null));
    const s = await one("select is_lifetime, current_period_end = 'infinity' inf, duration_days from subscriptions where user_id = $1", [u.id]);
    expect([s.is_lifetime, s.inf, s.duration_days]).toEqual([true, true, null]);
    expect([await levelFor(u), await tierFor(u)]).toEqual([5, "vip"]);
    expect((await runSubscriptionMaintenance()).expired).toBe(0);
    await expect(cancelSubscription(u.id)).rejects.toThrow(/Lifetime access never renews/);
    expect(await levelFor(u)).toBe(5);
  });
  it("keeps subscription payments separate from the sportsbook", async () => {
    const fk = await q(`select conrelid::regclass::text t from pg_constraint where contype = 'f' and confrelid = 'public.payments'::regclass`);
    expect(fk.map((r) => r.t).filter((t: string) => t.startsWith("sportsbook."))).toEqual([]);
    expect((await q("select count(*)::int n from information_schema.columns where table_schema = 'sportsbook' and column_name in ('payment_id','subscription_id')"))[0].n).toBe(0);
  });
});
