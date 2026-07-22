-- Two fixes:
--   1. A "priority" flag on board_messages so the Nice ($69) message can
--      interrupt whatever's currently showing on the Draft Board ticker
--      instead of just queuing behind it like an ordinary fan message.
--   2. update_league (when clearing picks, i.e. resetting a draft) now
--      also clears old board_messages -- previously leftover messages
--      from a prior test/session on the same league code kept
--      resurfacing on later loads, since only `picks` was cleared.

alter table public.board_messages
  add column if not exists priority boolean not null default false;

grant select (priority) on public.board_messages to anon;

drop function if exists public.update_league(text, text, integer, integer, jsonb, jsonb, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb);

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
  p_show_elapsed_time boolean default false,
  p_nice_enabled boolean default false,
  p_shots_count integer default 0,
  p_shot_pick_numbers jsonb default '[]'::jsonb
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
      updated_at = now()
  where league_code = p_league_code;

  if p_clear_picks then
    delete from public.picks where league_code = p_league_code;
    delete from public.board_messages where league_code = p_league_code;
  end if;

  return true;
end;
$$;

grant execute on function public.update_league(text, text, integer, integer, jsonb, jsonb, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb) to anon;

-- One-time cleanup: clears out any leftover test messages from before
-- this fix existed, so they stop resurfacing on Draft Board loads.
delete from public.board_messages;

notify pgrst, 'reload schema';
