-- Fantasy Auction Draft: live picks table
--
-- One row per confirmed pick made on the Player Entry screen. The Draft
-- Board and Team Picks screens subscribe to inserts on this table (via
-- Supabase Realtime) so a pick entered on a phone shows up live on the
-- TV / on other phones, replacing the localStorage stand-in used while
-- this was a static-only prototype.
--
-- No auth system exists for this hobby/single-room app, so access is
-- opened up to the anon key (RLS policies below) rather than gated by
-- user accounts — anyone with the app URL can log or read picks, same
-- trust model as a shared physical draft board in a room.

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  team_id text not null,
  player_name text not null,
  position text not null check (position in ('QB', 'RB', 'WR', 'TE')),
  price integer not null check (price > 0),
  created_at timestamptz not null default now()
);

create index if not exists picks_created_at_idx on public.picks (created_at);

alter table public.picks enable row level security;

drop policy if exists "Anyone can read picks" on public.picks;
create policy "Anyone can read picks"
  on public.picks for select
  to anon
  using (true);

drop policy if exists "Anyone can log a pick" on public.picks;
create policy "Anyone can log a pick"
  on public.picks for insert
  to anon
  with check (true);

-- Enable Realtime so INSERTs stream to subscribed clients (Draft Board,
-- Team Picks, and other Player Entry sessions). Guarded so re-running
-- migrations doesn't error if it's already a publication member.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'picks'
  ) then
    alter publication supabase_realtime add table public.picks;
  end if;
end $$;
