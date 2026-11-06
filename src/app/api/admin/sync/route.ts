import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { syncSportsData } from "@/lib/sports/sync";
import { audit } from "@/lib/audit";
export const maxDuration = 60;
export const POST = route(async () => {
  const u = await requireRole("admin", "analyst");
  const r = await syncSportsData();
  await audit(u.id, "sports.sync", "fixture", null, r);
  return ok({ message: `Synced ${r.fixtures} fixtures from ${r.source}.` });
});
