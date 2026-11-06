import { body, ok, route } from "@/lib/http";
import { loginSchema } from "@/lib/services/validation";
import { login } from "@/lib/services/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, createSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { headers } from "next/headers";
export const POST = route(async (req: Request) => {
  const ip = await clientIp();
  const input = await body(req, loginSchema);
  await rateLimit(`login-ip:${ip}`, 20, 600);
  await rateLimit(`login-email:${input.email}`, 8, 600);
  const id = await login(input.email, input.password);
  await createSession(id, ip, (await headers()).get("user-agent"));
  await audit(id, "user.login", "user", id, {}, ip);
  return ok({ next: "/dashboard" });
});
