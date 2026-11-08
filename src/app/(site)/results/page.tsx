import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { tierFor } from "@/lib/services/entitlements";
import { listFixtures } from "@/lib/services/sports";
import { listPredictions } from "@/lib/services/predictions";
import { dashboardRecord } from "@/lib/services/dashboard";
import { SPORTS } from "@/lib/services/sports";
import { FixtureTable, FormStrip, SectionHead, SettledLine, Empty } from "@/components/dashboard";
import { PageHeader, tzLabel } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Results", description: "Final scores and every graded BETVANTA prediction." };

export default async function Results(props: { searchParams: Promise<{ sport?: string }> }) {
  const sp = await props.searchParams;
  const sport = SPORTS.find((s) => s.slug === sp.sport)?.id;
  const user = await currentUser();
  const [fixtures, picks, record] = await Promise.all([
    listFixtures({ mode: "results", limit: 60, sport }),
    listPredictions(await tierFor(user), { settled: true, limit: 40, sport }),
    dashboardRecord(sport),
  ]);
  const tab = (slug?: string) => `/results${slug ? `?sport=${slug}` : ""}`;
  return (
    <div className="wrap py-8 md:py-10 grid gap-6">
      <PageHeader eyebrow="Results" title="Results and graded picks">Final scores, newest first, in {tzLabel()}. Every published pick is graded against the final score and never edited afterwards.</PageHeader>
      <nav aria-label="Filter by sport" className="sport-tabs -mt-4 flex gap-2 overflow-x-auto">
        <Link href={tab()} aria-current={!sport ? "page" : undefined} className={`btn btn-sm ${!sport ? "btn-primary" : "btn-secondary"}`}>All sports</Link>
        {SPORTS.map((s) => <Link key={s.id} href={tab(s.slug)} aria-current={sport === s.id ? "page" : undefined} className={`btn btn-sm whitespace-nowrap ${sport === s.id ? "btn-primary" : "btn-secondary"}`}>{s.name}</Link>)}
      </nav>
      <div className="grid gap-6 lg:grid-cols-12">
        <section aria-labelledby="scores-h" className="lg:col-span-7">
          <SectionHead id="scores-h" title="Final scores" />
          {fixtures.length ? <FixtureTable rows={fixtures} /> : <Empty>No finished matches yet.</Empty>}
        </section>
        <section aria-labelledby="graded-h" className="lg:col-span-5">
          <SectionHead id="graded-h" title="Graded picks" meta={`${record.won} won, ${record.lost} lost, ${record.voided} void`} href="/performance" linkLabel="Full record" />
          {picks.length ? <div className="card overflow-hidden"><div className="px-4 py-3 border-b border-line"><FormStrip picks={picks.slice(0, 15)} /></div>
            <ul className="divide-y divide-[var(--border)]">{picks.map((p) => <SettledLine key={p.id} p={p} />)}</ul></div>
            : <Empty>No picks have been graded yet.</Empty>}
        </section>
      </div>
    </div>
  );
}
