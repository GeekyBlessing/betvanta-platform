import { currentUser, type SessionUser } from "./session";
import { forbidden, unauthorized } from "./errors";
import { redirect } from "next/navigation";

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw unauthorized();
  return u;
}
export async function requireRole(...roles: SessionUser["role"][]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw forbidden();
  return u;
}
/** For server-rendered pages: redirect instead of throwing. */
export async function pageUser(next: string): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}
export async function pageRole(next: string, ...roles: SessionUser["role"][]): Promise<SessionUser> {
  const u = await pageUser(next);
  if (!roles.includes(u.role)) redirect("/dashboard");
  return u;
}
