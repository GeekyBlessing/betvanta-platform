import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireRole("admin");
  const id = z.string().uuid().parse((await params).id);
  const b = await body(req, z.object({ amountUsd: z.coerce.number().min(1).max(10_000), active: z.boolean(), tagline: z.string().trim().max(80).optional() }));
  const before = await one("select amount_minor, active, tagline from plans where id = $1", [id]);
  if (!before) throw notFound("Plan not found.");
  const after = { amount_minor: Math.round(b.amountUsd * 100), active: b.active, tagline: b.tagline ?? null };
  await q("update plans set amount_minor = $2, active = $3, tagline = $4, updated_at = now() where id = $1", [id, after.amount_minor, after.active, after.tagline]);
  await audit(admin.id, "admin.update_plan", "plan", id, { before, after });
  return ok({ message: "Plan saved. New checkouts use the new price." });
});
