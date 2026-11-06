import { ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { sendVerification } from "@/lib/services/auth";
export const POST = route(async () => {
  const u = await requireUser();
  await rateLimit(`verify-resend:${u.id}`, 3, 3600);
  await sendVerification(u.id);
  return ok({ message: "Verification email sent." });
});
