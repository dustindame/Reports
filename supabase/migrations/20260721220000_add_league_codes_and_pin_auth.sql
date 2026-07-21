-- Multi-league support: a shareable league code for viewing (Draft Board,
-- Team Picks) and a commissioner PIN, verified server-side, for writing
-- (logging picks, editing league setup). Replaces the earlier
-- single-active-draft model (draft_config was always id=1), so this
-- migration resets any existing draft_config/picks rows -- re-create your
-- league via setup.html after running this.
--
-- Security model: anon can freely SELECT picks and the public columns of
-- draft_config (league_code, team names, budget, roster, etc) -- that's
-- the "view" side, shareable via the league code. commish_pin_hash is
-- never exposed to anon (column-level grant excludes it, see below). All
-- writes go through SECURITY DEFINER functions that check the PIN hash
-- server-side before doing anything, so having the league code alone can
-- never alter a draft -- the check happens in Postgres, not just in the
-- app's UI.
--
-- Honest limitation: this is real server-side enforcement, but it is not
-- brute-force-hardened -- anon can call verify_pin/submit_pick repeatedly
-- with guesses, and there's no rate limiting. That's a reasonable trust
-- level for a friends-and-family hobby app, not for anything that needs
-- to resist a determined attacker.

drop table if exists public.picks cascade;
drop table if exists public.draft_config cascade;

create table public.draft_config (
  id uuid primary key default gen_random_uuid(),
  league_code text unique not null,
  commish_pin_hash text not null,
  num_teams integer not null check (num_teams between 6 and 14),
  budget integer not null check (budget > 0),
  team_names jsonb not null,
  roster_slots jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  league_code text not null references public.draft_config (league_code) on delete cascade,
  team_id text not null,
  player_name text not null,
  position text not null check (position in ('QB', 'RB', 'WR', 'TE')),
  price integer not null check (price > 0),
  created_at timestamptz not null default now()
);

create index picks_league_code_idx on public.picks (league_code);
create index picks_created_at_idx on public.picks (created_at);

alter table public.draft_config enable row level security;
alter table public.picks enable row level security;

-- Anon may read every row of both tables -- the app scopes queries by
-- league_code itself, and nothing in a row is sensitive except
-- commish_pin_hash, which column-level grants (below) hide regardless of
-- these policies.
create policy "Anyone can read draft config" on public.draft_config for select to anon using (true);
create policy "Anyone can read picks" on public.picks for select to anon using (true);

-- Deliberately no insert/update/delete policies for anon on either table.
-- All writes must go through the SECURITY DEFINER functions below.

revoke all on public.draft_config from anon;
revoke all on public.picks from anon;
grant select (id, league_code, num_teams, budget, team_names, roster_slots, updated_at) on public.draft_config to anon;
grant select on public.picks to anon;

-- ---------- write functions (SECURITY DEFINER: bypass RLS/grants above,
-- but only after checking the PIN hash themselves) ----------

create or replace function public.create_league(
  p_league_code text,
  p_pin_hash text,
  p_num_teams integer,
  p_budget integer,
  p_team_names jsonb,
  p_roster_slots jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.draft_config (league_code, commish_pin_hash, num_teams, budget, team_names, roster_slots)
  values (p_league_code, p_pin_hash, p_num_teams, p_budget, p_team_names, p_roster_slots)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.verify_pin(
  p_league_code text,
  p_pin_hash text
) returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.draft_config
    where league_code = p_league_code and commish_pin_hash = p_pin_hash
  );
$$;

create or replace function public.update_league(
  p_league_code text,
  p_pin_hash text,
  p_num_teams integer,
  p_budget integer,
  p_team_names jsonb,
  p_roster_slots jsonb,
  p_clear_picks boolean default true
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.draft_config
    where league_code = p_league_code and commish_pin_hash = p_pin_hash
  ) then
    return false;
  end if;

  update public.draft_config
  set num_teams = p_num_teams,
      budget = p_budget,
      team_names = p_team_names,
      roster_slots = p_roster_slots,
      updated_at = now()
  where league_code = p_league_code;

  if p_clear_picks then
    delete from public.picks where league_code = p_league_code;
  end if;

  return true;
end;
$$;

create or replace function public.submit_pick(
  p_league_code text,
  p_pin_hash text,
  p_team_id text,
  p_player_name text,
  p_position text,
  p_price integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.draft_config
    where league_code = p_league_code and commish_pin_hash = p_pin_hash
  ) then
    return false;
  end if;

  insert into public.picks (league_code, team_id, player_name, position, price)
  values (p_league_code, p_team_id, p_player_name, p_position, p_price);

  return true;
end;
$$;

grant execute on function public.create_league(text, text, integer, integer, jsonb, jsonb) to anon;
grant execute on function public.verify_pin(text, text) to anon;
grant execute on function public.update_league(text, text, integer, integer, jsonb, jsonb, boolean) to anon;
grant execute on function public.submit_pick(text, text, text, text, text, integer) to anon;

-- Re-enable Realtime on the recreated picks table (dropping the table
-- above removes any prior publication membership).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'picks'
  ) then
    alter publication supabase_realtime add table public.picks;
  end if;
end $$;
