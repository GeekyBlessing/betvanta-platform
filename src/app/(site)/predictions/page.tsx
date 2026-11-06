import type { Metadata } from "next";
import { currentUser } from "@/lib/session";
import { tierFor } from "@/lib/services/entitlements";
import { listPredictions } from "@/lib/services/predictions";
import { FixtureCard, groupByFixture } from "@/components/PredictionCard";
import { Notice, PageHeader, RG_LINE } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Predictions", description: "Upcoming BETVANTA match predictions with probabilities and confidence bands." };
export default async function Predictions() {
  const tier = await tierFor(await currentUser());
  const groups = groupByFixture(await listPredictions(tier, { upcoming: true, limit: 300 }));
  return (
    <div className="wrap py-10">
      <PageHeader eyebrow="Predictions" title="Upcoming predictions">Your access: <strong className="capitalize">{tier}</strong>. Premium and VIP picks unlock with a plan.</PageHeader>
      {groups.some((g) => g[0].data_source === "mock") && <div className="mb-6"><Notice tone="warning" title="Sample data.">These fixtures come from BETVANTA&apos;s labelled sample league, not a live data feed.</Notice></div>}
      {groups.length ? <div className="grid gap-4 md:grid-cols-2">{groups.map((g) => <FixtureCard key={g[0].fixture_id} preds={g} />)}</div> : <Notice>No upcoming predictions are published right now.</Notice>}
      <p className="mt-8 text-xs text-subtle">{RG_LINE}</p>
    </div>
  );
}
