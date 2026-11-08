import type { Metadata } from "next";
import Link from "next/link";
import { discordInviteUrl } from "@/lib/env";
export const metadata: Metadata = { title: "Virtual Sports", description: "BETVANTA Virtual Sports: instant football, basketball, penalty shootouts and racing. Coming soon." };

const GAMES = [
  { key: "football", title: "Instant Football", img: "/images/sports/soccer.svg", body: "Full matches decided in minutes, around the clock." },
  { key: "basketball", title: "Instant Basketball", img: "/images/sports/basketball.svg", body: "Fast four-quarter games with quick results." },
  { key: "penalty", title: "Penalty Shootout", img: "/images/sports/penalty.svg", body: "Five kicks each, then sudden death." },
  { key: "racing", title: "Virtual Racing", img: "/images/sports/racing.svg", body: "Race cards every few minutes, all day." },
];

/**
 * Virtual sports showcase. No virtual sports provider is connected, so nothing here can be played or staked;
 * the page says so plainly and points visitors to Discord for the launch announcement.
 */
export default function Virtuals() {
  const discord = discordInviteUrl();
  return (
    <div className="grid gap-8">
      <section className="virt-hero" aria-labelledby="virt-h">
        <div className="wrap py-10 md:py-14 grid gap-8 justify-items-center text-center">
          <p className="virt-kicker"><span className="demo-tag">COMING SOON</span> BETVANTA Virtuals</p>
          <ul className="virt-grid" aria-label="Virtual sports">
            {GAMES.map((g) => (
              <li key={g.key} className="virt-tile">
                {/* eslint-disable-next-line @next/next/no-img-element -- local SVG illustration */}
                <img src={g.img} alt="" width={240} height={240} loading="lazy" />
                <span className="virt-label">{g.title}</span>
              </li>))}
          </ul>
          <h1 id="virt-h" className="virt-title">Play <span className="text-[#F2B84B]">Virtual</span> Sports<br /><span className="virt-sub">All day, every day</span></h1>
          <p className="text-muted max-w-[56ch]">Virtual sports are on the way. No virtual sports provider is connected yet, so games cannot be played here. Join our Discord to hear the moment they launch.</p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {discord && <a href={discord} target="_blank" rel="noopener noreferrer" className="btn btn-accent hero-btn">Get notified on Discord<span className="sr-only"> (opens in a new tab)</span></a>}
            <Link href="/packages" className="btn hero-btn hero-btn-ghost">View Packages</Link>
          </div>
        </div>
      </section>
      <section className="wrap grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Games planned">
        {GAMES.map((g) => (
          <article key={g.key} className="card p-5 grid gap-2 content-start">
            <h2 className="font-bold text-[16px]">{g.title}</h2>
            <p className="text-[14px] text-muted">{g.body}</p>
            <span className="text-[12px] font-semibold text-warning">Not available yet</span>
          </article>))}
      </section>
      <p className="wrap text-xs text-subtle">BETVANTA does not accept bets, deposits or withdrawals. Virtual sports will only launch with a licensed provider. 18+ only.</p>
    </div>
  );
}
