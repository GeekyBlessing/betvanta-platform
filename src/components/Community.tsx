import Link from "next/link";
import { discordInviteUrl, instagramHandle, instagramUrl, xHandle, xUrl } from "@/lib/env";
import { DiscordGlyph } from "./Discord";

export const InstagramGlyph = ({ size = 18 }: { size?: number }) => (
  // Generic camera glyph (not Instagram's logo, which has its own brand rules).
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></svg>
);

// Generic "@" glyph (not X's logo, which has its own brand rules).
export const XGlyph = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3.6" /><path d="M15.6 12v1.6a2.4 2.4 0 0 0 4.8 0V12a8.4 8.4 0 1 0-3.3 6.7" /></svg>
);
/** "FOLLOW US ON X": the official profile from X_URL, in a new tab. Renders nothing if none is configured. */
export function XCta({ className = "btn community-btn community-btn-outline", label = "Follow Us on X" }: { className?: string; label?: string }) {
  const u = xUrl();
  return u ? <a href={u} target="_blank" rel="noopener noreferrer" className={className}><XGlyph size={20} />{label}<span className="sr-only"> (opens in a new tab)</span></a> : null;
}

/** "JOIN OUR DISCORD": the official invite from DISCORD_INVITE_URL, in a new tab. Renders nothing if no valid invite is configured. */
export function DiscordCta({ className = "btn btn-accent community-btn", label = "Join Our Discord" }: { className?: string; label?: string }) {
  const u = discordInviteUrl();
  return u ? <a href={u} target="_blank" rel="noopener noreferrer" className={className}><DiscordGlyph size={20} />{label}<span className="sr-only"> (opens in a new tab)</span></a> : null;
}
/** "FOLLOW US ON INSTAGRAM": the official profile from INSTAGRAM_URL, in a new tab. Renders nothing if none is configured. */
export function InstagramCta({ className = "btn community-btn community-btn-outline", label = "Follow Us on Instagram" }: { className?: string; label?: string }) {
  const u = instagramUrl();
  return u ? <a href={u} target="_blank" rel="noopener noreferrer" className={className}><InstagramGlyph size={20} />{label}<span className="sr-only"> (opens in a new tab)</span></a> : null;
}

