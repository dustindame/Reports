-- Tracks a real Pro purchase by email, independent of which platform
-- it happened on (web/Stripe or the Android app/Play Billing). Lets
-- someone who bought Pro on one platform "restore" that same
-- persistent unlock on another (e.g. bought on the web tonight,
-- restores it inside the Play Store app once that's available) by
-- entering the same email -- without needing a real account/login
-- system. Only ever read/written server-side via the service_role
-- key (in worker.js) -- the anon key has zero access, so an email
-- here is never exposed to other users or even to the purchasing
-- browser itself beyond a plain yes/no "found" answer.

create table public.pro_purchases (
  email text primary key,
  source text not null check (source in ('stripe', 'play')),
  created_at timestamptz not null default now()
);

alter table public.pro_purchases enable row level security;

-- No policies at all -- this deliberately blocks every anon
-- select/insert/update/delete. All access goes through worker.js
-- using the service_role key, which bypasses RLS entirely.
revoke all on public.pro_purchases from anon;
