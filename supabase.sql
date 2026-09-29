-- Pinch cloud sync schema. Paste into Supabase → SQL Editor → Run (once).
-- Also: Authentication → Sign In / Providers → turn OFF "Confirm email" (the app signs in with email + password).

create table public.items (
  user_id    uuid    not null default auth.uid() references auth.users on delete cascade,
  store      text    not null,             -- 'recipes', 'ingredients', 'logs', 'temps', 'settings'
  id         text    not null,
  data       jsonb   not null,
  deleted    boolean not null default false,
  updated_at bigint  not null,             -- client edit time (ms): last write wins
  server_ts  bigint  not null default 0,   -- set by trigger: devices pull rows newer than their cursor
  primary key (user_id, store, id)
);

create sequence public.items_server_ts;
create index items_user_server_ts on public.items (user_id, server_ts);

-- Each user can only see and write their own rows.
alter table public.items enable row level security;
create policy "own rows" on public.items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.items to authenticated;

-- Stamp every write with the next server_ts, and ignore an update older than what's stored.
-- ponytail: sequence cursor can skip rows from concurrent transactions committing out of order; fine for one user's devices.
create function public.items_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_ts := nextval('public.items_server_ts');
  return new;
end $$;

create trigger items_stamp before insert or update on public.items
  for each row execute function public.items_stamp();

-- ---------------------------------------------------------------------------
-- Feedback from the app (Settings → Feedback). Read it in Table Editor → feedback.
-- Anyone can send; nobody can read through the API. Sender id/email come from the
-- login token, not from the client, so they can't be faked.
create table public.feedback (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid default auth.uid(),
  email      text default (auth.jwt() ->> 'email'),
  message    text not null check (char_length(message) between 1 and 2000),
  context    text check (char_length(context) <= 500)
);

alter table public.feedback enable row level security;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated with check (true);
revoke all on public.feedback from anon, authenticated; -- Supabase grants everything by default
grant insert (message, context) on public.feedback to anon, authenticated;
