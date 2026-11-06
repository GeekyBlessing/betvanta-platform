/**
 * Client-confirmed plan features. A plan at level N includes every feature with level <= N.
 * `delivery` is honest about how each benefit reaches the member:
 *   "app"  = enforced and delivered by this codebase
 *   "team" = delivered by the BETVANTA team (Discord, video, support); access is checked against the member's level
 */
export type Delivery = "app" | "team";
export type Feature = { key: string; label: string; level: 1 | 2 | 3 | 4 | 5; delivery: Delivery };

export const FEATURES: Feature[] = [
  { key: "expert_picks", label: "Expert analysed picks", level: 1, delivery: "app" },
  { key: "ai_daily", label: "AI-powered daily analysis", level: 1, delivery: "app" },
  { key: "giveaways", label: "Weekly premium giveaways", level: 1, delivery: "team" },
  { key: "bankroll", label: "Bankroll-building strategies", level: 1, delivery: "team" },
  { key: "lotto", label: "Lotto selections", level: 1, delivery: "team" },
  { key: "live_video", label: "Live video analysis", level: 1, delivery: "team" },
  { key: "discord", label: "Discord community access", level: 1, delivery: "app" },
  { key: "priority_giveaways", label: "Priority access to giveaways", level: 2, delivery: "team" },
  { key: "enhanced_bankroll", label: "Enhanced bankroll building", level: 2, delivery: "team" },
  { key: "advanced_ai", label: "Advanced AI insights", level: 2, delivery: "app" },
  { key: "early_lotto", label: "Early access to lotto picks", level: 2, delivery: "team" },
  { key: "extended_video", label: "Extended video analysis", level: 2, delivery: "team" },
  { key: "vip_picks", label: "VIP-exclusive picks", level: 3, delivery: "app" },
  { key: "consultation", label: "One-on-one bankroll consultation", level: 3, delivery: "team" },
  { key: "vip_status", label: "Premium VIP status", level: 4, delivery: "app" },
  { key: "mega_giveaways", label: "Exclusive yearly mega giveaways", level: 4, delivery: "team" },
  { key: "priority_support", label: "Priority 24/7 support", level: 4, delivery: "team" },
  { key: "custom_strategies", label: "Custom AI-driven betting strategies", level: 4, delivery: "team" },
  { key: "vip_lotto", label: "VIP lotto selection service", level: 4, delivery: "team" },
  { key: "private_calls", label: "Weekly private video analysis calls", level: 4, delivery: "team" },
  { key: "lifetime_access", label: "All premium features for life", level: 5, delivery: "app" },
  { key: "lifetime_vip", label: "Lifetime VIP status", level: 5, delivery: "app" },
];

export const LEVEL_NAMES: Record<number, string> = { 1: "Monthly", 2: "3 Month", 3: "6 Month", 4: "1 Year", 5: "Lifetime" };
export const featuresAt = (level: number) => FEATURES.filter((f) => f.level === level);
export const featuresUpTo = (level: number) => FEATURES.filter((f) => f.level <= level);
/** The card copy for a plan: "Everything in <previous>" plus what this level adds. */
export function cardFeatures(level: number): string[] {
  if (level === 5) return featuresAt(5).map((f) => f.label);
  return [...(level > 1 ? [`Everything in ${LEVEL_NAMES[level - 1]}`] : []), ...featuresAt(level).map((f) => f.label)];
}
export const featureLevel = (key: string) => FEATURES.find((f) => f.key === key)?.level ?? 99;
/** Content tier used for prediction gating: VIP-exclusive picks start at level 3. */
export const tierForLevel = (level: number): "free" | "premium" | "vip" => (level >= 3 ? "vip" : level >= 1 ? "premium" : "free");
