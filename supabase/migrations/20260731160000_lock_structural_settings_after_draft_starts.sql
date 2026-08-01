-- setup.js now greys out team count / budget / roster positions once a
-- league has any picks logged, and stops wiping picks on every edit --
-- but that was a client-side fix only. Same lesson as the is_pro
-- downgrade bug: enforce it server-side too, so a stale client, a
-- direct API call, or a future bug can't change what those existing
-- picks actually mean (team indices, budget math, position
-- eligibility) out from under a draft in progress.
--
-- If the league already has picks, num_teams / budget / roster_slots are
-- silently kept at their current values regardless of what's passed in
-- -- everything else in update_league still updates normally.

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
  p_is_pro boolean default false
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
      updated_at = now()
  where league_code = p_league_code;

  -- Once a draft has started, p_clear_picks is ignored too -- the whole
  -- point of locking the structural fields is that nothing here should
  -- ever be able to wipe an in-progress draft's picks.
  if p_clear_picks and not v_draft_started then
    delete from public.picks where league_code = p_league_code;
    delete from public.board_messages where league_code = p_league_code;
  end if;

  return true;
end;
$$;

grant execute on function public.update_league(text, text, integer, integer, jsonb, jsonb, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean, boolean, boolean, boolean) to anon;

notify pgrst, 'reload schema';
