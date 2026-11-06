import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { passwordSchema } from "@/lib/services/validation";
import { changePassword } from "@/lib/services/auth";
import { currentToken, destroyAllSessions } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
export const POST = route(async (req: Request) => {
  const u = await requireUser();
  await rateLimit(`pw-change:${u.id}`, 5, 3600);
  const b = await body(req, z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema }));
  await changePassword(u.id, b.currentPassword, b.newPassword);
  await destroyAllSessions(u.id, await currentToken());
  return ok({ message: "Password changed. Other devices were signed out." });
});
