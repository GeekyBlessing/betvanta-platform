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

/**
 * What the homepage hero renders. These are marketing figures, kept apart from live platform statistics (homeStats,
 * shown on /performance and in admin). `client` = provided by BETVANTA and not independently verified (the page says so);
 * `verified` = an admin recorded the evidence; `live` = an admin chose the live figure for that slot.
 */
export type PublicStat = { key: StatKey; icon: StatIcon; value: string; label: string; status: "client" | "verified" | "live"; note?: string };

/** Client-provided figures. Used if the homepage_stats table is not available, so an empty or missing table never shows 0. */
export const CLIENT_FIGURES: { key: StatKey; icon: StatIcon; value: string; label: string }[] = [
  { key: "members", icon: "members", value: "2,000", label: "Happy Members" },
  { key: "win_rate", icon: "target", value: "75%", label: "Win Rate" },
  { key: "winning_picks", icon: "trophy", value: "12,500", label: "Winning Picks" },
  { key: "sports", icon: "sports", value: "10", label: "Sports Covered" },
];

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

export async function listHomepageStats() {
  return q<HomepageStatRow>(
    `select h.key, h.sort, h.icon, h.value_text, h.label, h.source, h.verification, h.verification_note, h.verified_at, h.visible, h.updated_at,
            vb.display_name verified_by_name, ub.display_name updated_by_name
     from homepage_stats h left join users vb on vb.id = h.verified_by left join users ub on ub.id = h.updated_by order by h.sort`);
}

/**
 * Figures for the homepage hero. Entered figures are shown as entered, whatever the live records say; a slot shows a
 * live figure only when an admin switched it to "live". If the table is missing (migration 010 not applied) the
 * client figures are shown and the problem is logged.
 */
export async function publicHomepageStats(): Promise<{ stats: PublicStat[]; live: HomeStats; configMissing: boolean }> {
  const live = await homeStats();
  let rows: HomepageStatRow[];
  try { rows = await listHomepageStats(); }
  catch (e) {
    if ((e as { code?: string }).code !== "42P01") throw e;
    console.error("[homepage] homepage_stats table is missing; apply migration 010. Showing the client-provided figures.");
    return { live, configMissing: true, stats: CLIENT_FIGURES.map((f) => ({ ...f, status: "client" as const })) };
  }
  if (!rows.length) return { live, configMissing: true, stats: CLIENT_FIGURES.map((f) => ({ ...f, status: "client" as const })) };
  const stats = rows.filter((r) => r.visible).map((r): PublicStat =>
    r.source === "live"
      ? { key: r.key, icon: r.icon, label: r.label, ...liveValue(r.key, live), status: "live" }
      : { key: r.key, icon: r.icon, label: r.label, value: r.value_text, status: r.verification === "verified" ? "verified" : "client" });
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
