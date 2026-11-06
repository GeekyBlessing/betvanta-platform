import { z } from "zod";
import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { verifyAndActivate } from "@/lib/services/billing";
import { audit } from "@/lib/audit";
export const POST = route(async (_req: Request, { params }: { params: Promise<{ reference: string }> }) => {
  const admin = await requireRole("admin");
  const ref = z.string().regex(/^BV-[A-Z0-9-]+$/).parse((await params).reference);
  const r = await verifyAndActivate(ref, "admin");
  await audit(admin.id, "admin.reverify_payment", "payment", ref, { outcome: r.outcome });
  return ok({ message: `Re-verified with the provider: ${r.outcome.replace("_", " ")}.` });
});
