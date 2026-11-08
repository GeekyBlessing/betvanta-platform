import type { Metadata } from "next";
import Link from "next/link";
import { searchSportsbook } from "@/lib/services/sportsbook";
import { SportIcon } from "@/components/SportIcon";
import { Crest } from "@/components/sportsbook/board";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search", description: "Search BETVANTA for teams, leagues and matches." };

const when = (d: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" }).format(new Date(d));

export default async function Search(props: { searchParams: Promise<{ q?: string }> }) {
  const term = ((await props.searchParams).q ?? "").slice(0, 60);
  const r = await searchSportsbook(term);
  return (
    <div className="wrap py-6 md:py-8 grid gap-6 max-w-[860px]">
      <form action="/search" role="search" className="header-search !w-full !h-12 !rounded-lg">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
        <input name="q" defaultValue={term} autoFocus placeholder="Search teams or leagues" aria-label="Search teams or leagues" className="!text-[16px]" />
      </form>
      {term.trim().length < 2 ? <p className="text-muted">Type at least two letters of a team, league or country.</p> : (<>
        <section className="grid gap-2" aria-labelledby="sr-comp">
          <h2 id="sr-comp" className="board-h">Competitions</h2>
          {r.competitions.length ? <ul className="side-card">{r.competitions.map((c) => (
            <li key={c.id}><Link href={`/?comp=${c.id}`} className="side-link"><SportIcon sport={c.sport} size={16} />{c.name}<span className="text-subtle text-[12px]">{c.country}</span></Link></li>))}</ul>
            : <p className="text-muted text-sm">No competitions match &ldquo;{term}&rdquo;.</p>}
        </section>
        <section className="grid gap-2" aria-labelledby="sr-matches">
          <h2 id="sr-matches" className="board-h">Matches</h2>
          {r.matches.length ? <ul className="comp-block">{r.matches.map((m) => (
            <li key={m.id} className="border-t border-line first:border-t-0"><Link href={`/matches/${m.id}`} className="grid gap-1 px-3 py-3 hover:bg-[#18181C]">
              <span className="text-[12px] text-muted">{when(m.kickoff_at)} · {m.competition}</span>
              <span className="flex items-center gap-2 text-[14px]"><Crest name={m.home} short={m.home_short} size={20} />{m.home}<span className="text-subtle">v</span><Crest name={m.away} short={m.away_short} size={20} />{m.away}</span>
            </Link></li>))}</ul>
            : <p className="text-muted text-sm">No upcoming matches match &ldquo;{term}&rdquo;.</p>}
        </section>
      </>)}
    </div>
  );
}
