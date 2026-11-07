-- On-chain verification for manual crypto payments, and protection against reusing one transaction for two plans.
-- Additive only: new nullable columns and one partial unique index. Existing rows are unchanged.

alter table manual_payments add column chain_status text check (chain_status in ('verified', 'failed', 'pending', 'unsupported', 'error'));
alter table manual_payments add column chain_summary text check (char_length(chain_summary) <= 500);
alter table manual_payments add column chain_details jsonb;
alter table manual_payments add column chain_checked_at timestamptz;
alter table manual_payments add column verified_manually boolean not null default false;

-- A blockchain transaction can activate at most one subscription.
create unique index manual_payments_one_approval_per_tx on manual_payments (method, lower(customer_reference))
  where status = 'approved' and method in ('btc', 'eth', 'usdt') and customer_reference is not null;
