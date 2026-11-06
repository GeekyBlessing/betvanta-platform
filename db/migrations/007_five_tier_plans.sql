-- Client-confirmed five-plan structure (USD). Plans are ordered by level; higher levels include everything below.
-- Level -> content tier: 1-2 = premium, 3-5 = vip (VIP-exclusive picks start at 6 Month).
alter table plans drop constraint plans_interval_check;
alter table plans add constraint plans_interval_check check (interval in ('monthly', 'quarterly', 'semiannual', 'annual', 'lifetime'));
alter table plans add column level int not null default 1 check (level between 1 and 5);
alter table plans add column is_lifetime boolean not null default false;
alter table plans add column best_value boolean not null default false;
alter table plans add column tagline text;
alter table plans alter column duration_days drop not null;
alter table plans drop constraint plans_duration_days_check;
alter table plans add constraint plans_duration_chk check ((is_lifetime and duration_days is null) or (not is_lifetime and duration_days > 0));

-- Retire the earlier placeholder plans (kept for history; existing subscriptions still reference them).
update plans set active = false, updated_at = now();
update plans set level = case tier when 'vip' then 3 else 1 end;

insert into plans (code, name, tier, interval, duration_days, amount_minor, currency, level, is_lifetime, best_value, tagline, features, sort) values
 ('premium_1m',       'Monthly Premium',  'premium', 'monthly',    30,   5000, 'USD', 1, false, false, 'Most popular way to start',        '[]', 100),
 ('premium_3m',       '3 Month Premium',  'premium', 'quarterly',  90,  10000, 'USD', 2, false, false, 'For regular followers',            '[]', 110),
 ('premium_6m',       '6 Month Premium',  'vip',     'semiannual', 180, 15000, 'USD', 3, false, false, 'Unlocks VIP-exclusive picks',      '[]', 120),
 ('premium_1y',       '1 Year Premium',   'vip',     'annual',     365, 30000, 'USD', 4, false, true,  'Best value: full VIP for a year',  '[]', 130),
 ('premium_lifetime', 'Lifetime Premium', 'vip',     'lifetime',   null, 60000, 'USD', 5, true,  false, 'Pay once, keep access for life', '[]', 140)
on conflict (code) do nothing;
create unique index plans_one_best_value on plans (best_value) where best_value and active;

-- Each subscription records what was bought: level, price, currency, duration and whether it is lifetime.
alter table subscriptions add column plan_level int not null default 1 check (plan_level between 1 and 5);
alter table subscriptions add column price_minor bigint;
alter table subscriptions add column currency text not null default 'USD';
alter table subscriptions add column duration_days int;
alter table subscriptions add column is_lifetime boolean not null default false;
update subscriptions s set plan_level = p.level, price_minor = p.amount_minor, duration_days = p.duration_days from plans p where p.id = s.plan_id;
alter table subscriptions add constraint subscriptions_lifetime_chk check (not is_lifetime or current_period_end = 'infinity');
comment on table subscriptions is 'Subscription access periods. Paid via public.payments only; never linked to sportsbook wallets.';
