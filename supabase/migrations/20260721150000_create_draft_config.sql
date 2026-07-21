-- Fantasy Auction Draft: configurable draft setup
--
-- Single-row table holding the commissioner's chosen team count, budget,
-- roster/lineup structure, and team names. The app runs one active draft
-- at a time, so `id` is always 1 (upserted from setup.html). shared/data.js
-- reads this row to build TEAMS / ROSTER_SLOTS / BUDGET for every screen;
-- if this table is empty, the app falls back to the built-in 12-team demo
-- setup instead.
--
-- Same trust model as `picks`: no auth system exists for this app, so the
-- anon key can read and write this row (RLS policies below).

create table if not exists public.draft_config (
  id integer primary key default 1,
  num_teams integer not null check (num_teams between 6 and 14),
  budget integer not null check (budget > 0),
  team_names jsonb not null,
  roster_slots jsonb not null,
  updated_at timestamptz not null default now(),
  constraint draft_config_single_row check (id = 1)
);

alter table public.draft_config enable row level security;

drop policy if exists "Anyone can read draft config" on public.draft_config;
create policy "Anyone can read draft config"
  on public.draft_config for select
  to anon
  using (true);

drop policy if exists "Anyone can save draft config" on public.draft_config;
create policy "Anyone can save draft config"
  on public.draft_config for insert
  to anon
  with check (true);

drop policy if exists "Anyone can update draft config" on public.draft_config;
create policy "Anyone can update draft config"
  on public.draft_config for update
  to anon
  using (true)
  with check (true);

-- Saving a new setup also clears any existing picks (see setup.js), since
-- old picks reference the previous config's teams/slots. Anon needs delete
-- rights on `picks` for that — the original picks migration only granted
-- select + insert.
drop policy if exists "Anyone can clear picks" on public.picks;
create policy "Anyone can clear picks"
  on public.picks for delete
  to anon
  using (true);
