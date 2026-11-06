-- Default plans. Prices are PLACEHOLDERS for the MVP and are editable in Admin > Plans.
insert into plans (code, name, tier, interval, duration_days, amount_minor, currency, features, sort) values
 ('premium_monthly',  'Premium', 'premium', 'monthly',   30,  1000000, 'NGN', '["All premium predictions","Full match analysis","Prediction history"]', 10),
 ('premium_quarterly','Premium', 'premium', 'quarterly', 90,  2700000, 'NGN', '["All premium predictions","Full match analysis","Prediction history"]', 11),
 ('premium_annual',   'Premium', 'premium', 'annual',   365,  9600000, 'NGN', '["All premium predictions","Full match analysis","Prediction history"]', 12),
 ('vip_monthly',      'VIP',     'vip',     'monthly',   30,  2500000, 'NGN', '["Everything in Premium","VIP-only predictions","AI match reports when enabled"]', 20),
 ('vip_quarterly',    'VIP',     'vip',     'quarterly', 90,  6750000, 'NGN', '["Everything in Premium","VIP-only predictions","AI match reports when enabled"]', 21),
 ('vip_annual',       'VIP',     'vip',     'annual',   365, 24000000, 'NGN', '["Everything in Premium","VIP-only predictions","AI match reports when enabled"]', 22)
on conflict (code) do nothing;
