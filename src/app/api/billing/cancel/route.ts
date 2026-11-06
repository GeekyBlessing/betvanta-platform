import { ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { cancelSubscription } from "@/lib/services/billing";
export const POST = route(async () => {
  const u = await requireUser();
  const r = await cancelSubscription(u.id);
  return ok({ message: `Cancelled. You keep access until ${new Date(r.until).toDateString()}.` });
});
