import type { Metadata } from "next";
import { pageUser } from "@/lib/auth";
import { tierFor } from "@/lib/services/entitlements";
import { listPredictions } from "@/lib/services/predictions";
import { FixtureCard, groupByFixture } from "@/components/PredictionCard";
import { Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Predictions" };
export default async function DashPredictions() {
  const u = await pageUser("/dashboard/predictions");
  const tier = await tierFor(u);
  const groups = groupByFixture(await listPredictions(tier, { upcoming: true, limit: 300 }));
  return (<><PageHeader eyebrow="Predictions" title="Upcoming predictions">Showing everything published. Locked markets need a higher plan.</PageHeader>
    {groups.length ? <div className="grid gap-4 xl:grid-cols-2">{groups.map((g) => <FixtureCard key={g[0].fixture_id} preds={g} />)}</div> : <Notice>Nothing published yet.</Notice>}</>);
}
