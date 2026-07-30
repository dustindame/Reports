-- Two features for the free tier's "leagues pile up forever" problem:
--
-- 1. A manual "mark draft complete" flag, since real drafts sometimes end
--    without every roster slot filling (a team drops out, time runs short,
--    budgets dry up) -- "completed" can no longer be inferred purely from
--    drafted-count-equals-total-slots.
-- 2. A scheduled cleanup job (pg_cron) that deletes stale FREE-tier leagues:
--      - unfinished (not marked/inferred complete) and untouched 7+ days
--      - completed and untouched 14+ days
--    Pro leagues (is_pro = true) are never auto-deleted. `is_pro` has to be
--    a real persisted column now -- previously p_is_pro was only used
--    transiently at create_league time to check the free-tier cap, never
--    stored, so nothing could tell Pro and free leagues apart later.

alter table public.draft_config
  add column if not exists is_pro boolean not null default false,
  add column if not exists draft_completed boolean not null default false;

grant select (is_pro, draft_completed) on public.draft_config to anon;

drop function if exists public.create_league(text, text, integer, integer, jsonb, jsonb, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean, boolean, boolean, text, boolean);
drop function if exists public.update_league(text, text, integer, integer, jsonb, jsonb, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean, boolean, boolean);

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
    nice_enabled, shots_count, shot_pick_numbers, roast_enabled, show_recap, break_enabled, creator_device_id, is_pro
  )
  values (
    p_league_code, p_pin_hash, p_num_teams, p_budget, p_team_names, p_roster_slots,
    p_board_name, p_show_news, p_show_messages, p_show_recent, p_show_drafted_total, p_show_position_totals, p_show_elapsed_time,
    p_nice_enabled, p_shots_count, p_shot_pick_numbers, p_roast_enabled, p_show_recap, p_break_enabled, p_device_id, p_is_pro
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
      is_pro = p_is_pro,
      updated_at = now()
  where league_code = p_league_code;

  if p_clear_picks then
    delete from public.picks where league_code = p_league_code;
    delete from public.board_messages where league_code = p_league_code;
  end if;

  return true;
end;
$$;

grant execute on function public.create_league(text, text, integer, integer, jsonb, jsonb, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean, boolean, boolean, text, boolean) to anon;
grant execute on function public.update_league(text, text, integer, integer, jsonb, jsonb, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb, boolean, boolean, boolean, boolean) to anon;

-- Lets a commissioner mark a draft done even with open roster slots left
-- (or reopen one marked complete by mistake) -- same PIN-check shape as
-- set_draft_break.
create or replace function public.set_draft_completed(
  p_league_code text,
  p_pin_hash text,
  p_completed boolean default true
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
  set draft_completed = p_completed,
      updated_at = now()
  where league_code = p_league_code;

  return true;
end;
$$;

grant execute on function public.set_draft_completed(text, text, boolean) to anon;

-- Daily sweep: deletes stale FREE-tier leagues and everything scoped to
-- them (picks, board messages, polls -- poll_votes cascades off polls).
-- Pro leagues are never touched, regardless of age or completion state.
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
  where is_pro = false
    and (
      (draft_completed = false and updated_at < now() - interval '7 days')
      or
      (draft_completed = true and updated_at < now() - interval '14 days')
    );

  if v_codes is null or array_length(v_codes, 1) is null then
    return;
  end if;

  delete from public.picks where league_code = any(v_codes);
  delete from public.board_messages where league_code = any(v_codes);
  delete from public.polls where league_code = any(v_codes);
  delete from public.draft_config where league_code = any(v_codes);
end;
$$;

-- pg_cron ships as a standard Supabase extension (enable it once from the
-- dashboard's Database > Extensions list if this create fails silently /
-- the schedule doesn't show up in `select * from cron.job`).
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'cleanup-stale-leagues';
select cron.schedule('cleanup-stale-leagues', '0 8 * * *', $$select public.cleanup_stale_leagues();$$);

notify pgrst, 'reload schema';
