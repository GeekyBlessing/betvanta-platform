import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { settleFinished } from "@/lib/services/predictions";
export const POST = route(async () => {
  const u = await requireRole("admin", "analyst");
  const r = await settleFinished(u.id);
  return ok({ message: `Settled ${r.settled} predictions.` });
});
