-- BETVANTA initial schema
create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  display_name text not null,
  role text not null default 'member' check (role in ('member', 'analyst', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  email_verified_at timestamptz,
  age_confirmed_at timestamptz not null,
  terms_accepted_at timestamptz not null,
  notify_predictions boolean not null default true,
  notify_billing boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id text primary key, -- sha256 of the session token; the raw token only lives in the cookie
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  ip text,
  user_agent text
);
create index sessions_user_idx on sessions(user_id);

create table auth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  purpose text not null check (purpose in ('verify_email', 'reset_password')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tier text not null check (tier in ('premium', 'vip')),
  interval text not null check (interval in ('monthly', 'quarterly', 'annual')),
  duration_days int not null check (duration_days > 0),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN' check (currency in ('NGN', 'USD', 'GHS', 'ZAR', 'KES')),
  features jsonb not null default '[]',
  active boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  plan_id uuid not null references plans(id),
  tier text not null check (tier in ('premium', 'vip')),
  status text not null check (status in ('active', 'cancelled', 'expired')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on subscriptions(user_id, current_period_end desc);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  plan_id uuid not null references plans(id),
  provider text not null default 'paystack',
  reference text not null unique,
  amount_minor bigint not null,
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'flagged')),
  verified_at timestamptz,
  verified_via text check (verified_via in ('callback', 'webhook', 'admin')),
  provider_payload jsonb,
  subscription_id uuid references subscriptions(id),
  note text,
  created_at timestamptz not null default now()
);
create index payments_user_idx on payments(user_id, created_at desc);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null,
  event_type text not null,
  signature_valid boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, event_key)
);

create table competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  season int not null,
  provider_ref text not null unique,
  data_source text not null check (data_source in ('mock', 'api-football'))
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  provider_ref text not null unique,
  data_source text not null check (data_source in ('mock', 'api-football'))
);

create table fixtures (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  home_team_id uuid not null references teams(id),
  away_team_id uuid not null references teams(id),
  kickoff_at timestamptz not null,
  venue text,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  home_goals int,
  away_goals int,
  provider_ref text not null unique,
  data_source text not null check (data_source in ('mock', 'api-football')),
  updated_at timestamptz not null default now()
);
create index fixtures_kickoff_idx on fixtures(kickoff_at);

create table team_stats (
  team_id uuid not null references teams(id),
  competition_id uuid not null references competitions(id),
  season int not null,
  home_played int not null default 0, home_goals_for int not null default 0, home_goals_against int not null default 0,
  away_played int not null default 0, away_goals_for int not null default 0, away_goals_against int not null default 0,
  form text,
  data_source text not null check (data_source in ('mock', 'api-football')),
  updated_at timestamptz not null default now(),
  primary key (team_id, competition_id, season)
);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references fixtures(id) on delete cascade,
  market text not null check (market in ('1X2', 'BTTS', 'OU25')),
  selection text not null,
  probability numeric(5,4) check (probability between 0 and 1),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  access_tier text not null default 'premium' check (access_tier in ('free', 'premium', 'vip')),
  status text not null default 'draft' check (status in ('draft', 'published', 'settled')),
  result text not null default 'pending' check (result in ('pending', 'won', 'lost', 'void')),
  rationale text not null default '',
  analysis text,
  analysis_source text check (analysis_source in ('model', 'ai', 'analyst')),
  model_version text,
  author_id uuid references users(id),
  published_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, market)
);
create index predictions_status_idx on predictions(status, published_at desc);

-- A published prediction cannot change its pick after kickoff.
create function predictions_lock_guard() returns trigger language plpgsql as $$
declare k timestamptz;
begin
  select kickoff_at into k from fixtures where id = old.fixture_id;
  if old.status <> 'draft' and k <= now() and (
     new.selection is distinct from old.selection or new.market is distinct from old.market or
     new.probability is distinct from old.probability or new.confidence is distinct from old.confidence or
     new.access_tier is distinct from old.access_tier or new.published_at is distinct from old.published_at) then
    raise exception 'prediction % is locked after kickoff', old.id using errcode = 'P0001';
  end if;
  if old.status <> 'draft' and new.status = 'draft' then
    raise exception 'published prediction % cannot return to draft', old.id using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger predictions_lock before update on predictions for each row execute function predictions_lock_guard();

create table audit_logs (
  id bigserial primary key,
  actor_id uuid, -- no FK: audit rows must survive user deletion unchanged
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);
create function audit_logs_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_logs is append-only'; end $$;
create trigger audit_logs_no_update before update or delete on audit_logs for each row execute function audit_logs_immutable();

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null,
  subject text not null,
  body_text text not null,
  status text not null check (status in ('sent', 'logged', 'failed')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