const Tick = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 mt-[4px]"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const List = ({ items }: { items: string[] }) => <ul className="grid gap-2.5 text-[15px]">{items.map((t) => <li key={t} className="flex gap-2.5"><span className="text-[#E41B23]"><Tick /></span><span>{t}</span></li>)}</ul>;

export const FREE_COMMUNITY = [
  "Daily sports picks and predictions shared in the public Discord channels",
  "Match discussion and announcements from the BETVANTA team",
  "Daily sports updates, selected picks and match insights on Instagram",
  "Analysis and match-day updates on X",
];
export const PREMIUM_COMMUNITY = [
  "Every premium pick with its full match analysis, unlocked in your BETVANTA account",
  "Private premium and VIP Discord channels, opened by linking Discord in your account settings",
  "The extra benefits of your package, from giveaways to private video calls",
];

/**
 * "Stay Ahead With the BETVANTA Community": Discord and Instagram calls to action, what each channel gives you,
 * and a clear line between free community content and paid premium content.
 * Premium content is protected on the server: premium picks are removed before a page is sent to anyone without an
 * active plan, and Discord premium roles are granted and removed by BETVANTA's bot according to the member's plan.
 */
export function CommunitySection({ id = "community-h", showTiers = true }: { id?: string; showTiers?: boolean }) {
  const handle = instagramHandle();
  return (
    <section className="community" aria-labelledby={id}>
      <div className="wrap py-16 md:py-24 grid gap-12">
        <div className="text-center grid gap-4 justify-items-center">
          <p className="text-[12px] font-bold tracking-[.22em] uppercase text-[#FF5A61]">Community</p>
          <h2 id={id} className="display text-white font-extrabold text-[30px] leading-[36px] md:text-[46px] md:leading-[52px] max-w-[820px]">Stay Ahead With the BETVANTA Community</h2>
          <p className="text-[16px] md:text-[18px] leading-relaxed text-[#F2F2F4]/90 max-w-[680px]">Get daily sports updates, expert picks, match insights and exclusive content. Join our Discord community and follow us on Instagram to stay connected.</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto pt-2">
            <DiscordCta />
            <InstagramCta />
            <XCta />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <article className="community-card">
            <div className="flex items-center gap-3"><span className="community-icon"><DiscordGlyph size={22} /></span><h3 className="font-bold text-[19px] text-white">Discord: our home base</h3></div>
            <p className="text-[15px] text-[#F2F2F4]/85">Our primary community. We publish daily sports picks and predictions here, talk through the day&rsquo;s matches and post every announcement first.</p>
            <List items={["Daily picks and predictions", "Live match discussion with members and the team", "Announcements, giveaways and video sessions"]} />
            <DiscordCta className="btn btn-accent w-full sm:w-fit mt-auto" label="Join Our Discord" />
          </article>
          <article className="community-card">
            <div className="flex items-center gap-3"><span className="community-icon"><InstagramGlyph size={22} /></span><h3 className="font-bold text-[19px] text-white">Instagram{handle ? ` ${handle}` : ""}</h3></div>
            <p className="text-[15px] text-[#F2F2F4]/85">Our official social channel for updates and engagement. Follow along for the day&rsquo;s highlights in your feed.</p>
            <List items={["Daily sports updates and selected picks", "Match insights and announcements", "Exclusive content for followers"]} />
            <InstagramCta className="btn community-btn-outline w-full sm:w-fit mt-auto" label="Follow Us on Instagram" />
          </article>
          {xUrl() && <article className="community-card">
            <div className="flex items-center gap-3"><span className="community-icon"><XGlyph size={22} /></span><h3 className="font-bold text-[19px] text-white">X {xHandle()}</h3></div>
            <p className="text-[15px] text-[#F2F2F4]/85">Quick analysis, match-day updates and announcements from the BETVANTA analyst.</p>
            <List items={["Match-day analysis and talking points", "Pick announcements and results", "Live updates and news"]} />
            <XCta className="btn community-btn-outline w-full sm:w-fit mt-auto" label="Follow Us on X" />
          </article>}
        </div>

        {showTiers && <CommunityAccess />}
      </div>
    </section>
  );
}

/** Free community vs premium membership, stated plainly. Used on the homepage, Packages and Community pages. */
export function CommunityAccess({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const dark = tone === "dark";
  return (
    <div className={`grid gap-5 md:grid-cols-2 ${dark ? "" : "text-ink"}`} aria-label="Free community and premium access">
      <div className={dark ? "access-card" : "card p-6 grid gap-4 content-start"}>
        <div className="grid gap-1"><span className={`text-[12px] font-bold tracking-[.16em] uppercase ${dark ? "text-[#F2F2F4]/70" : "text-muted"}`}>Free for everyone</span>
          <h3 className={`font-bold text-[20px] ${dark ? "text-white" : ""}`}>Community</h3></div>
        <List items={FREE_COMMUNITY} />
        <p className={`text-[13px] ${dark ? "text-[#F2F2F4]/70" : "text-subtle"}`}>No account or payment needed: join Discord and follow us on Instagram and X.</p>
      </div>
      <div className={dark ? "access-card access-card-premium" : "rounded-xl p-6 grid gap-4 content-start bg-brand text-on-brand"}>
        <div className="grid gap-1"><span className="text-[12px] font-bold tracking-[.16em] uppercase text-[#FF5A61]">Paid packages</span>
          <h3 className="font-bold text-[20px] text-white">Premium</h3></div>
        <List items={PREMIUM_COMMUNITY} />
        <p className="text-[13px] text-[#F2F2F4]/80">Premium content is unlocked by an active package and checked on our servers, so it never reaches anyone without access.</p>
        <Link href="/packages" className="btn btn-accent w-full sm:w-fit mt-1">See Packages</Link>
      </div>
    </div>
  );
}
