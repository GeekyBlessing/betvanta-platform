import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { discordInviteUrl, discordOAuthEnabled, instagramHandle, instagramUrl } from "@/lib/env";
import { JoinDiscordButton } from "@/components/Discord";
import { Notice, PageHeader } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Community", description: "Join the BETVANTA Discord community." };
export default async function Community() {
  const u = await currentUser();
  const invite = discordInviteUrl();
  return (
    <div className="wrap py-10 max-w-[760px] grid gap-6">
      <PageHeader eyebrow="Community" title="BETVANTA on Discord">Pick announcements, match discussion and live sessions with the BETVANTA team and other members.</PageHeader>
      {invite ? <div><JoinDiscordButton className="btn btn-accent btn-lg" /></div>
        : <Notice tone="info" title="The Discord server opens soon.">The invite link will appear here and on the homepage as soon as it is live.</Notice>}
      <ol className="grid gap-4 list-decimal pl-5 text-[15px] leading-7">
        <li><strong>Join the server</strong> with the button above. On a phone it opens the Discord app.</li>
        <li><strong>Link your BETVANTA account</strong> in <Link href={u ? "/dashboard/settings" : "/login?next=/dashboard/settings"} className="text-link font-semibold underline">Settings</Link>{discordOAuthEnabled() ? "" : " (available once automatic roles are switched on)"}. Premium and VIP members get the matching role automatically, and it updates when your plan changes.</li>
        <li><strong>Follow the announcements channel</strong> for new picks. Free picks are posted in full; paid picks are announced and unlocked in your dashboard.</li>
      </ol>
      {instagramUrl() && <p className="text-[15px]">Follow BETVANTA on Instagram for match-day graphics and announcements: <a href={instagramUrl()!} target="_blank" rel="noopener noreferrer" className="text-link font-semibold underline">{instagramHandle()}<span className="sr-only"> (opens in a new tab)</span></a>.</p>}
      <p className="text-xs text-subtle">Discord and Instagram are separate services with their own terms. Be respectful; predictions are analysis, not guarantees.</p>
    </div>
  );
}
