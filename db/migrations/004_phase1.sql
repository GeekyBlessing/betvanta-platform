-- Phase 1: USD pricing, multiple payment providers, sports/leagues, favourites, Discord, admin grants.

-- USD placeholder prices (cents). Editable in Admin > Plans.
update plans set currency = 'USD', amount_minor = case code
  when 'premium_monthly' then 1900 when 'premium_quarterly' then 4900 when 'premium_annual' then 17900
  when 'vip_monthly' then 4900 when 'vip_quarterly' then 12900 when 'vip_annual' then 44900 end, updated_at = now();
alter table plans alter column currency set default 'USD';

-- Subscription payments only. Sportsbook money movements live in the separate "sportsbook" schema (005).
comment on table payments is 'Subscription payments only. Never used for wagers, deposits or withdrawals.';
alter table payments add column method text not null default 'card' check (method in ('card', 'crypto', 'bank'));
alter table payments add column pay_currency text check (pay_currency in ('BTC', 'ETH', 'USDT'));
alter table payments add column provider_session_id text;
alter table payments add column provider_payment_id text;
alter table payments add constraint payments_provider_chk check (provider in ('paystack', 'stripe', 'nowpayments'));
alter table payments add constraint payments_usd_chk check (currency = 'USD') not valid;
create index payments_provider_session_idx on payments(provider, provider_session_id);

-- Sports and leagues
alter table competitions add column sport text not null default 'football' check (sport in ('football', 'basketball', 'tennis', 'american_football', 'baseball'));
alter table competitions add column active boolean not null default true;
create table user_favourite_competitions (
  user_id uuid not null references users(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, competition_id)
);

-- Discord
alter table users add column discord_user_id text unique;
alter table users add column discord_username text;
alter table users add column discord_linked_at timestamptz;
alter table users add column discord_synced_tier text;

-- Admin-granted access
alter table subscriptions add column source text not null default 'payment' check (source in ('payment', 'admin_grant'));
alter table subscriptions add column granted_by uuid references users(id);
alter table subscriptions add column note text;
alter table auth_tokens drop constraint auth_tokens_purpose_check;
alter table auth_tokens add constraint auth_tokens_purpose_check check (purpose in ('verify_email', 'reset_password', 'discord_state'));
