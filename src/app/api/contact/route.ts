import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/session";
import { emailSchema } from "@/lib/services/validation";
export const POST = route(async (req: Request) => {
  await rateLimit(`contact:${(await clientIp())}`, 5, 3600);
  const b = await body(req, z.object({ name: z.string().trim().min(2).max(80), email: emailSchema, message: z.string().trim().min(10, "Write at least 10 characters.").max(4000), website: z.string().max(0).optional() }));
  await q("insert into contact_messages(name, email, message) values ($1,$2,$3)", [b.name, b.email, b.message]);
  return ok({ message: "Thanks. We'll reply by email." });
});
