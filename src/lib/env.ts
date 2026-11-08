import { z } from "zod";

const schema = z.object({
  // Required when the app touches the database (checked in lib/db.ts), not for rendering pages that never query it.
  DATABASE_URL: z.string().min(1).optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  ADMIN_EMAILS: z.string().default(""),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_BASE_URL: z.string().url().default("https://api.paystack.co"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_API_BASE: z.string().url().default("https://api.stripe.com"),
  NOWPAYMENTS_API_KEY: z.string().optional(),
  NOWPAYMENTS_IPN_SECRET: z.string().optional(),
  NOWPAYMENTS_API_BASE: z.string().url().default("https://api.nowpayments.io"),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  DISCORD_PREMIUM_ROLE_ID: z.string().optional(),
  DISCORD_VIP_ROLE_ID: z.string().optional(),
  // Official community links (client-provided, public). Can be overridden per environment.
  DISCORD_INVITE_URL: z.string().url().default("https://discord.com/invite/STDJ29shZS"),
  INSTAGRAM_URL: z.string().url().default("https://www.instagram.com/bet.vanta/"),
  X_URL: z.string().url().default("https://x.com/betvantaanalyst"),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  DISCORD_API_BASE: z.string().url().default("https://discord.com/api/v10"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("BETVANTA <onboarding@resend.dev>"),
  API_FOOTBALL_KEY: z.string().optional(),
  API_FOOTBALL_LEAGUES: z.string().default("253,39,140,135,78,61"), // MLS, Premier League, La Liga, Serie A, Bundesliga, Ligue 1
  API_FOOTBALL_SEASON: z.coerce.number().int().default(2025),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  ALLOW_SAMPLE_DATA: z.enum(["true", "false"]).default("false"),
  // US-targeted product: kickoff times display in this zone (IANA name). Members' own zones can come later.
  APP_TIMEZONE: z.string().default("America/New_York"),
  // Customer support contact (client-provided). Shown on the site and used as Reply-To on emails.
  SUPPORT_EMAIL: z.string().email().default("betvanta098@gmail.com"),
  SUPPORT_PHONE: z.string().regex(/^\+?[0-9]{10,15}$/).default("+13143436703"),
  // Crypto stays OFF until legal and payment-provider approvals are confirmed for the merchant's jurisdiction.
  CRYPTO_PAYMENTS_ENABLED: z.enum(["true", "false"]).default("false"),
  CRON_SECRET: z.string().optional(),
  // Manual crypto payments: the chain each 0x wallet receives on. Leave unset until the client confirms it;
  // the payment assistant then tells customers to confirm the network with BETVANTA before sending.
  CRYPTO_ETH_NETWORK: z.string().trim().min(2).max(40).optional(),
  CRYPTO_USDT_NETWORK: z.string().trim().min(2).max(40).optional(),
  // On-chain verification of manual crypto payments before an admin can approve them.
  MEMPOOL_API_BASE: z.string().url().default("https://mempool.space"),       // Bitcoin (public API, no key)
  ETHERSCAN_API_KEY: z.string().optional(),                                  // Ethereum mainnet ETH and USDT (ERC-20)
  ETHERSCAN_API_BASE: z.string().url().default("https://api.etherscan.io/v2/api"),
  BTC_MIN_CONFIRMATIONS: z.coerce.number().int().min(1).max(100).default(2),
  ETH_MIN_CONFIRMATIONS: z.coerce.number().int().min(1).max(200).default(12),
  // Where "Contact BETVANTA on Discord" goes: a discord.com channel, user or invite link. Falls back to DISCORD_INVITE_URL.
  DISCORD_SUPPORT_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof schema>;
let cached: Env | null = null;
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
export function resetEnvCache() { cached = null; }
export const isProd = () => process.env.NODE_ENV === "production";
export const paymentsEnabled = () => Boolean(env().PAYSTACK_SECRET_KEY || env().STRIPE_SECRET_KEY || env().NOWPAYMENTS_API_KEY);
/** Only a real Discord invite is accepted (discord.gg/... or discord.com/invite/...). Anything else is ignored. */
export function discordInviteUrl(): string | null {
  const u = env().DISCORD_INVITE_URL;
  if (!u) return null;
  try { const x = new URL(u); return x.protocol === "https:" && (x.hostname === "discord.gg" || ((x.hostname === "discord.com" || x.hostname === "www.discord.com") && x.pathname.startsWith("/invite/"))) ? x.toString() : null; } catch { return null; }
}
/** Link for "Contact BETVANTA on Discord": a Discord channel, user or invite link only; otherwise the community invite. */
export function discordSupportUrl(): string | null {
  const u = env().DISCORD_SUPPORT_URL;
  if (u) {
    try {
      const x = new URL(u);
      const okHost = x.protocol === "https:" && (x.hostname === "discord.gg" || x.hostname === "discord.com" || x.hostname === "www.discord.com");
      if (okHost && (x.hostname === "discord.gg" || /^\/(invite|channels|users)\//.test(x.pathname))) return x.toString();
    } catch { /* fall through */ }
  }
  return discordInviteUrl();
}
/** The official Instagram profile; only instagram.com profile links are accepted. */
export function instagramUrl(): string | null {
  try { const x = new URL(env().INSTAGRAM_URL); return x.protocol === "https:" && /^(www\.)?instagram\.com$/.test(x.hostname) && /^\/[A-Za-z0-9._]+\/?$/.test(x.pathname) ? x.toString() : null; } catch { return null; }
}
export const instagramHandle = () => { const u = instagramUrl(); return u ? "@" + new URL(u).pathname.replace(/\//g, "") : null; };
/** The official X (Twitter) profile; only x.com or twitter.com profile links are accepted. */
export function xUrl(): string | null {
  try { const x = new URL(env().X_URL); return x.protocol === "https:" && /^(www\.)?(x|twitter)\.com$/.test(x.hostname) && /^\/[A-Za-z0-9_]{1,15}\/?$/.test(x.pathname) ? x.toString() : null; } catch { return null; }
}
export const xHandle = () => { const u = xUrl(); return u ? "@" + new URL(u).pathname.replace(/\//g, "") : null; };
export const discordOAuthEnabled = () => Boolean(env().DISCORD_CLIENT_ID && env().DISCORD_CLIENT_SECRET && env().DISCORD_BOT_TOKEN && env().DISCORD_GUILD_ID);
export const emailEnabled = () => Boolean(env().RESEND_API_KEY);
export const aiEnabled = () => Boolean(env().OPENAI_API_KEY);
export const cryptoApproved = () => env().CRYPTO_PAYMENTS_ENABLED === "true";
export const sampleDataAllowed = () => env().ALLOW_SAMPLE_DATA === "true";
export const adminEmails = () => env().ADMIN_EMAILS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
