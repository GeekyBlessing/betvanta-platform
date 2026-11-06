import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import { resetDb } from "../helpers";
import { one, q, tx } from "@/lib/db";
import { discordAuthorizeUrl, completeDiscordLink, syncDiscordRole, unlinkDiscord, announcePrediction } from "@/lib/services/discord";
import { grantAccess } from "@/lib/services/billing";
import { syncSportsData } from "@/lib/sports/sync";
import { mockProvider } from "@/lib/sports/mock";
import { runEngine } from "@/lib/services/predictions";

const roles = new Set<string>(); const posts: string[] = []; const calls: string[] = [];
let server: http.Server;
beforeAll(async () => {
  server = http.createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      calls.push(`${req.method} ${req.url}`); res.setHeader("content-type", "application/json");
      if (req.url === "/oauth2/token") return res.end(new URLSearchParams(b).get("code") === "good" ? '{"access_token":"at"}' : (res.statusCode = 400, '{"error":"invalid_grant"}'));
      if (req.url === "/users/@me") return res.end('{"id":"d123","username":"ada"}');
      if (req.headers.authorization !== "Bot bot-token" && req.url !== "/webhook") { res.statusCode = 401; return res.end("{}"); }
      const m = req.url!.match(/^\/guilds\/guild1\/members\/d123\/roles\/(.+)$/);
      if (m) { req.method === "PUT" ? roles.add(m[1]) : roles.delete(m[1]); res.statusCode = 204; return res.end(); }
      if (req.url === "/guilds/guild1/members/d123") { res.statusCode = 201; return res.end("{}"); }
      if (req.url === "/webhook") { posts.push(JSON.parse(b).content); res.statusCode = 204; return res.end(); }
      res.statusCode = 404; res.end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(4597, "127.0.0.1", r));
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function member() { return (await one(`insert into users(email, password_hash, display_name, age_confirmed_at, terms_accepted_at, email_verified_at) values ('d@x.com','x','D',now(),now(),now()) returning id`))!.id as string; }

describe("Discord integration", () => {
  beforeEach(async () => { await resetDb(); roles.clear(); posts.length = 0; calls.length = 0; });
  it("links an account only with a valid single-use state and assigns the tier role", async () => {
    const id = await member();
    const url = new URL(await discordAuthorizeUrl(id));
    expect(url.searchParams.get("scope")).toBe("identify guilds.join");
    const state = url.searchParams.get("state")!;
    await expect(completeDiscordLink(id, "good", "forged-state")).rejects.toThrow(/expired/);
    const plan = await one("select id from plans where code = 'vip_monthly'");
    await tx((c) => grantAccess(c, id, plan.id, "admin_grant", null, "test"));
    await completeDiscordLink(id, "good", state);
    expect((await one("select discord_user_id, discord_synced_tier from users where id = $1", [id]))).toEqual({ discord_user_id: "d123", discord_synced_tier: "vip" });
    expect([...roles]).toEqual(["role-vip"]);
    await expect(completeDiscordLink(id, "good", state)).rejects.toThrow(/expired/); // state is single-use
  });
  it("removes the role when access ends and on unlink", async () => {
    const id = await member();
    await q("update users set discord_user_id = 'd123' where id = $1", [id]);
    const plan = await one("select id from plans where code = 'premium_monthly'");
    await tx((c) => grantAccess(c, id, plan.id, "admin_grant", null, "test"));
    await syncDiscordRole(id);
    expect([...roles]).toEqual(["role-premium"]);
    await q("update subscriptions set current_period_end = now() - interval '1 minute' where user_id = $1", [id]);
    await syncDiscordRole(id);
    expect(roles.size).toBe(0);
    await unlinkDiscord(id);
    expect((await one("select discord_user_id from users where id = $1", [id])).discord_user_id).toBeNull();
  });
  it("announces free picks with the selection but never reveals premium selections", async () => {
    await syncSportsData(mockProvider); await runEngine(null, 10);
    const free = await one("select id, selection from predictions where access_tier = 'free' limit 1");
    const vip = await one("select id, selection from predictions where access_tier = 'vip' limit 1");
    await announcePrediction(free.id); await announcePrediction(vip.id);
    expect(posts[0]).toContain(free.selection);
    expect(posts[0]).toContain("[sample data]");
    expect(posts[1]).not.toContain(vip.selection);
    expect(posts[1]).toContain("VIP pick");
  });
});
