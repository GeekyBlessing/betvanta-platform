import Link from "next/link";
import type { PublicPrediction } from "@/lib/services/predictions";
import { MARKET_LABEL } from "@/lib/services/engine";
import { Confidence, fmtKickoff, resultBadge, SampleBadge, tierBadge } from "./ui";

function Team({ name, short, form }: { name: string; short: string; form: string | null }) {
  return (
    <div className="grid grid-cols-[28px_1fr_auto] gap-3 items-center">
      <span aria-hidden className="h-7 w-7 rounded-full bg-sunken text-muted grid place-items-center display text-[10px] font-bold">{short}</span>
      <span className="font-semibold">{name}</span>
      {form && <span className="num text-xs text-subtle tracking-[.08em]" aria-label={`Last five, latest first: ${form}`}>{form}</span>}
    </div>
  );
}

/** Groups the markets of one fixture into a single card. Locked markets never contain the selection (redacted server-side). */
export function FixtureCard({ preds }: { preds: PublicPrediction[] }) {
  const f = preds[0];
  return (
    <article className="card p-5 grid gap-4 min-w-0">
      <div className="flex justify-between gap-3 items-baseline">
        <span className="eyebrow">{f.competition}</span>
        <span className="num text-xs text-subtle whitespace-nowrap">{f.fixture_status === "finished" ? `FT ${f.home_goals}-${f.away_goals}` : fmtKickoff(f.kickoff_at)}</span>
      </div>
      <div className="grid gap-2"><Team name={f.home} short={f.home_short} form={f.home_form} /><Team name={f.away} short={f.away_short} form={f.away_form} /></div>
      <ul className="grid gap-2">
        {preds.map((p) => (
          <li key={p.id} className="rounded-md bg-sunken px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted">{MARKET_LABEL[p.market]}</div>
              {p.selection ? <div className="font-semibold">{p.selection}{p.probability && <span className="num text-xs text-subtle font-medium ml-2">{Math.round(Number(p.probability) * 100)}%</span>}</div>
                : <div className="font-semibold text-subtle">Locked</div>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {p.status === "settled" ? resultBadge(p.result) : p.locked ? <Link href="/pricing" className="btn btn-secondary btn-sm">Unlock with {p.access_tier === "vip" ? "VIP" : "Premium"}</Link> : <Confidence band={p.confidence} />}
              {tierBadge(p.access_tier)}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <Link href={`/matches/${f.fixture_id}`} className="text-sm font-semibold text-link hover:underline">Match analysis</Link>
        {f.data_source === "mock" && <SampleBadge />}
      </div>
    </article>
  );
}

export function groupByFixture(ps: PublicPrediction[]) {
  const m = new Map<string, PublicPrediction[]>();
  for (const p of ps) m.set(p.fixture_id, [...(m.get(p.fixture_id) ?? []), p]);
  return [...m.values()];
}
