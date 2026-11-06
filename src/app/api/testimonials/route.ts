import { body, ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { submitTestimonial, testimonialSchema } from "@/lib/services/testimonials";
export const POST = route(async (req: Request) => {
  const u = await requireUser();
  await rateLimit(`testimonial:${u.id}`, 3, 86400);
  await submitTestimonial(u.id, await body(req, testimonialSchema));
  return ok({ message: "Thanks. Your review will appear once our team has checked it." });
});
