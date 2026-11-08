"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { BoardMatch, MarketKey } from "@/lib/services/sportsbook";
import { OddsButton } from "./slip";
import { SportIcon } from "../SportIcon";

const TZ = "America/New_York";
const time = (d: string) => new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(new Date(d));
const day = (d: string) => {
  const k = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(x);
  const t = new Date(); const tm = new Date(Date.now() + 864e5);
  return k(new Date(d)) === k(t) ? "Today" : k(new Date(d)) === k(tm) ? "Tomorrow" : new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(new Date(d));
};
const MKT: Record<MarketKey, { label: string; short: string; cols: string[] }> = {
  "1X2": { label: "Match result", short: "1X2", cols: ["1", "X", "2"] },
  OU25: { label: "Total goals 2.5", short: "O/U 2.5", cols: ["Over", "Under"] },
  BTTS: { label: "Both teams to score", short: "GG/NG", cols: ["GG", "NG"] },
};
const OUTCOME_NAME: Record<string, (m: BoardMatch) => string> = {
  home: (m) => `${m.home} to win`, draw: () => "Draw", away: (m) => `${m.away} to win`, over: () => "Over 2.5 goals", under: () => "Under 2.5 goals", yes: () => "Both teams to score: Yes", no: () => "Both teams to score: No",
};

/** A club badge stand-in: initials on a colour derived from the name. Real crests appear once a licensed feed supplies them. */
export function Crest({ name, short, size = 30 }: { name: string; short: string; size?: number }) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span aria-hidden className="crest" style={{ width: size, height: size, fontSize: size * 0.34, background: `linear-gradient(145deg, hsl(${h} 55% 42%), hsl(${(h + 30) % 360} 60% 24%))` }}>
      {(short || name).slice(0, 3).toUpperCase()}
    </span>
  );
}

/** The prices for one market, or why there are none. */
function Prices({ m, market, compact = false }: { m: BoardMatch; market: MarketKey; compact?: boolean }) {
  const mk = m.markets[market];
  const n = MKT[market].cols.length;
  if (mk.state === "open") {
    return (
      <div className="odds-row" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {mk.outcomes.map((o) => o.price
          ? <OddsButton key={o.key} fixtureId={m.id} match={`${m.home} v ${m.away}`} market={MKT[market].label} outcome={OUTCOME_NAME[o.key](m)} label={o.label} price={o.price} kickoff={m.kickoff_at} compact={compact} />
          : <span key={o.key} className={`odds-btn is-off ${compact ? "odds-compact" : ""}`}><span className="odds-label">{o.label}</span><span className="odds-price">-</span></span>)}
      </div>
    );
  }
  if (mk.state === "locked") {
    return (
      <Link href="/packages" className={`odds-locked ${compact ? "odds-compact" : ""}`} aria-label={`${MKT[market].label} prices are for ${mk.tier === "vip" ? "VIP" : "Premium"} members. View packages.`}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        {mk.tier === "vip" ? "VIP" : "Premium"} pick
      </Link>
    );
  }
  return (
    <div className="odds-row" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {MKT[market].cols.map((c) => <span key={c} className={`odds-btn is-off ${compact ? "odds-compact" : ""}`} title="No BETVANTA price for this market"><span className="odds-label">{c}</span><span className="odds-price">-</span></span>)}
    </div>
  );
}

function MarketTabs({ value, onChange, label }: { value: MarketKey; onChange: (k: MarketKey) => void; label: string }) {
  return (
    <div className="mkt-tabs" role="tablist" aria-label={label}>
      {(Object.keys(MKT) as MarketKey[]).map((k) => <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)} className={`mkt-tab ${value === k ? "is-on" : ""}`}>{MKT[k].short}</button>)}
    </div>
  );
}

