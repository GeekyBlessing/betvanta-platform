import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { runEngine } from "@/lib/services/predictions";
export const maxDuration = 60;
export const POST = route(async () => {
  const u = await requireRole("admin", "analyst");
  const r = await runEngine(u.id, 10);
  return ok({ message: `Engine checked ${r.fixtures} fixtures: ${r.created} new drafts, ${r.skipped} skipped for too little data.` });
});
