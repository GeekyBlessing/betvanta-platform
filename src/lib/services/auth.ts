import { one, q, tx } from "../db";
import { DUMMY_HASH, hashPassword, randomToken, sha256, verifyPassword } from "../crypto";
import { conflict, badRequest, unauthorized } from "../errors";
import { adminEmails, env } from "../env";
import { sendEmail, templates } from "../email";
import { audit } from "../audit";
import { support } from "../support";
import type { z } from "zod";
import type { registerSchema } from "./validation";

async function issueToken(userId: string, purpose: "verify_email" | "reset_password", ttlMinutes: number) {
  const token = randomToken(32);
  await q("update auth_tokens set used_at = now() where user_id = $1 and purpose = $2 and used_at is null", [userId, purpose]);
  await q("insert into auth_tokens(user_id, purpose, token_hash, expires_at) values ($1,$2,$3, now() + ($4 || ' minutes')::interval)",
    [userId, purpose, sha256(token), String(ttlMinutes)]);
  return token;
}

export async function register(input: z.infer<typeof registerSchema>, ip: string | null) {
  const exists = await one("select 1 from users where email = $1", [input.email]);
  if (exists) throw conflict("An account with this email already exists. Log in or reset your password.");
  const hash = await hashPassword(input.password);
  const role = adminEmails().includes(input.email) ? "admin" : "member";
  const user = await one<{ id: string }>(
    `insert into users(email, password_hash, display_name, role, age_confirmed_at, terms_accepted_at)
     values ($1,$2,$3,$4, now(), now()) returning id`, [input.email, hash, input.displayName, role]);
  await audit(user!.id, "user.register", "user", user!.id, { role }, ip);
  await sendVerification(user!.id);
  return user!.id;
}

export async function sendVerification(userId: string) {
  const u = await one<{ email: string; display_name: string; email_verified_at: string | null }>("select email, display_name, email_verified_at from users where id = $1", [userId]);
  if (!u || u.email_verified_at) return;
  const token = await issueToken(userId, "verify_email", 24 * 60);
  await sendEmail({ to: u.email, ...templates.verify(u.display_name, `${env().APP_URL}/verify-email?token=${token}`) });
}

export async function verifyEmail(token: string) {
  return tx(async (c) => {
    const t = await one<{ id: string; user_id: string }>(
      "select id, user_id from auth_tokens where token_hash = $1 and purpose = 'verify_email' and used_at is null and expires_at > now() for update", [sha256(token)], c);
    if (!t) throw badRequest("This verification link is invalid or has expired. Request a new one from your dashboard.");
    await q("update auth_tokens set used_at = now() where id = $1", [t.id], c);
    await q("update users set email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = $1", [t.user_id], c);
    await audit(t.user_id, "user.verify_email", "user", t.user_id, {}, null, c);
    return t.user_id;
  });
}

export async function login(email: string, password: string) {
  const u = await one<{ id: string; password_hash: string; status: string }>("select id, password_hash, status from users where email = $1", [email]);
  const valid = await verifyPassword(password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !valid) throw unauthorized("Email or password is incorrect.");
  if (u.status !== "active") throw unauthorized(`This account is suspended. Contact support at ${support().email}.`);
  return u.id;
}

export async function requestPasswordReset(email: string) {
  const u = await one<{ id: string; display_name: string; status: string }>("select id, display_name, status from users where email = $1", [email]);
  if (!u || u.status !== "active") return; // same response either way: no account enumeration
  const token = await issueToken(u.id, "reset_password", 60);
  await sendEmail({ to: email, ...templates.reset(u.display_name, `${env().APP_URL}/reset-password?token=${token}`) });
}

export async function resetPassword(token: string, newPassword: string) {
  const hash = await hashPassword(newPassword);
  const userId = await tx(async (c) => {
    const t = await one<{ id: string; user_id: string }>(
      "select id, user_id from auth_tokens where token_hash = $1 and purpose = 'reset_password' and used_at is null and expires_at > now() for update", [sha256(token)], c);
    if (!t) throw badRequest("This reset link is invalid or has expired. Request a new one.");
    await q("update auth_tokens set used_at = now() where id = $1", [t.id], c);
    await q("update users set password_hash = $2, updated_at = now() where id = $1", [t.user_id, hash], c);
    await q("delete from sessions where user_id = $1", [t.user_id], c);
    await audit(t.user_id, "user.reset_password", "user", t.user_id, {}, null, c);
    return t.user_id;
  });
  const u = await one<{ email: string; display_name: string }>("select email, display_name from users where id = $1", [userId]);
  if (u) await sendEmail({ to: u.email, ...templates.passwordChanged(u.display_name) });
  return userId;
}

export async function changePassword(userId: string, current: string, next: string) {
  const u = await one<{ password_hash: string; email: string; display_name: string }>("select password_hash, email, display_name from users where id = $1", [userId]);
  if (!u || !(await verifyPassword(current, u.password_hash))) throw badRequest("Your current password is incorrect.");
  await q("update users set password_hash = $2, updated_at = now() where id = $1", [userId, await hashPassword(next)]);
  await audit(userId, "user.change_password", "user", userId);
  await sendEmail({ to: u.email, ...templates.passwordChanged(u.display_name) });
}
