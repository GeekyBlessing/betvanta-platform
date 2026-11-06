import { z } from "zod";
import { q, one } from "../db";
import { audit } from "../audit";
import { badRequest, notFound } from "../errors";
import { homeStats, MIN_SETTLED_FOR_RATE, type HomeStats } from "./stats";

export const STAT_KEYS = ["members", "win_rate", "winning_picks", "sports"] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type StatIcon = "members" | "target" | "trophy" | "sports";

export type HomepageStatRow = {
  key: StatKey; sort: number; icon: StatIcon; value_text: string; label: string; source: "manual" | "live";
  verification: "unverified" | "verified"; verification_note: string | null; verified_at: string | null; verified_by_name: string | null;
  visible: boolean; updated_at: string; updated_by_name: string | null;
};

/** What the homepage renders. `status` drives the label shown next to every figure. */
export type PublicStat = { key: StatKey; icon: StatIcon; value: string; label: string; status: "live" | "verified" | "unverified"; note?: string };

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

/** The figure each slot shows in "live" mode, computed from BETVANTA's own records. */
export function liveValue(key: StatKey, s: HomeStats): { value: string; note?: string } {
  switch (key) {
    case "members": return { value: fmt(s.members) };
    case "win_rate": return s.winRate === null ? { value: "Building", note: `Shown after ${MIN_SETTLED_FOR_RATE} settled picks` } : { value: `${s.winRate.toFixed(1)}%`, note: `${fmt(s.won)} won, ${fmt(s.lost)} lost` };
    case "winning_picks": return { value: fmt(s.won) };
    case "sports": return { value: String(s.sports) };
  }
}

const LIVE_DEFAULTS: Record<StatKey, { icon: StatIcon; label: string }> = {
  members: { icon: "members", label: "Members" }, win_rate: { icon: "target", label: "Win rate" },
  winning_picks: { icon: "trophy", label: "Winning picks" }, sports: { icon: "sports", label: "Sports covered" },
};

export async function listHomepageStats() {
  return q<HomepageStatRow>(
    `select h.key, h.sort, h.icon, h.value_text, h.label, h.source, h.verification, h.verification_note, h.verified_at, h.visible, h.updated_at,
            vb.display_name verified_by_name, ub.display_name updated_by_name
     from homepage_stats h left join users vb on vb.id = h.verified_by left join users ub on ub.id = h.updated_by order by h.sort`);
}

/**
 * Statistics for the homepage hero. If the homepage_stats table is not there yet (migration 010 not applied),
 * the page shows the live figures from BETVANTA's records and logs the problem; it never invents numbers.
 */
export async function publicHomepageStats(): Promise<{ stats: PublicStat[]; live: HomeStats; configMissing: boolean }> {
  const live = await homeStats();
  let rows: HomepageStatRow[];
  try { rows = await listHomepageStats(); }
  catch (e) {
    if ((e as { code?: string }).code !== "42P01") throw e;
    console.error("[homepage] homepage_stats table is missing; apply migration 010. Showing live figures only.");
    return { live, configMissing: true, stats: STAT_KEYS.map((k) => ({ key: k, ...LIVE_DEFAULTS[k], ...liveValue(k, live), status: "live" as const })) };
  }
  const stats = rows.filter((r) => r.visible).map((r): PublicStat => {
    if (r.source === "live") return { key: r.key, icon: r.icon, label: r.label, ...liveValue(r.key, live), status: "live" };
    return { key: r.key, icon: r.icon, label: r.label, value: r.value_text, status: r.verification };
  });
  return { stats, live, configMissing: false };
}

export const statUpdateSchema = z.object({
  value: z.string().trim().min(1, "Enter a figure.").max(16, "Keep the figure to 16 characters.").regex(/\d/, "The figure must contain a number."),
  label: z.string().trim().min(1, "Enter a label.").max(40, "Keep the label to 40 characters."),
  source: z.enum(["manual", "live"]),
  verification: z.enum(["unverified", "verified"]),
  verificationNote: z.string().trim().max(280).optional(),
  visible: z.boolean(),
});

export async function updateHomepageStat(adminId: string, key: string, input: z.infer<typeof statUpdateSchema>) {
  if (!(STAT_KEYS as readonly string[]).includes(key)) throw notFound("Unknown statistic.");
  const before = await one<HomepageStatRow & { verified_by: string | null }>("select * from homepage_stats where key = $1", [key]);
  if (!before) throw notFound("Unknown statistic.");
  const note = input.verificationNote || null;
  if (input.source === "manual" && input.verification === "verified" && (!note || note.length < 10))
    throw badRequest("Describe how this figure was verified (source, auditor or report, and date) before marking it verified.", { verificationNote: ["Required to mark a figure as verified (at least 10 characters)."] });
  // Live figures come from our own records, so verification fields do not apply to them.
  const verified = input.source === "manual" && input.verification === "verified";
  const keepVerifier = verified && before.verification === "verified" && before.verification_note === note && before.value_text === input.value;
  await q(
    `update homepage_stats set value_text = $2, label = $3, source = $4, verification = $5, verification_note = $6,
       verified_by = $7, verified_at = $8, visible = $9, updated_by = $10, updated_at = now() where key = $1`,
    [key, input.value, input.label, input.source, verified ? "verified" : "unverified", verified ? note : null,
     verified ? (keepVerifier ? before.verified_by : adminId) : null, verified ? (keepVerifier ? before.verified_at : new Date().toISOString()) : null,
     input.visible, adminId]);
  await audit(adminId, "admin.update_homepage_stat", "homepage_stat", key, {
    before: { value: before.value_text, label: before.label, source: before.source, verification: before.verification, note: before.verification_note, visible: before.visible },
    after: { value: input.value, label: input.label, source: input.source, verification: verified ? "verified" : "unverified", note: verified ? note : null, visible: input.visible },
  });
}
