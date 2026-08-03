-- Polls were built (20260729100000_add_break_and_polls.sql), then the
-- feature was removed from the UI entirely -- the break screen was
-- redesigned around facts/odds/board instead and never shipped a poll
-- again. The open-ended, un-rate-limited create_poll RPC was a known
-- risk with no remaining feature depending on it. Dropping the whole
-- feature (tables + RPCs) rather than leaving it sitting around unused,
-- and updating cleanup_stale_leagues so the nightly sweep stops
-- referencing the now-gone polls table.

drop function if exists public.submit_poll_vote(uuid, integer, text);
drop function if exists public.close_poll(text, text, uuid);
drop function if exists public.create_poll(text, text, text, jsonb);

drop table if exists public.poll_votes;
drop table if exists public.polls;

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
  where
    (
      is_pro = false
      and (
        (draft_completed = false and updated_at < now() - interval '7 days')
        or
        (draft_completed = true and updated_at < now() - interval '14 days')
      )
    )
    or (
      is_pro = true
      and updated_at < now() - interval '60 days'
    );

  if v_codes is null or array_length(v_codes, 1) is null then
    return;
  end if;

  delete from public.picks where league_code = any(v_codes);
  delete from public.board_messages where league_code = any(v_codes);
  delete from public.draft_config where league_code = any(v_codes);
end;
$$;

notify pgrst, 'reload schema';
