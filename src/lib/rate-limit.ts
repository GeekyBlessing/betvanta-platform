import { one } from "./db";
import { tooMany } from "./errors";
/** Fixed-window limiter stored in Postgres so it works across serverless instances. */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const row = await one<{ count: number }>(
    `insert into rate_limits(key, window_start, count)
     values ($1, to_timestamp(floor(extract(epoch from now()) / $2) * $2), 1)
     on conflict (key, window_start) do update set count = rate_limits.count + 1
     returning count`, [key, windowSec]);
  if ((row?.count ?? 0) > limit) throw tooMany();
}
export async function pruneRateLimits() { await one("delete from rate_limits where window_start < now() - interval '1 day'"); }
