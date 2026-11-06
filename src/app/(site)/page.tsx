import Link from "next/link";
import { currentUser } from "@/lib/session";
import { tierFor } from "@/lib/services/entitlements";
import { listPredictions, performance } from "@/lib/services/predictions";
import { FixtureCard, groupByFixture } from "@/components/PredictionCard";
import { Notice, RG_LINE, Stat } from "@/components/ui";
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const tier = await tierFor(user);
  const [upcoming, perf] = await Promise.all([listPredictions(tier, { upcoming: true, limit: 12 }), performance()]);
  const all = perf.find((r) => !r.market && !r.access_tier) ?? (perf.length ? perf[perf.length - 1] : null);
  const won = Number(all?.won ?? 0), lost = Number(all?.lost ?? 0);
  const fixtures = groupByFixture(upcoming).slice(0, 4);
  return (
    <>
      <section className="bg-brand text-on-brand">
        <div className="wrap py-14 md:py-20 grid gap-10 md:grid-cols-[1.2fr_1fr] items-center">
          <div className="grid gap-5">
            <span className="eyebrow" style={{ color: "#C47C52" }}>Sports intelligence</span>
            <h1 className="display text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] font-bold">Read the match before it starts.</h1>
            <p className="text-[17px] leading-7 max-w-[52ch] opacity-90">BETVANTA turns fixtures, form and scoring data into clear predictions with stated confidence and an open track record. Smarter Insights. Better Decisions.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/predictions" className="btn btn-accent btn-lg">See today&apos;s predictions</Link>
              <Link href="/performance" className="btn btn-lg" style={{ border: "1px solid rgba(234,225,212,.5)", color: "#EAE1D4" }}>View our record</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-ink">
            <Stat label="Settled predictions" value={String(won + lost)} foot="Locked at kickoff" />
            <Stat label="Hit rate" value={won + lost ? `${((won / (won + lost)) * 100).toFixed(1)}%` : "n/a"} foot="Settled picks only" />
          </div>
        </div>
      </section>
      <section className="wrap py-12 grid gap-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div><span className="eyebrow">Upcoming</span><h2 className="display text-[22px] font-bold mt-1">Featured fixtures</h2></div>
          <Link href="/predictions" className="text-sm font-semibold text-link hover:underline">All predictions</Link>
        </div>
        {fixtures.length ? <div className="grid gap-4 md:grid-cols-2">{fixtures.map((g) => <FixtureCard key={g[0].fixture_id} preds={g} />)}</div>
          : <Notice tone="info">No predictions are published yet. Check back before the next matchday.</Notice>}
      </section>
      <section className="wrap pb-4 grid gap-4 md:grid-cols-3">
        {[["Data first", "Every pick comes from scoring and conceding records, home and away, with the numbers shown."],
          ["Stated confidence", "Each prediction carries a probability and a confidence band, never a promise."],
          ["Open record", "Picks lock at kickoff and settle against the final score. Nothing is edited afterwards."]].map(([t, d]) => (
          <div key={t} className="card p-6 grid gap-2"><h3 className="font-semibold text-[17px]">{t}</h3><p className="text-sm text-muted">{d}</p></div>))}
      </section>
      <p className="wrap pt-6 text-xs text-subtle">{RG_LINE}</p>
    </>
  );
}
