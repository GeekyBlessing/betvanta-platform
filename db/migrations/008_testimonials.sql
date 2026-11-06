-- Member reviews. Only real members can submit; nothing is shown until the member has given explicit
-- publication consent AND an admin has approved it. No seeded or invented reviews.
create table testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 2 and 40),
  location text check (char_length(location) <= 40),
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 20 and 600),
  verified_subscriber boolean not null default false,
  consent_at timestamptz not null,
  consent_text text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index testimonials_status_idx on testimonials(status, created_at desc);
