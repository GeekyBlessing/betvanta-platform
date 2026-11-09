import { z } from "zod";
import { one, q } from "../db";
import { audit } from "../audit";
import { badRequest } from "../errors";
import { tierFor } from "./entitlements";
import { tableExists } from "../schema";
import { emailSchema } from "./validation";

/**
 * "Premium Updates": a member links their email to premium update emails by entering the email on their BETVANTA
 * account and their membership code (the payment reference from their confirmation email or account page).
 * It only switches on for an account with an active paid package; the answer never says which part did not match.
 */
export const premiumUpdatesSchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(4, "Enter your membership code.").max(64).regex(/^[A-Za-z0-9_-]+$/, "Membership codes contain only letters, numbers and dashes."),
});
const NO_MATCH = "We could not match that email and membership code to an active premium package. Check both and try again, or contact support.";

/** The membership code shown to a member: the reference of the payment that activated their current package. */
export async function membershipCode(userId: string): Promise<string | null> {
  const manual = (await tableExists("public.manual_payments"))
    ? await one<{ reference: string }>("select reference from manual_payments where user_id = $1 and status = 'approved' order by reviewed_at desc nulls last limit 1", [userId]) : null;
  const paid = await one<{ reference: string; created_at: string }>("select reference, created_at from payments where user_id = $1 and status = 'success' order by created_at desc limit 1", [userId]);
  return manual?.reference ?? paid?.reference ?? null;
}

export async function linkPremiumUpdates(input: z.infer<typeof premiumUpdatesSchema>) {
  const user = await one<{ id: string; role: string }>("select id, role from users where lower(email) = lower($1) and status = 'active'", [input.email]);
  if (!user) throw badRequest(NO_MATCH);
  const code = input.code.trim();
  const manual = (await tableExists("public.manual_payments"))
    ? await one("select 1 from manual_payments where user_id = $1 and status = 'approved' and lower(reference) = lower($2)", [user.id, code]) : null;
  const paid = await one("select 1 from payments where user_id = $1 and status = 'success' and lower(reference) = lower($2)", [user.id, code]);
  if (!manual && !paid) throw badRequest(NO_MATCH);
  if ((await tierFor(user)) === "free") throw badRequest(NO_MATCH);
  await q("update users set notify_predictions = true, updated_at = now() where id = $1", [user.id]);
  await audit(user.id, "member.premium_updates_linked", "user", user.id, {});
  return { message: "Linked. Premium updates will be emailed to this address. You can switch them off in Notifications." };
}
