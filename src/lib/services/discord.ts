import { env, discordOAuthEnabled } from "../env";
import { one, q } from "../db";
import { randomToken, sha256 } from "../crypto";
import { badRequest, conflict, unavailable } from "../errors";
import { audit } from "../audit";
import { tierFor, type Tier } from "./entitlements";

const api = (path: string) => env().DISCORD_API_BASE + path;
const redirectUri = () => `${env().APP_URL}/api/discord/callback`;
const bot = () => ({ Authorization: `Bot ${env().DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" });
const roleFor = (t: Tier) => (t === "vip" ? env().DISCORD_VIP_ROLE_ID : t === "premium" ? env().DISCORD_PREMIUM_ROLE_ID : undefined);

/** Step 1: a short-lived, single-use state token bound to the signed-in user (CSRF protection for OAuth). */
export async function discordAuthorizeUrl(userId: string) {
  if (!discordOAuthEnabled()) throw unavailable("Discord linking is not configured yet.");
  const state = randomToken(24);
  await q("insert into auth_tokens(user_id, purpose, token_hash, expires_at) values ($1, 'discord_state', $2, now() + interval '10 minutes')", [userId, sha256(state)]);
  const p = new URLSearchParams({ client_id: env().DISCORD_CLIENT_ID!, redirect_uri: redirectUri(), response_type: "code", scope: "identify guilds.join", state, prompt: "consent" });
  return `https://discord.com/oauth2/authorize?${p}`;
}

/** Step 2: verify state, exchange the code, join the guild, assign the tier role. */
export async function completeDiscordLink(userId: string, code: string, state: string) {
  const t = await one("update auth_tokens set used_at = now() where token_hash = $1 and purpose = 'discord_state' and user_id = $2 and used_at is null and expires_at > now() returning id", [sha256(state), userId]);
  if (!t) throw badRequest("This Discord link request expired. Start again from Settings.");
  const tok = await fetch(api("/oauth2/token"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env().DISCORD_CLIENT_ID!, client_secret: env().DISCORD_CLIENT_SECRET!, grant_type: "authorization_code", code, redirect_uri: redirectUri() }) });
  const tj = (await tok.json().catch(() => ({}))) as { access_token?: string };
  if (!tok.ok || !tj.access_token) throw badRequest("Discord did not accept the sign-in. Try again.");
  const me = await fetch(api("/users/@me"), { headers: { Authorization: `Bearer ${tj.access_token}` } });
  const mj = (await me.json().catch(() => ({}))) as { id?: string; username?: string };
  if (!me.ok || !mj.id) throw badRequest("Could not read your Discord profile.");
  const other = await one("select id from users where discord_user_id = $1 and id <> $2", [mj.id, userId]);
  if (other) throw conflict("That Discord account is already linked to another BETVANTA account.");
  await q("update users set discord_user_id = $2, discord_username = $3, discord_linked_at = now(), updated_at = now() where id = $1", [userId, mj.id, mj.username ?? null]);
  const tier = await tierFor({ id: userId, role: "member" });
  const role = roleFor(tier);
  // Adds the member to the server (no-op if already in it) with the right role.
  const join = await fetch(api(`/guilds/${env().DISCORD_GUILD_ID}/members/${mj.id}`), { method: "PUT", headers: bot(), body: JSON.stringify({ access_token: tj.access_token, roles: role ? [role] : [] }) });
  if (![200, 201, 204].includes(join.status)) console.warn("[discord] guild join failed", join.status);
  await syncDiscordRole(userId);
  await audit(userId, "discord.link", "user", userId, { discord_user_id: mj.id });
  return { username: mj.username };
}

/** Makes the member's Discord roles match their current BETVANTA tier. */
export async function syncDiscordRole(userId: string) {
  if (!discordOAuthEnabled()) return { skipped: true };
  const u = await one<{ discord_user_id: string | null; role: string }>("select discord_user_id, role from users where id = $1", [userId]);
  if (!u?.discord_user_id) return { skipped: true };
  const tier = await tierFor({ id: userId, role: u.role });
  for (const t of ["premium", "vip"] as Tier[]) {
    const role = roleFor(t);
    if (!role) continue;
    const want = tier === t;
    const res = await fetch(api(`/guilds/${env().DISCORD_GUILD_ID}/members/${u.discord_user_id}/roles/${role}`), { method: want ? "PUT" : "DELETE", headers: bot() });
    if (![204, 404].includes(res.status)) throw new Error(`Discord role update failed (${res.status})`);
  }
  await q("update users set discord_synced_tier = $2 where id = $1", [userId, tier]);
  return { tier };
}
export async function syncDiscordRoleSafe(userId: string) { try { await syncDiscordRole(userId); } catch (e) { console.warn("[discord] sync failed", e); } }

export async function unlinkDiscord(userId: string) {
  const u = await one<{ discord_user_id: string | null }>("select discord_user_id from users where id = $1", [userId]);
  if (!u?.discord_user_id) throw badRequest("No Discord account is linked.");
  if (discordOAuthEnabled()) for (const role of [env().DISCORD_PREMIUM_ROLE_ID, env().DISCORD_VIP_ROLE_ID].filter(Boolean)) {
    await fetch(api(`/guilds/${env().DISCORD_GUILD_ID}/members/${u.discord_user_id}/roles/${role}`), { method: "DELETE", headers: bot() }).catch(() => {});
  }
  await q("update users set discord_user_id = null, discord_username = null, discord_linked_at = null, discord_synced_tier = null where id = $1", [userId]);
  await audit(userId, "discord.unlink", "user", userId);
}

/** Re-sync members whose stored role no longer matches their tier (e.g. after expiry). */
export async function resyncDiscordRoles() {
  if (!discordOAuthEnabled()) return { synced: 0 };
  const rows = await q<{ id: string }>("select id from users where discord_user_id is not null");
  let synced = 0;
  for (const r of rows) {
    const u = await one<{ role: string; discord_synced_tier: string | null }>("select role, discord_synced_tier from users where id = $1", [r.id]);
    const tier = await tierFor({ id: r.id, role: u!.role });
    if (tier !== u!.discord_synced_tier) { await syncDiscordRoleSafe(r.id); synced++; }
  }
  return { synced };
}

/** Announces a published pick in the community channel. Premium/VIP selections are never posted. */
export async function announcePrediction(predictionId: string) {
  const url = env().DISCORD_WEBHOOK_URL;
  if (!url) return;
  const p = await one<{ market: string; selection: string; access_tier: string; confidence: string; home: string; away: string; kickoff_at: string; fixture_id: string; data_source: string }>(
    `select p.market, p.selection, p.access_tier, p.confidence, ht.name home, at.name away, f.kickoff_at, f.id fixture_id, f.data_source from predictions p join fixtures f on f.id = p.fixture_id
     join teams ht on ht.id = f.home_team_id join teams at on at.id = f.away_team_id where p.id = $1`, [predictionId]);
  if (!p) return;
  const link = `${env().APP_URL}/matches/${p.fixture_id}`;
  const sample = p.data_source === "mock" ? " [sample data]" : "";
  const content = p.access_tier === "free"
    ? `New free pick${sample}: **${p.home} vs ${p.away}**, ${p.market}: **${p.selection}** (${p.confidence} confidence). ${link}\nPredictions are analysis, not guarantees. 18+.`
    : `New ${p.access_tier === "vip" ? "VIP" : "Premium"} pick${sample} for **${p.home} vs ${p.away}** is live for members. ${link}`;
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) }).catch((e) => console.warn("[discord] webhook failed", e));
}
