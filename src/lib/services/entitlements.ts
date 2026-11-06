import { one, type Db } from "../db";
export type Tier = "free" | "premium" | "vip";
export const TIER_RANK: Record<Tier, number> = { free: 0, premium: 1, vip: 2 };

/** The single source of truth for content access. Computed server-side from verified subscriptions only. */
export async function tierFor(user: { id: string; role: string } | null, db?: Db): Promise<Tier> {
  if (!user) return "free";
  if (user.role === "admin" || user.role === "analyst") return "vip";
  const row = await one<{ tier: Tier }>(
    `select tier from subscriptions where user_id = $1 and status in ('active','cancelled') and current_period_end > now()
     order by case tier when 'vip' then 2 else 1 end desc limit 1`, [user.id], db);
  return row?.tier ?? "free";
}
export const canAccess = (userTier: Tier, contentTier: Tier) => TIER_RANK[userTier] >= TIER_RANK[contentTier];
