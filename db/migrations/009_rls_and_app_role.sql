-- Supabase hardening: Row Level Security on every table, a least-privilege application role,
-- and no access at all for Supabase's public API roles (anon, authenticated).
--
-- Roles:
--   postgres / migration owner  -> runs migrations (owns the tables)
--   betvanta_app                -> what the running app connects as; RLS applies to it
--   anon, authenticated         -> Supabase Data API roles; BETVANTA does not use them, so they get nothing
--
-- The app role is created NOLOGIN here; scripts/db-app-role.mjs sets its password and LOGIN from a secret,
-- so no credential is ever stored in a migration.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'betvanta_app') then
    create role betvanta_app nologin noinherit;
  end if;
end $$;

-- 1. Supabase API roles: revoke everything, now and for future tables.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
      execute format('revoke all on schema sportsbook from %I', r);
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
    end if;
  end loop;
end $$;

-- 2. Enable RLS on every table. With no policy for a role, that role sees and changes nothing.
do $$
declare t record;
begin
  for t in select schemaname, tablename from pg_tables where schemaname in ('public', 'sportsbook') loop
    execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
  end loop;
end $$;

-- 3. Application role: schema usage and per-table privileges (no DDL, no TRUNCATE, deletes only where needed).
grant usage on schema public to betvanta_app;
grant usage on schema sportsbook to betvanta_app;
grant usage, select on all sequences in schema public to betvanta_app;

grant select, insert, update          on users, auth_tokens, subscriptions, payments, webhook_events,
                                         competitions, teams, fixtures, contact_messages, testimonials to betvanta_app;
grant select, insert, update, delete  on sessions, team_stats, predictions, rate_limits to betvanta_app;
grant select, insert, delete          on user_favourite_competitions to betvanta_app;
grant select, update                  on plans to betvanta_app;
grant select, insert                  on audit_logs, email_outbox to betvanta_app;
grant select                          on schema_migrations to betvanta_app;
grant select                          on all tables in schema sportsbook to betvanta_app;

-- 4. Policies for the application role. Server code enforces per-user rules; these policies add hard limits
--    the code cannot bypass even if it has a bug.
do $$
declare t text;
begin
  -- full read/write (within the grants above)
  foreach t in array array['users', 'auth_tokens', 'subscriptions', 'payments', 'webhook_events', 'competitions', 'teams',
                           'fixtures', 'contact_messages', 'testimonials', 'sessions', 'team_stats', 'rate_limits',
                           'user_favourite_competitions', 'plans'] loop
    execute format('create policy app_all on public.%I for all to betvanta_app using (true) with check (true)', t);
  end loop;
  -- append-only logs: read and insert
  foreach t in array array['audit_logs', 'email_outbox'] loop
    execute format('create policy app_read on public.%I for select to betvanta_app using (true)', t);
    execute format('create policy app_insert on public.%I for insert to betvanta_app with check (true)', t);
  end loop;
  -- read-only
  execute 'create policy app_read on public.schema_migrations for select to betvanta_app using (true)';
  foreach t in array array['settings', 'odds_snapshots', 'wallets', 'wallet_ledger', 'bets', 'licensed_jurisdictions'] loop
    execute format('create policy app_read on sportsbook.%I for select to betvanta_app using (true)', t);
  end loop;
end $$;

-- predictions: only drafts may ever be deleted; published or settled picks are permanent.
create policy app_select on predictions for select to betvanta_app using (true);
create policy app_insert on predictions for insert to betvanta_app with check (true);
create policy app_update on predictions for update to betvanta_app using (true) with check (true);
create policy app_delete_drafts on predictions for delete to betvanta_app using (status = 'draft');
