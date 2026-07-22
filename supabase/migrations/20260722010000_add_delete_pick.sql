-- Lets the commissioner undo a mis-entered pick from Player Entry. Same
-- PIN-checked SECURITY DEFINER pattern as the other write functions in
-- 20260721220000_add_league_codes_and_pin_auth.sql -- a league code alone
-- still can't delete anything, only the commissioner's PIN can.

create or replace function public.delete_pick(
  p_league_code text,
  p_pin_hash text,
  p_pick_id uuid
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

  delete from public.picks where id = p_pick_id and league_code = p_league_code;

  return true;
end;
$$;

grant execute on function public.delete_pick(text, text, uuid) to anon;
