-- Adds: (1) commissioner-configurable Draft Board display options (which
-- header widgets show, a custom board name), and (2) support for a
-- Defense/Special Teams ("DEF") roster slot, so leagues that want one can
-- draft team defenses like any other position.

alter table public.draft_config
  add column if not exists board_name text not null default 'Auction Draft Board',
  add column if not exists show_news boolean not null default true,
  add column if not exists show_messages boolean not null default true,
  add column if not exists show_recent boolean not null default true,
  add column if not exists show_drafted_total boolean not null default true,
  add column if not exists show_position_totals boolean not null default false,
  add column if not exists show_elapsed_time boolean not null default false;

grant select (board_name, show_news, show_messages, show_recent, show_drafted_total, show_position_totals, show_elapsed_time)
  on public.draft_config to anon;

alter table public.picks drop constraint if exists picks_position_check;
alter table public.picks add constraint picks_position_check check (position in ('QB', 'RB', 'WR', 'TE', 'DEF'));

-- create_league/update_league gain new optional params (all defaulted, so
-- old callers still work) -- must drop the old signatures first since
-- Postgres treats a different parameter list as a different function.
drop function if exists public.create_league(text, text, integer, integer, jsonb, jsonb);
drop function if exists public.update_league(text, text, integer, integer, jsonb, jsonb, boolean);

create or replace function public.create_league(
  p_league_code text,
  p_pin_hash text,
  p_num_teams integer,
  p_budget integer,
  p_team_names jsonb,
  p_roster_slots jsonb,
  p_board_name text default 'Auction Draft Board',
  p_show_news boolean default true,
  p_show_messages boolean default true,
  p_show_recent boolean default true,
  p_show_drafted_total boolean default true,
  p_show_position_totals boolean default false,
  p_show_elapsed_time boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.draft_config (
    league_code, commish_pin_hash, num_teams, budget, team_names, roster_slots,
    board_name, show_news, show_messages, show_recent, show_drafted_total, show_position_totals, show_elapsed_time
  )
  values (
    p_league_code, p_pin_hash, p_num_teams, p_budget, p_team_names, p_roster_slots,
    p_board_name, p_show_news, p_show_messages, p_show_recent, p_show_drafted_total, p_show_position_totals, p_show_elapsed_time
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_league(
  p_league_code text,
  p_pin_hash text,
  p_num_teams integer,
  p_budget integer,
  p_team_names jsonb,
  p_roster_slots jsonb,
  p_clear_picks boolean default true,
  p_board_name text default 'Auction Draft Board',
  p_show_news boolean default true,
  p_show_messages boolean default true,
  p_show_recent boolean default true,
  p_show_drafted_total boolean default true,
  p_show_position_totals boolean default false,
  p_show_elapsed_time boolean default false
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
      board_name = p_board_name,
      show_news = p_show_news,
      show_messages = p_show_messages,
      show_recent = p_show_recent,
      show_drafted_total = p_show_drafted_total,
      show_position_totals = p_show_position_totals,
      show_elapsed_time = p_show_elapsed_time,
      updated_at = now()
  where league_code = p_league_code;

  if p_clear_picks then
    delete from public.picks where league_code = p_league_code;
  end if;

  return true;
end;
$$;

grant execute on function public.create_league(text, text, integer, integer, jsonb, jsonb, text, boolean, boolean, boolean, boolean, boolean, boolean) to anon;
grant execute on function public.update_league(text, text, integer, integer, jsonb, jsonb, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean) to anon;
