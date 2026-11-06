import { discordInviteUrl } from "@/lib/env";

export const DiscordGlyph = ({ size = 18 }: { size?: number }) => (
  // Simple speech-bubble community glyph (not the Discord logo, which has its own brand rules).
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.6 3.7a.6.6 0 0 1-1-.5V16h0A1.5 1.5 0 0 1 4 14.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="9" cy="9.6" r="1.2" fill="currentColor" /><circle cx="15" cy="9.6" r="1.2" fill="currentColor" /></svg>
);

/**
 * Join Discord: opens the client's official invite in a new tab when DISCORD_INVITE_URL is set (works on desktop and mobile,
 * where it hands off to the Discord app). Until then it goes to /community, which explains what is coming.
 */
export function JoinDiscordButton({ className = "btn btn-secondary btn-lg", label = "Join Discord" }: { className?: string; label?: string }) {
  const invite = discordInviteUrl();
  return invite
    ? <a href={invite} target="_blank" rel="noopener noreferrer" className={className}><DiscordGlyph />{label}<span className="sr-only"> (opens in a new tab)</span></a>
    : <a href="/community" className={className}><DiscordGlyph />{label}</a>;
}
