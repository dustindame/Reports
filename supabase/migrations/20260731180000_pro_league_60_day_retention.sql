-- Pro leagues were previously kept forever. Drafts aren't needed
-- forever once someone has copied their results into their actual
-- fantasy service -- so Pro leagues now get the same daily cleanup
-- sweep as free leagues, just on a much longer clock: 60 idle days,
-- regardless of draft_completed status (free tier keeps its existing
-- 7/14-day split; this is deliberately simpler for Pro since 60 days
-- is already generous either way).

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
  delete from public.polls where league_code = any(v_codes);
  delete from public.draft_config where league_code = any(v_codes);
end;
$$;

notify pgrst, 'reload schema';
