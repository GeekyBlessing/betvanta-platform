import { cookies, headers } from "next/headers";
import { one, q } from "./db";
import { randomToken, sha256 } from "./crypto";
import { env, isProd } from "./env";

export const SESSION_COOKIE = isProd() ? "__Host-bv_session" : "bv_session";

export type SessionUser = {
  id: string; email: string; display_name: string; role: "member" | "analyst" | "admin";
  status: string; email_verified_at: string | null; notify_predictions: boolean; notify_billing: boolean;
};

export async function createSession(userId: string, ip: string | null, ua: string | null) {
  const token = randomToken(32);
  const days = env().SESSION_TTL_DAYS;
  await q("insert into sessions(id, user_id, expires_at, ip, user_agent) values ($1,$2, now() + ($3 || ' days')::interval, $4, $5)",
    [sha256(token), userId, String(days), ip, ua?.slice(0, 300) ?? null]);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: isProd(), sameSite: "lax", path: "/", maxAge: days * 86400 });
  return token;
}

export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const u = await one<SessionUser>(
    `update sessions s set last_seen_at = now() from users u
     where s.id = $1 and s.expires_at > now() and u.id = s.user_id and u.status = 'active'
     returning u.id, u.email, u.display_name, u.role, u.status, u.email_verified_at, u.notify_predictions, u.notify_billing`, [sha256(token)]);
  return u;
}

export async function currentUser(): Promise<SessionUser | null> {
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) await q("delete from sessions where id = $1", [sha256(t)]);
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string, exceptToken?: string) {
  await q("delete from sessions where user_id = $1 and ($2::text is null or id <> $2)", [userId, exceptToken ? sha256(exceptToken) : null]);
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}
export const currentToken = async () => (await cookies()).get(SESSION_COOKIE)?.value;
