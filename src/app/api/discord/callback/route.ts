import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { completeDiscordLink } from "@/lib/services/discord";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = await currentUser();
  const sp = new URL(req.url).searchParams;
  const back = (s: string) => NextResponse.redirect(`${env().APP_URL}/dashboard/settings?discord=${s}`);
  if (!u) return NextResponse.redirect(`${env().APP_URL}/login?next=/dashboard/settings`);
  const code = sp.get("code"), state = sp.get("state");
  if (!code || !state || code.length > 200 || state.length > 200) return back("cancelled");
  try { await completeDiscordLink(u.id, code, state); return back("linked"); } catch { return back("failed"); }
}
