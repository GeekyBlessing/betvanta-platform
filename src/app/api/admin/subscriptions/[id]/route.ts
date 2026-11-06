import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { one } from "@/lib/db";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";
import { syncDiscordRoleSafe } from "@/lib/services/discord";
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireRole("admin");
  const id = z.string().uuid().parse((await params).id);
  const b = await body(req, z.discriminatedUnion("action", [
    z.object({ action: z.literal("extend"), days: z.coerce.number().int().min(1).max(366) }),
    z.object({ action: z.literal("revoke") }),
  ]));
  const row = b.action === "extend"
    ? await one<{ user_id: string }>("update subscriptions set current_period_end = greatest(current_period_end, now()) + ($2 || ' days')::interval, status = 'active', updated_at = now() where id = $1 and status <> 'expired' returning user_id", [id, String(b.days)])
    : await one<{ user_id: string }>("update subscriptions set status = 'expired', current_period_end = least(current_period_end, now()), updated_at = now() where id = $1 and status <> 'expired' returning user_id", [id]);
  if (!row) throw badRequest("That subscription is already expired.");
  await audit(admin.id, `admin.subscription_${b.action}`, "subscription", id, b);
  await syncDiscordRoleSafe(row.user_id);
  return ok({ message: b.action === "extend" ? `Extended by ${b.days} days.` : "Access revoked." });
});
