-- Integration points for a FUTURE licensed sportsbook operator. Nothing in Phase 1 writes to these tables.
-- Kept in a separate schema so wagering money never mixes with subscription payments (public.payments).
create schema if not exists sportsbook;

create table sportsbook.settings (
  id boolean primary key default true check (id),
  real_money_enabled boolean not null default false check (real_money_enabled = false), -- hard-off in Phase 1; a later migration must drop this check deliberately
  operator text,
  updated_at timestamptz not null default now()
);
insert into sportsbook.settings default values;

create table sportsbook.odds_snapshots (
  id bigserial primary key,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  bookmaker text not null,
  market text not null,
  selection text not null,
  price numeric(8,3) not null check (price > 1),
  licence_ref text not null,
  captured_at timestamptz not null default now()
);

create table sportsbook.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  currency text not null default 'USD',
  operator_account_ref text,
  status text not null default 'disabled' check (status in ('disabled', 'active', 'frozen')),
  created_at timestamptz not null default now(),
  unique (user_id, currency)
);

create table sportsbook.wallet_ledger (
  id bigserial primary key,
  wallet_id uuid not null references sportsbook.wallets(id),
  kind text not null check (kind in ('deposit', 'withdrawal', 'stake', 'payout', 'refund', 'adjustment')),
  amount_minor bigint not null,
  operator_ref text not null unique,
  created_at timestamptz not null default now()
);

create table sportsbook.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  fixture_id uuid not null references public.fixtures(id),
  market text not null,
  selection text not null,
  price numeric(8,3) not null,
  stake_minor bigint not null check (stake_minor > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'won', 'lost', 'void', 'cashed_out')),
  operator_bet_ref text unique,
  placed_at timestamptz not null default now(),
  settled_at timestamptz
);

-- Block writes to money tables while real money is disabled, even from code that forgets the flag.
create function sportsbook.block_when_disabled() returns trigger language plpgsql as $$
begin
  if not (select real_money_enabled from sportsbook.settings) then
    raise exception 'sportsbook is disabled in this phase' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger wallets_guard before insert or update on sportsbook.wallets for each row execute function sportsbook.block_when_disabled();
create trigger ledger_guard before insert or update on sportsbook.wallet_ledger for each row execute function sportsbook.block_when_disabled();
create trigger bets_guard before insert or update on sportsbook.bets for each row execute function sportsbook.block_when_disabled();
