import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { emailSchema } from "@/lib/services/validation";
import { requestPasswordReset } from "@/lib/services/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/session";
export const POST = route(async (req: Request) => {
  const { email } = await body(req, z.object({ email: emailSchema }));
  await rateLimit(`forgot-ip:${(await clientIp())}`, 10, 3600);
  await rateLimit(`forgot:${email}`, 3, 3600);
  await requestPasswordReset(email);
  return ok({ message: "If an account exists for that email, a reset link is on its way." });
});
