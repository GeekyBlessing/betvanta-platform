import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
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
  DISCORD_INVITE_URL: z.string().url().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  DISCORD_API_BASE: z.string().url().default("https://discord.com/api/v10"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("BETVANTA <onboarding@resend.dev>"),
  API_FOOTBALL_KEY: z.string().optional(),
  API_FOOTBALL_LEAGUES: z.string().default("39,140,135,78,61"),
  API_FOOTBALL_SEASON: z.coerce.number().int().default(2025),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  ALLOW_SAMPLE_DATA: z.enum(["true", "false"]).default("false"),
  CRON_SECRET: z.string().optional(),
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
export const discordOAuthEnabled = () => Boolean(env().DISCORD_CLIENT_ID && env().DISCORD_CLIENT_SECRET && env().DISCORD_BOT_TOKEN && env().DISCORD_GUILD_ID);
export const emailEnabled = () => Boolean(env().RESEND_API_KEY);
export const aiEnabled = () => Boolean(env().OPENAI_API_KEY);
export const sampleDataAllowed = () => env().ALLOW_SAMPLE_DATA === "true";
export const adminEmails = () => env().ADMIN_EMAILS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
