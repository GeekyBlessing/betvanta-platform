-- Manual subscription payments submitted through the "Chat with us" payment assistant:
-- crypto sent to BETVANTA's own wallets (BTC, ETH, USDT) and methods arranged with Tom on Discord (PayPal, Venmo, Chime,
-- Apple Pay, other). Nothing here grants access: an admin reviews each submission and approves or rejects it.
--
-- Kept apart from both the provider-verified `payments` table and the `sportsbook` schema (wallets, deposits).
-- Additive only: two new tables, one trigger. Nothing existing is changed.

create table manual_payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^BV-M-[0-9A-Z]{8}$'),
  user_id uuid not null references users(id),
  plan_id uuid not null references plans(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  method text not null check (method in ('btc', 'eth', 'usdt', 'paypal', 'venmo', 'chime', 'apple_pay', 'other')),
  method_other text check (char_length(method_other) between 2 and 40),
  network text check (char_length(network) <= 40),
  pay_to_address text check (char_length(pay_to_address) <= 120),  -- the address shown to the customer, kept as shown
  full_name text not null check (char_length(full_name) between 2 and 100),
  contact_email text not null check (char_length(contact_email) <= 254 and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  discord_username text not null check (char_length(discord_username) between 2 and 64),
  customer_reference text check (char_length(customer_reference) <= 200),          -- transaction hash or payment ID
  customer_note text check (char_length(customer_note) <= 1000),
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  review_note text check (char_length(review_note) <= 500),
  subscription_id uuid references subscriptions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manual_payments_other_named check (method <> 'other' or method_other is not null),
  constraint manual_payments_crypto_address check (method not in ('btc', 'eth', 'usdt') or pay_to_address is not null),
  constraint manual_payments_reviewed check (status = 'pending_review' or (reviewed_by is not null and reviewed_at is not null)),
  constraint manual_payments_approved_has_access check (status <> 'approved' or subscription_id is not null),
  constraint manual_payments_rejected_has_reason check (status <> 'rejected' or review_note is not null)
);
-- One open submission per member per plan.
create unique index manual_payments_one_pending on manual_payments(user_id, plan_id) where status = 'pending_review';
create index manual_payments_status_idx on manual_payments(status, created_at desc);
create index manual_payments_user_idx on manual_payments(user_id, created_at desc);

-- A decision is final: approved or rejected rows cannot be edited or reopened.
create function manual_payments_decided_guard() returns trigger language plpgsql as $$
begin
  if old.status <> 'pending_review' then
    raise exception 'manual payment % is already %', old.reference, old.status using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger manual_payments_decided before update on manual_payments for each row execute function manual_payments_decided_guard();

create table manual_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  manual_payment_id uuid not null references manual_payments(id),
  filename text not null check (char_length(filename) between 1 and 120),
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
  size_bytes int not null check (size_bytes between 1 and 4194304),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  data bytea not null,
  created_at timestamptz not null default now()
);
create index manual_payment_proofs_payment_idx on manual_payment_proofs(manual_payment_id);

-- Same lockdown as every other table (see 009).
alter table manual_payments enable row level security;
alter table manual_payment_proofs enable row level security;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on manual_payments, manual_payment_proofs from %I', r);
    end if;
  end loop;
end $$;
-- The app can record and review submissions; it can never delete one, and proofs are write-once.
grant select, insert, update on manual_payments to betvanta_app;
grant select, insert on manual_payment_proofs to betvanta_app;
create policy app_read on manual_payments for select to betvanta_app using (true);
create policy app_insert on manual_payments for insert to betvanta_app with check (status = 'pending_review');
create policy app_update on manual_payments for update to betvanta_app using (true) with check (true);
create policy app_read on manual_payment_proofs for select to betvanta_app using (true);
create policy app_insert on manual_payment_proofs for insert to betvanta_app with check (true);
