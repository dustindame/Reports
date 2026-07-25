-- Adds a commissioner-controlled "on break" state for a league, plus a
-- simple poll system for fans to vote on during a break: a question with
-- either custom text answers or the league's own team names as answers.
--
-- Voting is anonymous (no PIN) -- each browser/device gets a random
-- "voter token" stored in localStorage (see shared/data.js LeagueSession)
-- so it can vote once per poll and change its vote, but there's no real
-- identity behind it. That's an intentional, low-stakes trust level for
-- a fun break-time poll, not something meant to resist ballot stuffing
-- by someone willing to clear their storage.

alter table public.draft_config
  add column if not exists on_break boolean not null default false;

grant select (on_break) on public.draft_config to anon;

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  league_code text not null references public.draft_config (league_code) on delete cascade,
  question text not null,
  options jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index polls_league_code_idx on public.polls (league_code);

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_index integer not null,
  voter_token text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, voter_token)
);
create index poll_votes_poll_id_idx on public.poll_votes (poll_id);

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

create policy "Anyone can read polls" on public.polls for select to anon using (true);
create policy "Anyone can read poll votes" on public.poll_votes for select to anon using (true);

revoke all on public.polls from anon;
revoke all on public.poll_votes from anon;
grant select on public.polls to anon;
grant select on public.poll_votes to anon;

-- ---------- write functions ----------

create or replace function public.set_draft_break(
  p_league_code text,
  p_pin_hash text,
  p_on_break boolean
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

  update public.draft_config
  set on_break = p_on_break,
      updated_at = now()
  where league_code = p_league_code;

  return true;
end;
$$;

create or replace function public.create_poll(
  p_league_code text,
  p_pin_hash text,
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
    where league_code = p_league_code and commish_pin_hash = p_pin_hash
  ) then
    return null;
  end if;

  -- Only one active poll per league at a time -- starting a new one
  -- retires whatever was still open.
  update public.polls set active = false where league_code = p_league_code and active = true;

  insert into public.polls (league_code, question, options)
  values (p_league_code, p_question, p_options)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.close_poll(
  p_league_code text,
  p_pin_hash text,
  p_poll_id uuid
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

  update public.polls set active = false where id = p_poll_id and league_code = p_league_code;
  return true;
end;
$$;

create or replace function public.submit_poll_vote(
  p_poll_id uuid,
  p_option_index integer,
  p_voter_token text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.polls where id = p_poll_id and active = true) then
    return false;
  end if;

  insert into public.poll_votes (poll_id, option_index, voter_token)
  values (p_poll_id, p_option_index, p_voter_token)
  on conflict (poll_id, voter_token)
  do update set option_index = excluded.option_index, created_at = now();

  return true;
end;
$$;

grant execute on function public.set_draft_break(text, text, boolean) to anon;
grant execute on function public.create_poll(text, text, text, jsonb) to anon;
grant execute on function public.close_poll(text, text, uuid) to anon;
grant execute on function public.submit_poll_vote(uuid, integer, text) to anon;

-- Realtime for the break screen (poll results updating live) and for the
-- Draft Board noticing on_break flip without a manual refresh.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'polls'
  ) then
    alter publication supabase_realtime add table public.polls;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poll_votes'
  ) then
    alter publication supabase_realtime add table public.poll_votes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'draft_config'
  ) then
    alter publication supabase_realtime add table public.draft_config;
  end if;
end $$;

notify pgrst, 'reload schema';
