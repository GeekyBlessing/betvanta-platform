import { ok, route } from "@/lib/http";
import { currentUser } from "@/lib/session";
import { tierFor } from "@/lib/services/entitlements";
import { listPredictions } from "@/lib/services/predictions";
export const dynamic = "force-dynamic";
export const GET = route(async (req: Request) => {
  const u = await currentUser();
  const tier = await tierFor(u);
  const settled = new URL(req.url).searchParams.get("settled") === "1";
  return ok({ tier, predictions: await listPredictions(tier, settled ? { settled: true } : { upcoming: true }) });
});
