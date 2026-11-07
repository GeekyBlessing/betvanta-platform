import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, lastEmailLink } from "../helpers";
import * as auth from "@/lib/services/auth";
import { registerSchema } from "@/lib/services/validation";
import { one, q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const input = (email = "ada@example.com") => registerSchema.parse({ displayName: "Ada", email, password: "correct horse battery", confirmAge: true, acceptTerms: true });

describe("authentication", () => {
  beforeEach(resetDb);
  it("registers with a hashed password and sends a verification email", async () => {
    const id = await auth.register(input(), "1.1.1.1");
    const u = await one("select * from users where id = $1", [id]);
    expect(u.password_hash).toMatch(/^scrypt\$/);
    expect(u.password_hash).not.toContain("correct horse");
    expect(u.role).toBe("member");
    expect(u.email_verified_at).toBeNull();
    expect(await lastEmailLink("ada@example.com")).toBeTruthy();
  });
  it("rejects duplicate emails and weak input", async () => {
    await auth.register(input(), null);
    await expect(auth.register(input("ADA@example.com".toLowerCase()), null)).rejects.toThrow(/already exists/);
    expect(() => registerSchema.parse({ displayName: "A", email: "x", password: "short", confirmAge: false, acceptTerms: true })).toThrow();
  });
  it("grants admin only to configured admin emails, and only after the email is verified", async () => {
    const id = await auth.register(input("admin@betvanta.test"), null);
    expect((await one("select role from users where id = $1", [id])).role).toBe("member");
    await auth.login("admin@betvanta.test", input("admin@betvanta.test").password).catch(() => null);
    expect((await one("select role from users where id = $1", [id])).role).toBe("member");
    const tok = await lastEmailLink("admin@betvanta.test");
    await auth.verifyEmail(tok!);
    expect((await one("select role from users where id = $1", [id])).role).toBe("admin");
    const other = await auth.register(input("someone@betvanta.test"), null);
    await auth.verifyEmail((await lastEmailLink("someone@betvanta.test"))!);
    expect((await one("select role from users where id = $1", [other])).role).toBe("member");
  });
  it("verifies email once with a valid token", async () => {
    const id = await auth.register(input(), null);
    const token = (await lastEmailLink("ada@example.com"))!;
    expect(await auth.verifyEmail(token)).toBe(id);
    expect((await one("select email_verified_at from users where id = $1", [id])).email_verified_at).not.toBeNull();
    await expect(auth.verifyEmail(token)).rejects.toThrow(/invalid or has expired/);
  });
  it("logs in with the right password only and blocks suspended users", async () => {
    const id = await auth.register(input(), null);
    expect(await auth.login("ada@example.com", "correct horse battery")).toBe(id);
    await expect(auth.login("ada@example.com", "wrong password!!")).rejects.toThrow(/incorrect/);
    await expect(auth.login("nobody@example.com", "whatever12345")).rejects.toThrow(/incorrect/);
    await q("update users set status = 'suspended' where id = $1", [id]);
    await expect(auth.login("ada@example.com", "correct horse battery")).rejects.toThrow(/suspended/);
  });
  it("resets a password with a single-use token and revokes sessions", async () => {
    const id = await auth.register(input(), null);
    await q("insert into sessions(id, user_id, expires_at) values ('s1', $1, now() + interval '1 day')", [id]);
    await auth.requestPasswordReset("ada@example.com");
    const token = (await lastEmailLink("ada@example.com"))!;
    await auth.resetPassword(token, "a brand new passphrase");
    expect(await auth.login("ada@example.com", "a brand new passphrase")).toBe(id);
    expect((await q("select * from sessions where user_id = $1", [id])).length).toBe(0);
    await expect(auth.resetPassword(token, "another passphrase!")).rejects.toThrow(/invalid or has expired/);
  });
  it("does not reveal whether an email exists on reset", async () => {
    await expect(auth.requestPasswordReset("ghost@example.com")).resolves.toBeUndefined();
    expect((await q("select * from email_outbox")).length).toBe(0);
  });
  it("rate limits after the configured number of attempts", async () => {
    for (let i = 0; i < 5; i++) await rateLimit("login:test", 5, 60);
    await expect(rateLimit("login:test", 5, 60)).rejects.toThrow(/Too many/);
  });
  it("keeps audit logs append-only", async () => {
    await auth.register(input(), null);
    await expect(q("update audit_logs set action = 'x'")).rejects.toThrow(/append-only/);
    await expect(q("delete from audit_logs")).rejects.toThrow(/append-only/);
  });
});
afterAll(async () => {});
