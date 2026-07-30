-- Lets the commissioner turn the Recap page and Break screen on or off
-- per league (both Pro features -- this is an additional per-league
-- on/off switch on top of the Pro gate itself, e.g. a Pro user running
-- a casual league who just doesn't want a Recap page at all).

alter table public.draft_config
  add column if not exists show_recap boolean not null default false,
  add column if not exists break_enabled boolean not null default false;

-- Every Pro-gated display option should default OFF for a brand new
-- league (previously show_messages/show_recent/roast_enabled defaulted
-- true even though all three are Pro features) -- only changes the
-- default applied to future inserts, doesn't touch any already-saved
-- league's stored preference.
alter table public.draft_config
  alter column show_messages set default false,
  alter column show_recent set default false,
  alter column roast_enabled set default false;

grant select (show_recap, break_enabled) on public.draft_config to anon;

drop function if exists public.create_league(text, text, integer, integer, jsonb, jsonb, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean);
drop function if exists public.update_league(text, text, integer, integer, jsonb, jsonb, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean);

create or replace function public.create_league(
  p_league_code text,
  p_pin_hash text,
  p_num_teams integer,
  p_budget integer,
  p_team_names jsonb,
  p_roster_slots jsonb,
  p_board_name text default 'Auction Draft Board',
  p_show_news boolean default true,
  p_show_messages boolean default false,
  p_show_recent boolean default false,
  p_show_drafted_total boolean default true,
  p_show_position_totals boolean default false,
  p_show_elapsed_time boolean default false,
  p_nice_enabled boolean default false,
  p_shots_count integer default 0,
  p_shot_pick_numbers jsonb default '[]'::jsonb,
  p_roast_enabled boolean default false,
  p_show_recap boolean default false,
  p_break_enabled boolean default false
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
    board_name, show_news, show_messages, show_recent, show_drafted_total, show_position_totals, show_elapsed_time,
    nice_enabled, shots_count, shot_pick_numbers, roast_enabled, show_recap, break_enabled
  )
  values (
    p_league_code, p_pin_hash, p_num_teams, p_budget, p_team_names, p_roster_slots,
    p_board_name, p_show_news, p_show_messages, p_show_recent, p_show_drafted_total, p_show_position_totals, p_show_elapsed_time,
    p_nice_enabled, p_shots_count, p_shot_pick_numbers, p_roast_enabled, p_show_recap, p_break_enabled
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
  p_show_messages boolean default false,
  p_show_recent boolean default false,
  p_show_drafted_total boolean default true,
  p_show_position_totals boolean default false,
  p_show_elapsed_time boolean default false,
  p_nice_enabled boolean default false,
  p_shots_count integer default 0,
  p_shot_pick_numbers jsonb default '[]'::jsonb,
  p_roast_enabled boolean default false,
  p_show_recap boolean default false,
  p_break_enabled boolean default false
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
      nice_enabled = p_nice_enabled,
      shots_count = p_shots_count,
      shot_pick_numbers = p_shot_pick_numbers,
      roast_enabled = p_roast_enabled,
      show_recap = p_show_recap,
      break_enabled = p_break_enabled,
      updated_at = now()
  where league_code = p_league_code;

  if p_clear_picks then
    delete from public.picks where league_code = p_league_code;
    delete from public.board_messages where league_code = p_league_code;
  end if;

  return true;
end;
$$;

grant execute on function public.create_league(text, text, integer, integer, jsonb, jsonb, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean, boolean, boolean) to anon;
grant execute on function public.update_league(text, text, integer, integer, jsonb, jsonb, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean, boolean, boolean) to anon;

notify pgrst, 'reload schema';
