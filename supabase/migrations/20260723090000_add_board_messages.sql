-- Lets anyone with the league code post a short shout-out (e.g. after
-- scanning the Draft Board's QR code, from Team Picks) that appears on
-- the Draft Board's news ticker, highlighted differently from the NFL
-- headlines. Unlike picks/setup, this doesn't touch draft state or
-- integrity, so it deliberately skips the commissioner PIN check --
-- worst case someone posts a silly message, which is the point.

create table public.board_messages (
  id uuid primary key default gen_random_uuid(),
  league_code text not null references public.draft_config (league_code) on delete cascade,
  message text not null check (char_length(message) between 1 and 80),
  created_at timestamptz not null default now()
);

create index board_messages_league_code_idx on public.board_messages (league_code);
create index board_messages_created_at_idx on public.board_messages (created_at);

alter table public.board_messages enable row level security;

create policy "Anyone can read board messages" on public.board_messages for select to anon using (true);
create policy "Anyone can post a board message" on public.board_messages for insert to anon with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'board_messages'
  ) then
    alter publication supabase_realtime add table public.board_messages;
  end if;
end $$;
