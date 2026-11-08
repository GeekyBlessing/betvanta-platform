import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { discordOAuthEnabled } from "@/lib/env";
import { CommunitySection } from "@/components/Community";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Community", description: "Join the BETVANTA Discord community and follow BETVANTA on Instagram for daily picks, match insights and announcements." };

export default async function Community() {
  const u = await currentUser();
  const settings = u ? "/dashboard/settings" : "/login?next=/dashboard/settings";
  return (
    <>
      <CommunitySection id="community-page-h" />
      <section className="wrap py-14 md:py-16 grid gap-5 max-w-[820px]" aria-labelledby="premium-discord-h">
        <h2 id="premium-discord-h" className="display font-extrabold text-[24px] md:text-[30px]">How premium Discord access works</h2>
        <ol className="grid gap-4 list-decimal pl-5 text-[15px] leading-7">
          <li><strong>Join the server</strong> with Join Our Discord. On a phone it opens the Discord app. The public channels are free for everyone.</li>
          <li><strong>Choose a package</strong> on <Link href="/packages" className="text-link font-semibold underline">Packages</Link>. Premium picks and their full analysis unlock in your BETVANTA account as soon as your payment is confirmed.</li>
          <li><strong>Link Discord</strong> in <Link href={settings} className="text-link font-semibold underline">Settings</Link>.{discordOAuthEnabled()
            ? " BETVANTA gives you the premium or VIP role that matches your package, and removes it when the package ends."
            : " Automatic premium and VIP roles switch on once BETVANTA connects its Discord bot."}</li>
        </ol>
        <p className="text-xs text-subtle">Discord and Instagram are separate services with their own terms. Be respectful. Predictions are analysis, not guarantees. 18+ only.</p>
      </section>
    </>
  );
}
