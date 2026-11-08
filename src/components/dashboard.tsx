import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicPrediction } from "@/lib/services/predictions";
import type { FixtureRow } from "@/lib/services/sports";
import { MARKET_LABEL } from "@/lib/services/engine";
import { Badge, Confidence, fmtTime, resultBadge, SampleBadge } from "./ui";
import { SportIcon } from "./SportIcon";

const TZ = () => process.env.APP_TIMEZONE || "America/New_York";
const fmtShortDay = (iso: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ() }).format(new Date(iso));

/** Team mark. Crests come only from a licensed data provider; until one is connected we show the team's code. */
export function TeamMark({ short, size = 28 }: { short: string; size?: number }) {
  return <span aria-hidden className="shrink-0 rounded-full bg-sunken text-ink grid place-items-center display font-bold border border-line" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>{short.slice(0, 3)}</span>;
}

export function SectionHead({ id, title, meta, href, linkLabel }: { id: string; title: string; meta?: ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="grid gap-0.5 min-w-0">
        <h2 id={id} className="display font-bold text-[18px] leading-6 md:text-[20px] md:leading-7">{title}</h2>
        {meta && <p className="text-[13px] text-muted">{meta}</p>}
      </div>
      {href && <Link href={href} className="shrink-0 text-[13px] font-semibold text-link hover:underline">{linkLabel ?? "View all"}<span aria-hidden> &rsaquo;</span></Link>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card px-4 py-6 text-sm text-muted text-center">{children}</div>;
}

const status = (f: Pick<FixtureRow, "status" | "kickoff_at">) =>
  f.status === "live" ? <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-danger"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />Live</span>
    : f.status === "finished" ? <span className="text-[11px] font-semibold uppercase text-subtle">FT</span>
    : f.status === "postponed" || f.status === "cancelled" ? <span className="text-[11px] font-semibold uppercase text-warning">{f.status === "postponed" ? "PPD" : "CANC"}</span>
    : <span className="num text-[13px] text-ink whitespace-nowrap">{fmtTime(f.kickoff_at)}</span>;

/** One fixture as a dense, scannable row: status or kickoff time, both teams with marks and scores, picks available. */
export function MatchRow({ f, showCompetition = false, compact = false, hideSample = false }: { f: FixtureRow; showCompetition?: boolean; compact?: boolean; hideSample?: boolean }) {
  const done = f.status === "finished" || f.status === "live";
  const homeWin = done && (f.home_goals ?? 0) > (f.away_goals ?? 0), awayWin = done && (f.away_goals ?? 0) > (f.home_goals ?? 0);
  return (
    <li>
      <Link href={`/matches/${f.id}`} className="match-row grid grid-cols-[64px_1fr_auto] items-center gap-3 px-4 py-2.5 hover:bg-sunken focus-visible:bg-sunken">
        <span className="grid gap-0.5">{status(f)}{f.status === "scheduled" && <span className="text-[10px] text-subtle">ET</span>}</span>
        <span className="grid gap-1 min-w-0">
          {[[f.home, f.home_short, f.home_goals, homeWin], [f.away, f.away_short, f.away_goals, awayWin]].map(([name, short, goals, win], i) => (
            <span key={i} className="flex items-center gap-2 min-w-0">
              <TeamMark short={String(short)} size={22} />
              <span className={`truncate text-[14px] ${win ? "font-bold" : "font-medium"}`}>{String(name)}</span>
              {done && <span className={`num ml-auto pl-2 text-[14px] ${win ? "font-bold" : ""}`}>{goals ?? "-"}</span>}
            </span>))}
          {showCompetition && <span className="text-[11px] text-subtle truncate">{f.competition}</span>}
        </span>
        {!compact ? <span className="flex flex-col items-end gap-1">
          {f.predictions > 0 && <Badge tone="teal">{f.predictions} {f.predictions === 1 ? "pick" : "picks"}</Badge>}
          {f.data_source === "mock" && !hideSample && <SampleBadge />}
        </span> : <span aria-hidden className="text-subtle">&rsaquo;</span>}
      </Link>
    </li>
  );
}

/** Fixtures grouped under a competition header row, like a scores app. */
export function FixtureTable({ rows }: { rows: FixtureRow[] }) {
  const groups = new Map<string, FixtureRow[]>();
  for (const r of rows) groups.set(r.competition_id, [...(groups.get(r.competition_id) ?? []), r]);
  return (
    <div className="card overflow-hidden divide-y divide-[var(--border)]">
      {[...groups.values()].map((g) => (
        <section key={g[0].competition_id} aria-label={g[0].competition}>
          <div className="flex items-center gap-2 px-4 py-2 bg-sunken text-[12px] font-semibold text-muted">
            <span className="text-link"><SportIcon sport={g[0].sport} size={14} /></span>
            <span className="uppercase tracking-[.06em] truncate">{g[0].competition}</span>
            {g[0].data_source === "mock" && <span className="ml-auto"><SampleBadge /></span>}
          </div>
          <ul className="divide-y divide-[var(--border)]">{g.map((f) => <MatchRow key={f.id} f={f} hideSample />)}</ul>
        </section>))}
    </div>
  );
}

/** A featured fixture with its markets. Locked selections were removed on the server; only the lock is shown. */
export function PredictionTile({ preds }: { preds: PublicPrediction[] }) {
  const f = preds[0];
  return (
    <article className="card p-4 grid gap-3 content-start min-w-0" aria-label={`${f.home} v ${f.away}`}>
      <div className="flex items-center justify-between gap-2 text-[12px] text-muted">
        <span className="truncate font-semibold uppercase tracking-[.06em]">{f.competition}</span>
        <span className="num whitespace-nowrap">{fmtShortDay(f.kickoff_at)} · {fmtTime(f.kickoff_at)} ET</span>
      </div>
      <div className="grid gap-1.5">
        {[[f.home, f.home_short, f.home_form], [f.away, f.away_short, f.away_form]].map(([n, s, form]) => (
          <div key={String(n)} className="flex items-center gap-2.5 min-w-0">
            <TeamMark short={String(s)} />
            <span className="font-semibold truncate">{String(n)}</span>
            {form && <span className="num ml-auto text-[11px] text-subtle tracking-[.12em]" aria-label={`Recent form, latest first: ${form}`}>{String(form)}</span>}
          </div>))}
      </div>
      <ul className="grid gap-px rounded-md overflow-hidden border border-line bg-[var(--border)]">
        {preds.map((p) => {
          const pct = p.probability ? Math.round(Number(p.probability) * 100) : null;
          return (
            <li key={p.id} className="bg-surface px-3 py-2.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 items-center">
              <span className="text-[12px] text-muted">{MARKET_LABEL[p.market] ?? p.market}</span>
              {p.locked
                ? <span className="justify-self-end inline-flex items-center gap-1 text-[12px] font-semibold text-accent-text"><svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>{p.access_tier === "vip" ? "VIP" : "Premium"}</span>
                : <span className="justify-self-end num text-[13px] font-semibold">{pct !== null ? `${pct}%` : ""}</span>}
              {p.locked
                ? <span className="col-span-2 text-[13px] text-subtle">Pick hidden. <Link href="/packages" className="font-semibold text-link hover:underline">Unlock</Link></span>
                : <>
                  <span className="font-semibold text-[14px] truncate">{p.selection}</span>
                  <span className="justify-self-end"><Confidence band={p.confidence} /></span>
                  {pct !== null && <span aria-hidden className="col-span-2 h-1 rounded-full bg-sunken overflow-hidden"><span className="block h-full bg-[var(--link)]" style={{ width: `${pct}%` }} /></span>}
                </>}
            </li>);
        })}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <Link href={`/matches/${f.fixture_id}`} className="text-[13px] font-semibold text-link hover:underline">Match analysis<span aria-hidden> &rsaquo;</span></Link>
        {f.data_source === "mock" && <SampleBadge />}
      </div>
    </article>
  );
}

/** The latest graded picks as a W/L/V strip; the letter is always printed so colour is never the only signal. */
export function FormStrip({ picks }: { picks: PublicPrediction[] }) {
  return (
    <ol className="flex gap-1 flex-wrap" aria-label="Latest graded picks, newest first">
      {picks.map((p) => {
        const r = p.result === "won" ? "W" : p.result === "lost" ? "L" : "V";
        return <li key={p.id} title={`${p.home} v ${p.away}: ${MARKET_LABEL[p.market]} ${p.selection ?? ""}, ${p.result}`}
          className={`num h-7 w-7 rounded grid place-items-center text-[12px] font-bold ${r === "W" ? "bg-success-subtle text-success" : r === "L" ? "bg-danger-subtle text-danger" : "bg-sunken text-muted"}`}>{r}</li>;
      })}
    </ol>
  );
}

export function SettledLine({ p }: { p: PublicPrediction }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="grid min-w-0">
        <span className="text-[13px] font-medium truncate">{p.home} {p.home_goals !== null && p.away_goals !== null ? <span className="num font-semibold">{p.home_goals}-{p.away_goals}</span> : <span className="text-subtle">v</span>} {p.away}</span>
        <span className="text-[12px] text-subtle truncate">{MARKET_LABEL[p.market]}: {p.selection}</span>
      </span>
      {resultBadge(p.result)}
    </li>
  );
}
