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
