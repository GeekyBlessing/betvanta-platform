import { execSync } from "node:child_process";
import { pool, q } from "@/lib/db";
let migrated = false;
export async function resetDb() {
  if (!migrated) {
    // Mirror Supabase: its API roles exist before our migrations run (migration 009 must lock them out).
    for (const r of ["anon", "authenticated"]) await q(`do $$ begin if not exists (select 1 from pg_roles where rolname = '${r}') then create role ${r} nologin; end if; end $$`);
    execSync("node scripts/migrate.mjs", { env: { ...process.env, MIGRATION_DATABASE_URL: process.env.DATABASE_URL }, stdio: "ignore" });
    migrated = true;
  }
  await q(`truncate users, sessions, auth_tokens, subscriptions, payments, webhook_events, predictions, fixtures, team_stats, teams, competitions, email_outbox, contact_messages, rate_limits restart identity cascade`);
  // homepage_stats references users, so the cascade above empties it; restore the four seeded slots from migration 010.
  await q(`insert into homepage_stats (key, sort, icon, value_text, label) values ('members',1,'members','2,000','Happy Members'),
    ('win_rate',2,'target','100%','Win Rate'), ('winning_picks',3,'trophy','12,500','Winning Picks'), ('sports',4,'sports','10','Sports Covered')
    on conflict (key) do nothing`);
  await q("alter table audit_logs disable trigger audit_logs_no_update; truncate audit_logs; alter table audit_logs enable trigger audit_logs_no_update;");
}
export async function lastEmailLink(to: string) {
  const [m] = await q<{ body_text: string }>("select body_text from email_outbox where to_email = $1 order by created_at desc limit 1", [to]);
  return m?.body_text.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? null;
}
export const closePool = () => pool().end();
