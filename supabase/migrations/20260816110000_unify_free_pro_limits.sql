-- Simplifies two limits that used to differ between free and Pro leagues
-- into one flat number for everyone -- removes a "wait, is this a Pro
-- thing?" category of confusion for a difference that was never a
-- meaningful part of the Pro pitch anyway (Pro is about fun extras, not
-- storage/retention rules). Neither change meaningfully affects database
-- size: leagues are tiny rows, and the retention cleanup already bounds
-- long-term growth regardless of the cap.
--
-- 1. Retention: was 7/14 days (free, incomplete/complete) vs 60 days
--    (Pro) -- now a flat 30 days for every league regardless of Pro
--    status or completion state.
-- 2. Device league-creation cap: was 5 (free) vs unlimited (Pro) -- now
--    a flat 15 for every device, Pro or not.

create or replace function public.cleanup_stale_leagues() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codes text[];
begin
  select array_agg(league_code) into v_codes
  from public.draft_config
  where updated_at < now() - interval '30 days';

  if v_codes is null or array_length(v_codes, 1) is null then
    return;
  end if;

  delete from public.picks where league_code = any(v_codes);
  delete from public.board_messages where league_code = any(v_codes);
  delete from public.draft_config where league_code = any(v_codes);
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
  p_is_pro boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_existing_count integer;
begin
  -- No more free/Pro distinction here -- everyone gets the same 15-per-
  -- device cap now, so p_is_pro no longer exempts this check.
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
    nice_enabled, shots_count, shot_pick_numbers, roast_enabled, show_recap, break_enabled, creator_device_id
  )
  values (
    p_league_code, p_pin_hash, p_num_teams, p_budget, p_team_names, p_roster_slots,
    p_board_name, p_show_news, p_show_messages, p_show_recent, p_show_drafted_total, p_show_position_totals, p_show_elapsed_time,
    p_nice_enabled, p_shots_count, p_shot_pick_numbers, p_roast_enabled, p_show_recap, p_break_enabled, p_device_id
  )
  returning id into v_id;
  return v_id;
end;
$$;

notify pgrst, 'reload schema';
