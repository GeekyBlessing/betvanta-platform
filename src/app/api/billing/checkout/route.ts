import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { startCheckout } from "@/lib/services/billing";
import { rateLimit } from "@/lib/rate-limit";
export const POST = route(async (req: Request) => {
  const u = await requireUser();
  await rateLimit(`checkout:${u.id}`, 10, 3600);
  const { planCode } = await body(req, z.object({ planCode: z.string().regex(/^[a-z_]{3,40}$/) }));
  const r = await startCheckout(u, planCode);
  return ok({ next: r.authorizationUrl, reference: r.reference });
});
