import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { audit } from "@/lib/audit";
import { badRequest, notFound } from "@/lib/errors";
import { clientIp } from "@/lib/session";
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireRole("admin");
  const id = z.string().uuid().parse((await params).id);
  const b = await body(req, z.object({ role: z.enum(["member", "analyst", "admin"]).optional(), status: z.enum(["active", "suspended"]).optional() }));
  if (id === admin.id) throw badRequest("You cannot change your own role or status.");
  const before = await one("select role, status from users where id = $1", [id]);
  if (!before) throw notFound("User not found.");
  await q("update users set role = coalesce($2, role), status = coalesce($3, status), updated_at = now() where id = $1", [id, b.role ?? null, b.status ?? null]);
  if (b.status === "suspended") await q("delete from sessions where user_id = $1", [id]);
  await audit(admin.id, "admin.update_user", "user", id, { before, after: b }, (await clientIp()));
  return ok({ message: "User updated." });
});
