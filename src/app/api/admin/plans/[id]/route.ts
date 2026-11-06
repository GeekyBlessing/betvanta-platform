import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireRole("admin");
  const id = z.string().uuid().parse((await params).id);
  const b = await body(req, z.object({ amountMajor: z.coerce.number().int().min(100).max(100_000_000), active: z.boolean(), features: z.string().max(1000) }));
  const before = await one("select amount_minor, active, features from plans where id = $1", [id]);
  if (!before) throw notFound("Plan not found.");
  const features = b.features.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10);
  await q("update plans set amount_minor = $2, active = $3, features = $4, updated_at = now() where id = $1", [id, b.amountMajor * 100, b.active, JSON.stringify(features)]);
  await audit(admin.id, "admin.update_plan", "plan", id, { before, after: { amount_minor: b.amountMajor * 100, active: b.active, features } });
  return ok({ message: "Plan saved. New checkouts use the new price." });
});
