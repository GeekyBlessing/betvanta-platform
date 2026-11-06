import { NextResponse } from "next/server";
import { one } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try { await one("select 1"); return NextResponse.json({ ok: true, db: "up" }); }
  catch (e) {
    // Non-secret diagnostics only: an error code and which kind of host is configured, never the URL.
    const url = process.env.DATABASE_URL ?? "";
    const host = !url ? "not set" : /pooler\.supabase\.com/.test(url) ? "supabase pooler" : /db\.[a-z0-9]+\.supabase\.co/.test(url) ? "supabase direct (IPv6-only, unsupported)" : "other";
    return NextResponse.json({ ok: false, db: "down", code: (e as { code?: string })?.code ?? "error", host }, { status: 503 });
  }
}
