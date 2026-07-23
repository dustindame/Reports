-- Two fixes:
--   1. Realtime DELETE events on `picks` were being silently dropped for
--      clients filtering by league_code. By default a table's replica
--      identity only includes primary-key columns in the WAL record for
--      UPDATE/DELETE, but Realtime needs league_code present to evaluate
--      the `league_code=eq.X` filter on a delete -- without it, the event
--      never matches and never reaches subscribers, so an undone pick
--      only disappeared from other screens after a manual refresh.
--   2. Anon may now delete board_messages -- the client removes a message
--      from the server once it's been shown its full loop count, so a
--      page refresh doesn't refetch and replay already-finished messages
--      (loop progress was only ever tracked in memory, never persisted).

alter table public.picks replica identity full;

create policy "Anyone can delete a board message" on public.board_messages for delete to anon using (true);

notify pgrst, 'reload schema';
