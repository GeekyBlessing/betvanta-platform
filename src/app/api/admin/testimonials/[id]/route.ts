import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { moderateTestimonial } from "@/lib/services/testimonials";
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireRole("admin");
  const { action } = await body(req, z.object({ action: z.enum(["approve", "reject"]) }));
  await moderateTestimonial(admin.id, z.string().uuid().parse((await params).id), action);
  return ok({ message: action === "approve" ? "Approved. It now shows on the homepage." : "Rejected." });
});
