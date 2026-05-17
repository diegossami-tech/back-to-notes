create table if not exists public.backnotes_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.backnotes_libraries enable row level security;

drop policy if exists "backnotes read own library" on public.backnotes_libraries;
create policy "backnotes read own library"
on public.backnotes_libraries
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "backnotes insert own library" on public.backnotes_libraries;
create policy "backnotes insert own library"
on public.backnotes_libraries
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "backnotes update own library" on public.backnotes_libraries;
create policy "backnotes update own library"
on public.backnotes_libraries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "backnotes delete own library" on public.backnotes_libraries;
create policy "backnotes delete own library"
on public.backnotes_libraries
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.backnotes_analytics_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_target text not null default '',
  path text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  user_agent text not null default ''
);

create index if not exists backnotes_analytics_created_idx
on public.backnotes_analytics_events (created_at desc);

create index if not exists backnotes_analytics_session_idx
on public.backnotes_analytics_events (session_id, created_at desc);

create index if not exists backnotes_analytics_event_idx
on public.backnotes_analytics_events (event_name, event_target);

alter table public.backnotes_analytics_events enable row level security;

drop policy if exists "backnotes analytics public insert" on public.backnotes_analytics_events;
create policy "backnotes analytics public insert"
on public.backnotes_analytics_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "backnotes analytics owner read" on public.backnotes_analytics_events;
create policy "backnotes analytics owner read"
on public.backnotes_analytics_events
for select
to authenticated
using ((auth.jwt() ->> 'email') in ('diegossami@gmail.com'));
