-- Enforces the free-tier "2 leagues per device" cap server-side,
-- instead of that cap only ever being a locally-remembered suggestion
-- (see LeagueSession.rememberLeague in shared/data.js, which just
-- limits how many stay in one device's quick-switch history). There
-- is no login system, so "device" is a random ID the client generates
-- once and persists (ProGate.getDeviceId()) -- good enough to stop
-- ordinary free use past the cap; not proof against someone clearing
-- site data, reinstalling, or calling this function directly with a
-- fabricated device id / is_pro flag. That's an accepted tradeoff
-- consistent with every other client-reported flag in this app (Pro
-- entitlement itself works the same way).

alter table public.draft_config
  add column if not exists creator_device_id text;

drop function if exists public.create_league(text, text, integer, integer, jsonb, jsonb, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean, boolean, boolean);

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
  if not p_is_pro and p_device_id is not null then
    select count(*) into v_existing_count
    from public.draft_config
    where creator_device_id = p_device_id;

    if v_existing_count >= 2 then
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

grant execute on function public.create_league(text, text, integer, integer, jsonb, jsonb, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean, boolean, boolean, text, boolean) to anon;

notify pgrst, 'reload schema';
