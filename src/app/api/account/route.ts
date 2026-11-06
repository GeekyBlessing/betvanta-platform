import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { nameSchema, passwordSchema } from "@/lib/services/validation";
import { audit } from "@/lib/audit";
import { verifyPassword, hashPassword, randomToken } from "@/lib/crypto";
import { badRequest } from "@/lib/errors";
import { destroySession } from "@/lib/session";
import { one } from "@/lib/db";

export const PATCH = route(async (req: Request) => {
  const u = await requireUser();
  const b = await body(req, z.object({ displayName: nameSchema, notifyPredictions: z.boolean(), notifyBilling: z.boolean() }));
  await q("update users set display_name = $2, notify_predictions = $3, notify_billing = $4, updated_at = now() where id = $1", [u.id, b.displayName, b.notifyPredictions, b.notifyBilling]);
  await audit(u.id, "user.update_profile", "user", u.id, { notifyPredictions: b.notifyPredictions, notifyBilling: b.notifyBilling });
  return ok({ message: "Settings saved." });
});

/** Account deletion: personal data is anonymised; payment records are kept for accounting, without personal details. */
export const DELETE = route(async (req: Request) => {
  const u = await requireUser();
  const b = await body(req, z.object({ password: z.string().min(1).max(200), confirm: z.literal("DELETE") }));
  const row = await one<{ password_hash: string }>("select password_hash from users where id = $1", [u.id]);
  if (!row || !(await verifyPassword(b.password, row.password_hash))) throw badRequest("Your password is incorrect.");
  await q(`update users set email = 'deleted-' || id || '@deleted.invalid', display_name = 'Deleted user', password_hash = $2, status = 'suspended',
           notify_predictions = false, notify_billing = false, updated_at = now() where id = $1`, [u.id, await hashPassword(randomToken())]);
  await q("update subscriptions set status = 'expired', current_period_end = least(current_period_end, now()) where user_id = $1", [u.id]);
  await q("delete from sessions where user_id = $1", [u.id]);
  await audit(u.id, "user.delete_account", "user", u.id);
  await destroySession();
  return ok({ next: "/" });
});
void passwordSchema;
