import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqualHex, sha256 } from "@/lib/crypto";
import { runDbHealth } from "@/lib/services/db-health";
export const dynamic = "force-dynamic";

// Runs the app's real database reads. Protected by CRON_SECRET because the output names tables and errors.
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !safeEqualHex(sha256(given), sha256(secret))) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await runDbHealth();
  return NextResponse.json(result, { status: result.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
