import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { startCheckout } from "@/lib/services/billing";
import { rateLimit } from "@/lib/rate-limit";
export const POST = route(async (req: Request) => {
  const u = await requireUser();
  await rateLimit(`checkout:${u.id}`, 10, 3600);
  const b = await body(req, z.object({ planCode: z.string().regex(/^[a-z0-9_]{3,40}$/), provider: z.enum(["stripe", "paystack", "nowpayments"]), payCurrency: z.enum(["BTC", "ETH", "USDT"]).optional() }));
  const r = await startCheckout(u, b.planCode, b.provider, b.payCurrency);
  return ok({ next: r.authorizationUrl, reference: r.reference });
});
