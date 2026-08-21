-- "Now Nominating" feature: before a pick is assigned to a team with a
-- price, the commissioner can nominate a player so everyone watching
-- (Draft Board, Team Picks) sees the name live, before bidding is over.
-- Off by default -- an opt-in Draft Board Display toggle, same pattern
-- as show_news/show_recent/etc.
--
-- nominated_player/nominated_position change far more often than the
-- rest of draft_config (every single nomination, not just settings
-- saves), so they get their own PIN-gated set/clear functions rather
-- than going through update_league -- same reasoning as set_draft_break.

alter table public.draft_config
  add column if not exists show_nomination boolean not null default false,
  add column if not exists nominated_player text,
  add column if not exists nominated_position text;

create or replace function public.set_nomination(
  p_league_code text,
  p_pin_hash text,
  p_player_name text,
  p_position text
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
  set nominated_player = p_player_name,
      nominated_position = p_position,
      updated_at = now()
  where league_code = p_league_code;

  return true;
end;
$$;

create or replace function public.clear_nomination(
  p_league_code text,
  p_pin_hash text
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
  set nominated_player = null,
      nominated_position = null,
      updated_at = now()
  where league_code = p_league_code;

  return true;
end;
$$;

-- Submitting the real pick always clears any pending nomination in the
-- same transaction -- the whole point is nobody has to remember a
-- separate "clear" step once the actual pick is logged.
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

  begin
    insert into public.picks (league_code, team_id, player_name, position, price)
    values (p_league_code, p_team_id, p_player_name, p_position, p_price);
  exception
    when unique_violation then
      raise exception 'PLAYER_ALREADY_DRAFTED';
  end;

  update public.draft_config
  set nominated_player = null,
      nominated_position = null
  where league_code = p_league_code;

  return true;
end;
$$;

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
  p_break_enabled boolean default false,
  p_device_id text default null,
  p_is_pro boolean default false,
  p_show_nomination boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_existing_count integer;
begin
  if p_device_id is not null then
    select count(*) into v_existing_count
    from public.draft_config
    where creator_device_id = p_device_id;

    if v_existing_count >= 15 then
      raise exception 'FREE_LEAGUE_LIMIT_REACHED';
    end if;
  end if;

  insert into public.draft_config (
    league_code, commish_pin_hash, num_teams, budget, team_names, roster_slots,
    board_name, show_news, show_messages, show_recent, show_drafted_total, show_position_totals, show_elapsed_time,
    nice_enabled, shots_count, shot_pick_numbers, roast_enabled, show_recap, break_enabled, creator_device_id,
    show_nomination
  )
  values (
    p_league_code, p_pin_hash, p_num_teams, p_budget, p_team_names, p_roster_slots,
    p_board_name, p_show_news, p_show_messages, p_show_recent, p_show_drafted_total, p_show_position_totals, p_show_elapsed_time,
    p_nice_enabled, p_shots_count, p_shot_pick_numbers, p_roast_enabled, p_show_recap, p_break_enabled, p_device_id,
    p_show_nomination
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
  p_break_enabled boolean default false,
  p_is_pro boolean default false,
  p_show_nomination boolean default false
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_started boolean;
begin
  if not exists (
    select 1 from public.draft_config
    where league_code = p_league_code and commish_pin_hash = p_pin_hash
  ) then
    return false;
  end if;

  select exists(select 1 from public.picks where league_code = p_league_code)
    into v_draft_started;

  update public.draft_config
  set num_teams = case when v_draft_started then num_teams else p_num_teams end,
      budget = case when v_draft_started then budget else p_budget end,
      roster_slots = case when v_draft_started then roster_slots else p_roster_slots end,
      team_names = p_team_names,
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
      is_pro = is_pro or p_is_pro,
      show_nomination = p_show_nomination,
      updated_at = now()
  where league_code = p_league_code;

  if p_clear_picks and not v_draft_started then
    delete from public.picks where league_code = p_league_code;
    delete from public.board_messages where league_code = p_league_code;
  end if;

  return true;
end;
$$;

grant execute on function public.set_nomination(text, text, text, text) to anon, authenticated;
grant execute on function public.clear_nomination(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
