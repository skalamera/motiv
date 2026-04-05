-- Motiv: profiles, cars, manuals, maintenance, chat, storage policies
-- Run via Supabase SQL editor or: supabase db push / MCP apply_migration

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  year int not null,
  make text not null,
  model text not null,
  trim text,
  vin text,
  mileage int not null default 0,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manuals (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create table public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  task text not null,
  interval_miles int,
  interval_months int,
  is_custom boolean not null default false,
  source text not null default 'custom' check (source in ('manual', 'web', 'custom')),
  notes text,
  last_completed_at timestamptz,
  last_mileage_at int,
  created_at timestamptz not null default now()
);

create table public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.maintenance_schedules (id) on delete set null,
  car_id uuid not null references public.cars (id) on delete cascade,
  completed_at timestamptz not null default now(),
  mileage_at int,
  notes text,
  cost numeric(10, 2)
);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  car_id uuid references public.cars (id) on delete set null,
  title text,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.manuals enable row level security;
alter table public.maintenance_schedules enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

create policy "cars_all_own" on public.cars for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "manuals_all_own_car" on public.manuals for all using (
  exists (select 1 from public.cars c where c.id = manuals.car_id and c.user_id = auth.uid())
) with check (
  exists (select 1 from public.cars c where c.id = manuals.car_id and c.user_id = auth.uid())
);

create policy "schedules_all_own_car" on public.maintenance_schedules for all using (
  exists (select 1 from public.cars c where c.id = maintenance_schedules.car_id and c.user_id = auth.uid())
) with check (
  exists (select 1 from public.cars c where c.id = maintenance_schedules.car_id and c.user_id = auth.uid())
);

create policy "logs_all_own_car" on public.maintenance_logs for all using (
  exists (select 1 from public.cars c where c.id = maintenance_logs.car_id and c.user_id = auth.uid())
) with check (
  exists (select 1 from public.cars c where c.id = maintenance_logs.car_id and c.user_id = auth.uid())
);

create policy "chat_sessions_own" on public.chat_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "chat_messages_own_session" on public.chat_messages for all using (
  exists (select 1 from public.chat_sessions s where s.id = chat_messages.session_id and s.user_id = auth.uid())
) with check (
  exists (select 1 from public.chat_sessions s where s.id = chat_messages.session_id and s.user_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- New user -> profile
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('manuals', 'manuals', false), ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

-- Path: {user_id}/{...}
create policy "manuals_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'manuals' and split_part(name, '/', 1) = auth.uid()::text);

create policy "manuals_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'manuals' and split_part(name, '/', 1) = auth.uid()::text);

create policy "manuals_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'manuals' and split_part(name, '/', 1) = auth.uid()::text);

create policy "manuals_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'manuals' and split_part(name, '/', 1) = auth.uid()::text);

create policy "chat_attach_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments' and split_part(name, '/', 1) = auth.uid()::text);

create policy "chat_attach_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments' and split_part(name, '/', 1) = auth.uid()::text);

create policy "chat_attach_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments' and split_part(name, '/', 1) = auth.uid()::text);
