import { body, ok, route } from "@/lib/http";
import { registerSchema } from "@/lib/services/validation";
import { register } from "@/lib/services/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, createSession } from "@/lib/session";
import { headers } from "next/headers";
export const POST = route(async (req: Request) => {
  const ip = await clientIp();
  await rateLimit(`register:${ip}`, 5, 3600);
  const input = await body(req, registerSchema);
  const id = await register(input, ip);
  await createSession(id, ip, (await headers()).get("user-agent"));
  return ok({ next: "/dashboard" }, 201);
});
