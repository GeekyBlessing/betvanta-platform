import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { passwordSchema, tokenSchema } from "@/lib/services/validation";
import { resetPassword } from "@/lib/services/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/session";
export const POST = route(async (req: Request) => {
  await rateLimit(`reset-ip:${(await clientIp())}`, 10, 3600);
  const { token, password } = await body(req, z.object({ token: tokenSchema, password: passwordSchema }));
  await resetPassword(token, password);
  return ok({ next: "/login?reset=1" });
});