/** Featured: horizontally scrolling match cards with a competition filter. */
export function FeaturedRail({ matches }: { matches: BoardMatch[] }) {
  const comps = useMemo(() => [...new Map(matches.map((m) => [m.competition_id, m.competition])).entries()], [matches]);
  const [comp, setComp] = useState<string | null>(null);
  const list = comp ? matches.filter((m) => m.competition_id === comp) : matches;
  if (!matches.length) return <Empty>No featured matches right now. Fixtures appear here as soon as they are scheduled.</Empty>;
  return (
    <div className="grid gap-3">
      {comps.length > 1 && (
        <div className="chip-row no-scrollbar" role="tablist" aria-label="Filter featured matches by competition">
          <button type="button" role="tab" aria-selected={!comp} onClick={() => setComp(null)} className={`chip ${!comp ? "is-on" : ""}`}>All</button>
          {comps.map(([id, name]) => <button key={id} type="button" role="tab" aria-selected={comp === id} onClick={() => setComp(id)} className={`chip ${comp === id ? "is-on" : ""}`}>{name}</button>)}
        </div>)}
      <div className="feat-rail no-scrollbar">
        {list.map((m) => {
          const tag = m.markets["1X2"].state === "open" ? "PRICED" : m.markets["1X2"].state === "locked" ? "PREMIUM PICK" : null;
          return (
            <article key={m.id} className="feat-card">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="flex items-center gap-1.5 min-w-0">{tag && <span className={`feat-tag ${tag === "PRICED" ? "" : "is-premium"}`}>{tag}</span>}{m.sample && <span className="demo-tag">DEMO</span>}</span>
                <Link href={`/matches/${m.id}`} className="text-muted hover:text-white truncate">{m.competition}</Link>
              </div>
              <Link href={`/matches/${m.id}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3">
                <span className="grid justify-items-center gap-1.5 text-center min-w-0"><Crest name={m.home} short={m.home_short} size={40} /><span className="text-[13px] font-semibold leading-tight line-clamp-2">{m.home}</span></span>
                <span className="grid justify-items-center"><span className="num text-[17px] font-bold">{time(m.kickoff_at)}</span><span className="text-[12px] text-muted">{day(m.kickoff_at)}</span></span>
                <span className="grid justify-items-center gap-1.5 text-center min-w-0"><Crest name={m.away} short={m.away_short} size={40} /><span className="text-[13px] font-semibold leading-tight line-clamp-2">{m.away}</span></span>
              </Link>
              <Prices m={m} market="1X2" />
            </article>);
        })}
      </div>
    </div>
  );
}

function Row({ m, market, live = false }: { m: BoardMatch; market: MarketKey; live?: boolean }) {
  return (
    <li className="match-line">
      <Link href={`/matches/${m.id}`} className="grid gap-1 min-w-0">
        <span className="flex items-center gap-2 text-[12px]">
          {live ? <span className="live-dot">LIVE</span> : <span className="num text-muted">{time(m.kickoff_at)} <span className="text-subtle">{day(m.kickoff_at)}</span></span>}
          {m.sample && <span className="demo-tag">DEMO</span>}
        </span>
        <span className="grid grid-cols-[1fr_auto] gap-x-3 items-center text-[14px]">
          <span className="flex items-center gap-2 min-w-0"><Crest name={m.home} short={m.home_short} size={20} /><span className="truncate">{m.home}</span></span>
          <span className="num font-bold">{live ? m.home_goals ?? 0 : ""}</span>
          <span className="flex items-center gap-2 min-w-0"><Crest name={m.away} short={m.away_short} size={20} /><span className="truncate">{m.away}</span></span>
          <span className="num font-bold">{live ? m.away_goals ?? 0 : ""}</span>
        </span>
      </Link>
      <div className="match-line-odds">
        {live ? <span className="odds-closed">Prices close at kickoff</span> : <Prices m={m} market={market} compact />}
      </div>
    </li>
  );
}

/** Upcoming or live matches grouped by competition, with market tabs (and sport tabs for live). */
export function MatchList({ matches, live = false, sportTabs = false }: { matches: BoardMatch[]; live?: boolean; sportTabs?: boolean }) {
  const [market, setMarket] = useState<MarketKey>("1X2");
  const sports = useMemo(() => [...new Set(matches.map((m) => m.sport))], [matches]);
  const [sport, setSport] = useState<string | null>(null);
  const list = sport ? matches.filter((m) => m.sport === sport) : matches;
  const groups = useMemo(() => {
    const g = new Map<string, BoardMatch[]>();
    for (const m of list) g.set(m.competition_id, [...(g.get(m.competition_id) ?? []), m]);
    return [...g.values()];
  }, [list]);
  const cols = MKT[market].cols;
  return (
    <div className="grid gap-3">
      {(sportTabs && sports.length > 1) && (
        <div className="chip-row no-scrollbar" role="tablist" aria-label="Filter by sport">
          <button type="button" role="tab" aria-selected={!sport} onClick={() => setSport(null)} className={`chip ${!sport ? "is-on" : ""}`}>All</button>
          {sports.map((s) => <button key={s} type="button" role="tab" aria-selected={sport === s} onClick={() => setSport(s)} className={`chip inline-flex items-center gap-1.5 ${sport === s ? "is-on" : ""}`}><SportIcon sport={s} size={14} />{SPORT_NAME[s] ?? s}</button>)}
        </div>)}
      {!live && <MarketTabs value={market} onChange={setMarket} label="Market" />}
      {!list.length ? <Empty>{live ? "No live matches right now. Live scores appear here when a match kicks off." : "No upcoming matches for this selection."}</Empty> : groups.map((g) => (
        <section key={g[0].competition_id} className="comp-block" aria-label={g[0].competition}>
          <header className="comp-head">
            <span className="flex items-center gap-2 min-w-0"><SportIcon sport={g[0].sport} size={15} /><span className="truncate font-semibold">{g[0].country ? `${g[0].country} · ` : ""}{g[0].competition}</span></span>
            {!live && <span className="comp-cols" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>{cols.map((c) => <span key={c}>{c}</span>)}</span>}
          </header>
          <ul>{g.map((m) => <Row key={m.id} m={m} market={market} live={live} />)}</ul>
        </section>))}
    </div>
  );
}

const SPORT_NAME: Record<string, string> = { football: "Football", american_football: "American Football", basketball: "Basketball", baseball: "Baseball", tennis: "Tennis", ice_hockey: "Ice Hockey", boxing: "Boxing", mma: "MMA" };
function Empty({ children }: { children: React.ReactNode }) { return <div className="board-empty">{children}</div>; }
