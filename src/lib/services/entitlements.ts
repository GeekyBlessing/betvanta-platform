import { one, type Db } from "../db";
import { featureLevel, tierForLevel } from "./plans";
export type Tier = "free" | "premium" | "vip";
export const TIER_RANK: Record<Tier, number> = { free: 0, premium: 1, vip: 2 };

/**
 * The member's plan level (0 = free, 1..5 = Monthly .. Lifetime), computed server-side from verified,
 * unexpired subscriptions only. Lifetime subscriptions end at 'infinity'. Staff get full access.
 */
export async function levelFor(user: { id: string; role: string } | null, db?: Db): Promise<number> {
  if (!user) return 0;
  if (user.role === "admin" || user.role === "analyst") return 5;
  const row = await one<{ level: number | null }>(
    `select max(plan_level) as level from subscriptions where user_id = $1 and status in ('active','cancelled') and current_period_end > now()`, [user.id], db);
  return row?.level ?? 0;
}
export async function tierFor(user: { id: string; role: string } | null, db?: Db): Promise<Tier> {
  return tierForLevel(await levelFor(user, db));
}
export const canAccess = (userTier: Tier, contentTier: Tier) => TIER_RANK[userTier] >= TIER_RANK[contentTier];
export const hasFeature = (level: number, key: string) => level >= featureLevel(key);
