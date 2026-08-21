-- Real bug caught by live testing right after 20260821100000: selecting
-- show_nomination/nominated_player/nominated_position with the anon key
-- failed with "permission denied for table draft_config" even though the
-- table-wide SELECT grant/RLS policy already cover anon and authenticated.
-- This project's draft_config apparently relies on column-level grants
-- for individual columns (confirmed by every prior column-adding
-- migration explicitly re-granting, e.g. on_break in
-- 20260729100000_add_break_and_polls.sql) rather than one blanket
-- table-wide grant covering everything automatically -- a new column
-- doesn't inherit that until it's granted explicitly, same root cause as
-- the RLS/authenticated bug from 20260819190000.

grant select (show_nomination, nominated_player, nominated_position)
  on public.draft_config to anon, authenticated;

notify pgrst, 'reload schema';
