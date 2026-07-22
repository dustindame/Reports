-- Messages now play in a continuous, shared rotation (multiple messages
-- can be active and spaced apart at once, like the news ticker) instead
-- of one-at-a-time -- each message gets its own loop count so Nice ($69)
-- can show just once while a regular fan message still shows 5 times.
-- Also raises the max message length from 80 to 100 characters.

alter table public.board_messages
  add column if not exists loops integer not null default 5 check (loops between 1 and 20);

grant select (loops) on public.board_messages to anon;

alter table public.board_messages drop constraint if exists board_messages_message_check;
alter table public.board_messages add constraint board_messages_message_check check (char_length(message) between 1 and 100);

notify pgrst, 'reload schema';
