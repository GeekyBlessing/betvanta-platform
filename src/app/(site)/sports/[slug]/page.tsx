import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { tierFor } from "@/lib/services/entitlements";
import { listPredictions } from "@/lib/services/predictions";
import { listCompetitions, listFixtures, sportBySlug, SPORTS } from "@/lib/services/sports";
import { FixtureCard, groupByFixture } from "@/components/PredictionCard";
import { FixtureList } from "@/components/FixtureList";
import { SportIcon } from "@/components/SportIcon";
import { Notice, RG_LINE, SampleBadge } from "@/components/ui";
export const dynamic = "force-dynamic";
export async function generateStaticParams() { return SPORTS.map((s) => ({ slug: s.slug })); }
export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const s = sportBySlug((await props.params).slug);
  return s ? { title: `${s.name} analysis and predictions`, description: `BETVANTA ${s.name.toLowerCase()} coverage: ${s.blurb.toLowerCase()}.` } : {};
}
export default async function Sport(props: { params: Promise<{ slug: string }> }) {
  const sport = sportBySlug((await props.params).slug);
  if (!sport) notFound();
  const user = await currentUser();
  const comps = await listCompetitions(user?.id ?? null, sport.id);
  const ids = comps.map((c) => c.id);
  const [upcoming, results, preds] = await Promise.all([
    ids.length ? listFixtures({ mode: "upcoming", competitionIds: ids, limit: 30 }) : Promise.resolve([]),
    ids.length ? listFixtures({ mode: "results", competitionIds: ids, limit: 12 }) : Promise.resolve([]),
    sport.predictions ? listPredictions(await tierFor(user), { upcoming: true, limit: 60 }) : Promise.resolve([]),
  ]);
  const names = new Set(comps.map((c) => c.name));
  const groups = groupByFixture(preds.filter((p) => names.has(p.competition))).slice(0, 6);
  const sample = comps.some((c) => c.data_source === "mock");
  return (
    <div className="wrap py-10 grid gap-10">
      <header className="flex flex-wrap items-center gap-4">
        <span className="h-16 w-16 rounded-full bg-brand text-[#EAE1D4] grid place-items-center"><SportIcon sport={sport.id} size={32} /></span>
        <div className="grid gap-1"><span className="eyebrow">Sport</span><h1 className="display text-[28px] leading-[34px] md:text-[36px] md:leading-[40px] font-bold">{sport.name}</h1></div>
        {sample && <span className="ml-auto"><SampleBadge /></span>}
      </header>
      <nav aria-label="Other sports" className="flex flex-wrap gap-2 -mt-6">{SPORTS.map((s) => <Link key={s.id} href={`/sports/${s.slug}`} aria-current={s.id === sport.id ? "page" : undefined} className={`btn btn-sm ${s.id === sport.id ? "btn-primary" : "btn-secondary"}`}>{s.name}</Link>)}</nav>
      {!comps.length && <Notice tone="info" title={`${sport.name} coverage is on the way.`}>We are connecting a licensed data feed for {sport.name.toLowerCase()}. Schedules and scores appear here as soon as it is live.</Notice>}

      {sport.predictions ? (
        <section className="grid gap-4"><div className="flex justify-between items-end gap-3 flex-wrap"><h2 className="font-semibold text-[20px]">Predictions and analysis</h2><Link href="/predictions" className="text-sm font-semibold text-link hover:underline">All predictions</Link></div>
          {groups.length ? <div className="grid gap-4 md:grid-cols-2">{groups.map((g) => <FixtureCard key={g[0].fixture_id} preds={g} />)}</div> : <Notice>No {sport.name.toLowerCase()} predictions are published right now.</Notice>}
        </section>
      ) : comps.length > 0 && (
        <Notice tone="info" title="Predictions for this sport are not live yet.">Our prediction model is built for soccer scoring. {sport.name} picks will launch once a sport-specific model has been tested; schedules, scores and records are available now.</Notice>
      )}

      {comps.length > 0 && (<>
        <section className="grid gap-3"><h2 className="font-semibold text-[20px]">Leagues</h2>
          <div className="flex flex-wrap gap-2">{comps.map((c) => <Link key={c.id} href={`/leagues/${c.id}`} className="btn btn-secondary btn-sm">{c.name}</Link>)}</div></section>
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="grid gap-3 content-start"><h2 className="font-semibold text-[20px]">Upcoming</h2>{upcoming.length ? <FixtureList rows={upcoming} /> : <Notice>No upcoming games.</Notice>}</section>
          <section className="grid gap-3 content-start"><h2 className="font-semibold text-[20px]">Latest scores</h2>{results.length ? <FixtureList rows={results} /> : <Notice>No results yet.</Notice>}</section>
        </div>
      </>)}
      <p className="text-xs text-subtle">{RG_LINE}</p>
    </div>
  );
}
