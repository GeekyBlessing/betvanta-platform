import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { runSubscriptionMaintenance } from "@/lib/services/billing";
import { audit } from "@/lib/audit";
export const POST = route(async () => {
  const u = await requireRole("admin");
  const r = await runSubscriptionMaintenance();
  await audit(u.id, "billing.maintenance", "subscription", null, r);
  return ok({ message: `Expired ${r.expired} subscriptions, sent ${r.reminded} reminders.` });
});
