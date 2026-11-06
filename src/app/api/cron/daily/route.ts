import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqualHex, sha256 } from "@/lib/crypto";
import { syncSportsData } from "@/lib/sports/sync";
import { runEngine, settleFinished } from "@/lib/services/predictions";
import { runSubscriptionMaintenance } from "@/lib/services/billing";
import { pruneRateLimits } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !safeEqualHex(sha256(given), sha256(secret))) return NextResponse.json({ ok: false }, { status: 401 });
  const out: Record<string, unknown> = {};
  try { out.sync = await syncSportsData(); } catch (e) { out.sync = String(e); }
  out.settle = await settleFinished();
  out.engine = await runEngine(null, 7);
  out.billing = await runSubscriptionMaintenance();
  await pruneRateLimits();
  return NextResponse.json({ ok: true, out });
}
