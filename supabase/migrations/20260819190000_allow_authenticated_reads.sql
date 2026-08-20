-- Every existing RLS policy on draft_config/picks/board_messages was scoped
-- to the `anon` role only (applied via the dashboard, not a prior migration
-- -- confirmed 2026-08-19 there was no CREATE POLICY for these anywhere in
-- this migrations folder). That was invisible as long as every client used
-- the anon key. Native Google Sign-In (added 2026-08-19) changed that: once
-- a device signs in, supabase-js attaches the authenticated user's JWT to
-- EVERY request on the whole origin -- not just Pro-purchase calls -- since
-- the session lives in shared localStorage. With no `authenticated` policy,
-- RLS silently returned zero rows (no error) for league lookups, picks, and
-- messages, breaking the whole app for that device the instant it signed
-- in. Real bug, confirmed live: creating a league then immediately being
-- signed in produced "No league found with that code" for a league that
-- verifiably existed.
--
-- Fix: extend each existing anon-only policy to also cover authenticated.
-- Being signed in with Google is orthogonal to reading/posting league data
-- -- it should never be more restrictive than being signed out.

alter policy "Anyone can read draft config" on public.draft_config
  to anon, authenticated;

alter policy "Anyone can read picks" on public.picks
  to anon, authenticated;

alter policy "Anyone can read board messages" on public.board_messages
  to anon, authenticated;

alter policy "Anyone can post a board message" on public.board_messages
  to anon, authenticated;

alter policy "Anyone can delete a board message" on public.board_messages
  to anon, authenticated;
