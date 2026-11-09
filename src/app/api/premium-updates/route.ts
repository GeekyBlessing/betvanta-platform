import { body, ok, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/session";
import { linkPremiumUpdates, premiumUpdatesSchema } from "@/lib/services/premium-updates";
export const POST = route(async (req: Request) => {
  await rateLimit(`premium-updates:${await clientIp()}`, 8, 3600);
  return ok(await linkPremiumUpdates(await body(req, premiumUpdatesSchema)));
});
