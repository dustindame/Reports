-- submit_pick had zero validation beyond the PIN check -- nothing stopped
-- the same player from being drafted twice in the same league. The
-- client already checks this against whatever picks it has loaded
-- locally, but that's a race: two devices submitting within the same
-- couple seconds (exactly what can happen during a handoff, or just two
-- people moving fast in a live auction) can both pass the client-side
-- check before either's Realtime update reaches the other, and both
-- inserts succeed. A unique index closes that race atomically at the
-- database layer -- Postgres serializes concurrent inserts against the
-- same unique key, so the second one always fails cleanly instead of
-- silently succeeding.
--
-- Defensively de-duplicate first (keep the earliest pick per league +
-- player, in case this has already happened somewhere) so the unique
-- index can actually be created.

delete from public.picks p
using public.picks p2
where p.league_code = p2.league_code
  and lower(trim(p.player_name)) = lower(trim(p2.player_name))
  and p.created_at > p2.created_at;

create unique index if not exists picks_league_player_unique_idx
  on public.picks (league_code, lower(trim(player_name)));

create or replace function public.submit_pick(
  p_league_code text,
  p_pin_hash text,
  p_team_id text,
  p_player_name text,
  p_position text,
  p_price integer
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

  begin
    insert into public.picks (league_code, team_id, player_name, position, price)
    values (p_league_code, p_team_id, p_player_name, p_position, p_price);
  exception
    when unique_violation then
      raise exception 'PLAYER_ALREADY_DRAFTED';
  end;

  return true;
end;
$$;

grant execute on function public.submit_pick(text, text, text, text, text, integer) to anon;

notify pgrst, 'reload schema';
