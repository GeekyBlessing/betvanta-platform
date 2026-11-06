import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/session";
import { emailSchema } from "@/lib/services/validation";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
export const POST = route(async (req: Request) => {
  await rateLimit(`contact:${(await clientIp())}`, 5, 3600);
  const b = await body(req, z.object({ name: z.string().trim().min(2).max(80), email: emailSchema, message: z.string().trim().min(10, "Write at least 10 characters.").max(4000), website: z.string().max(0).optional() }));
  await q("insert into contact_messages(name, email, message) values ($1,$2,$3)", [b.name, b.email, b.message]);
  // Forward to the support inbox; replying goes straight to the customer.
  await sendEmail({ to: env().SUPPORT_EMAIL, replyTo: b.email, template: "support_contact", subject: `BETVANTA contact form: ${b.name}`,
    text: `From: ${b.name} <${b.email}>\n\n${b.message}\n\n--\nSent from the BETVANTA contact form. Reply to this email to answer the customer.` });
  return ok({ message: "Thanks. Our support team will reply by email." });
});
