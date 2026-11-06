-- Homepage headline statistics, editable by admins from /admin/homepage.
-- Four fixed slots. Each shows either a figure an admin enters (manual) or the live figure computed from
-- BETVANTA's own records (live). A manual figure is "unverified" until an admin records how it was verified,
-- and the homepage labels unverified figures as such.
-- Additive only: creates one new table and seeds its four rows. Nothing existing is changed.

create table homepage_stats (
  key text primary key check (key in ('members', 'win_rate', 'winning_picks', 'sports')),
  sort int not null,
  icon text not null check (icon in ('members', 'target', 'trophy', 'sports')),
  value_text text not null check (char_length(value_text) between 1 and 16),
  label text not null check (char_length(label) between 1 and 40),
  source text not null default 'manual' check (source in ('manual', 'live')),
  verification text not null default 'unverified' check (verification in ('unverified', 'verified')),
  verification_note text check (char_length(verification_note) <= 280),
  verified_by uuid references users(id),
  verified_at timestamptz,
  visible boolean not null default true,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now(),
  -- A figure can only be marked verified together with who verified it, when, and on what basis.
  constraint homepage_stats_verified_has_evidence check (
    verification = 'unverified' or (verification_note is not null and char_length(verification_note) >= 10 and verified_by is not null and verified_at is not null))
);

-- Client-provided placeholders. They stay "unverified" until an admin records independent verification.
insert into homepage_stats (key, sort, icon, value_text, label) values
  ('members',       1, 'members', '2,000+',  'Happy Members'),
  ('win_rate',      2, 'target',  '100%',    'Win Rate'),
  ('winning_picks', 3, 'trophy',  '12,500+', 'Winning Picks'),
  ('sports',        4, 'sports',  '10',      'Sports Covered');

-- Same lockdown as every other table (see 009): RLS on, Supabase API roles get nothing,
-- the app role can read and update the four rows but never add or remove slots.
alter table homepage_stats enable row level security;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on homepage_stats from %I', r);
    end if;
  end loop;
end $$;
grant select, update on homepage_stats to betvanta_app;
create policy app_read on homepage_stats for select to betvanta_app using (true);
create policy app_update on homepage_stats for update to betvanta_app using (true) with check (true);
