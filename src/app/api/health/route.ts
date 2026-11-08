import { NextResponse } from "next/server";
import { dbConnectionShape, one } from "@/lib/db";
import { schemaStatus } from "@/lib/schema";
export const dynamic = "force-dynamic";
export async function GET() {
  // Non-secret: which pooler mode and whether the least-privilege role is used. Expected: transaction, true.
  const shape = dbConnectionShape();
  const connection = shape.pooler ? { pooler_mode: shape.mode, app_role: shape.appRole } : undefined;
  try { await one("select 1"); }
  catch (e) {
    // Non-secret diagnostics only: an error code and which kind of host is configured, never the URL.
    const url = process.env.DATABASE_URL ?? "";
    const host = !url ? "not set" : /pooler\.supabase\.com/.test(url) ? "supabase pooler" : /db\.[a-z0-9]+\.supabase\.co/.test(url) ? "supabase direct (IPv6-only, unsupported)" : "other";
    return NextResponse.json({ ok: false, db: "down", code: (e as { code?: string })?.code ?? "error", host, connection }, { status: 503 });
  }
  // The database is reachable; also say whether it has every migration this deployment expects.
  try {
    const s = await schemaStatus();
    if (!s.current) return NextResponse.json({ ok: false, db: "up", schema: "behind", latest: s.latest, expected: s.expected,
      fix: "Run the Supabase check workflow in apply mode (docs/SUPABASE.md).", connection }, { status: 503 });
    return NextResponse.json({ ok: true, db: "up", schema: "current", latest: s.latest, connection });
  } catch (e) {
    return NextResponse.json({ ok: false, db: "up", schema: "unknown", code: (e as { code?: string })?.code ?? "error" }, { status: 503 });
  }
}
