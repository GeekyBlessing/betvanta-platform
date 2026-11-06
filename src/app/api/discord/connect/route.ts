import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { discordAuthorizeUrl } from "@/lib/services/discord";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
// GET so it can be a plain link; it only creates a state token for the signed-in user and redirects to Discord.
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.redirect(`${env().APP_URL}/login?next=/dashboard/settings`);
  try { return NextResponse.redirect(await discordAuthorizeUrl(u.id)); }
  catch { return NextResponse.redirect(`${env().APP_URL}/dashboard/settings?discord=unavailable`); }
}
