-- update_league previously did `is_pro = p_is_pro`, a blind overwrite.
-- Pro is meant to be a one-time, permanent upgrade for a LEAGUE (anyone
-- with the code + PIN should get full Pro access, e.g. a friend covering
-- Draft Entry on a non-Pro device) -- but that same blind overwrite meant
-- a non-Pro device editing an already-Pro league's settings would silently
-- flip is_pro back to false and revoke Pro for everyone. The client is now
-- fixed to always send the already-known is_pro value through, but this
-- is the real fix: enforce "never downgrade" server-side too, so a stale
-- or buggy client can't regress it either.

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
      is_pro = is_pro or p_is_pro,
      updated_at = now()
  where league_code = p_league_code;

  if p_clear_picks then
    delete from public.picks where league_code = p_league_code;
    delete from public.board_messages where league_code = p_league_code;
  end if;

  return true;
end;
$$;

grant execute on function public.update_league(text, text, integer, integer, jsonb, jsonb, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean, boolean, boolean, boolean) to anon;

notify pgrst, 'reload schema';
