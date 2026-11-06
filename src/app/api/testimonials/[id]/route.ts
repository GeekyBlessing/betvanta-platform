import { z } from "zod";
import { ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { withdrawTestimonial } from "@/lib/services/testimonials";
export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  await withdrawTestimonial(u.id, z.string().uuid().parse((await params).id));
  return ok({ message: "Review withdrawn. It is no longer shown anywhere." });
});
