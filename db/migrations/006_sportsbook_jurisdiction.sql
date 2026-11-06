-- Future sportsbook: real-money features may only ever run in US states where the contracted, licensed operator is authorized.
-- Empty in Phase 1. Rows are added only with a licence reference after legal sign-off.
create table sportsbook.licensed_jurisdictions (
  operator text not null,
  country text not null default 'US' check (country = 'US'),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  licence_ref text not null,
  min_age int not null default 21 check (min_age >= 18),
  active boolean not null default false,
  verified_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  primary key (operator, state_code)
);
comment on table sportsbook.licensed_jurisdictions is 'States where a licensed operator is authorized. Betting must be refused everywhere else, after a geolocation check.';
