import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { one, tx } from "@/lib/db";
import { grantAccess } from "@/lib/services/billing";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { syncDiscordRoleSafe } from "@/lib/services/discord";
/** Admin grants complimentary access (no payment). Always audited with a reason. */
export const POST = route(async (req: Request) => {
  const admin = await requireRole("admin");
  const b = await body(req, z.object({ email: z.string().trim().toLowerCase().email(), planCode: z.string().regex(/^[a-z0-9_]{3,40}$/), days: z.coerce.number().int().min(1).max(366).optional(), note: z.string().trim().min(3, "Give a reason.").max(300) }));
  const u = await one<{ id: string }>("select id from users where email = $1", [b.email]);
  if (!u) throw notFound("No member with that email.");
  const plan = await one<{ id: string }>("select id from plans where code = $1", [b.planCode]);
  if (!plan) throw notFound("Plan not found.");
  const sub = await tx((c) => grantAccess(c, u.id, plan.id, "admin_grant", admin.id, b.note, b.days));
  await audit(admin.id, "admin.grant_access", "subscription", sub.id, { user: b.email, plan: b.planCode, days: b.days, note: b.note });
  await syncDiscordRoleSafe(u.id);
  return ok({ message: sub.isLifetime ? `Granted ${sub.planLabel} for life.` : `Granted ${sub.planLabel} until ${new Date(sub.current_period_end).toDateString()}.` });
});
