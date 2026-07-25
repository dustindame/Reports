-- Poll creation moves from commissioner-only to open to anyone with the
-- league code, same trust level as voting (no PIN) -- any fan who
-- scanned the QR code can start a poll during a break, not just the
-- commissioner. The commissioner still exclusively controls whether the
-- league is on break at all (set_draft_break, unchanged) and can still
-- close a poll early (close_poll, unchanged). A poll can only be created
-- while the league is actually on break, enforced server-side.

drop function if exists public.create_poll(text, text, text, jsonb);

create or replace function public.create_poll(
  p_league_code text,
  p_question text,
  p_options jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.draft_config
    where league_code = p_league_code and on_break = true
  ) then
    return null;
  end if;

  -- Only one active poll per league at a time -- starting a new one
  -- retires whatever was still open, from anyone.
  update public.polls set active = false where league_code = p_league_code and active = true;

  insert into public.polls (league_code, question, options)
  values (p_league_code, p_question, p_options)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_poll(text, text, jsonb) to anon;

notify pgrst, 'reload schema';
