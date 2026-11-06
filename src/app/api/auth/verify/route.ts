import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { verifyEmail } from "@/lib/services/auth";
import { tokenSchema } from "@/lib/services/validation";
export const POST = route(async (req: Request) => {
  const { token } = await body(req, z.object({ token: tokenSchema }));
  await verifyEmail(token);
  return ok({ next: "/dashboard" });
});
