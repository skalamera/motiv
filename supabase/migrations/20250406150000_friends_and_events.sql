create table public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  location_name text not null,
  location_address text,
  state_tag text,
  event_type_tag text,
  image_url text,
  created_at timestamptz not null default now()
);

create table public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, friend_id)
);

create table public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'attending', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, invitee_id)
);

-- RLS policies
alter table public.events enable row level security;
alter table public.friends enable row level security;
alter table public.event_invites enable row level security;

-- Events: anyone can see events they created or were invited to
create policy "events_select_own_or_invited" on public.events
  for select to authenticated
  using (
    creator_id = auth.uid() or
    exists (select 1 from public.event_invites where event_id = public.events.id and invitee_id = auth.uid())
  );

create policy "events_insert_own" on public.events
  for insert to authenticated
  with check (creator_id = auth.uid());

create policy "events_update_own" on public.events
  for update to authenticated
  using (creator_id = auth.uid());

create policy "events_delete_own" on public.events
  for delete to authenticated
  using (creator_id = auth.uid());

-- Friends: users can see friendships where they are user_id or friend_id
create policy "friends_select" on public.friends
  for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy "friends_insert" on public.friends
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "friends_update" on public.friends
  for update to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy "friends_delete" on public.friends
  for delete to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

-- Event Invites: users can see invites where they are the inviter or invitee
create policy "event_invites_select" on public.event_invites
  for select to authenticated
  using (inviter_id = auth.uid() or invitee_id = auth.uid());

create policy "event_invites_insert" on public.event_invites
  for insert to authenticated
  with check (inviter_id = auth.uid());

create policy "event_invites_update" on public.event_invites
  for update to authenticated
  using (invitee_id = auth.uid());

create policy "event_invites_delete" on public.event_invites
  for delete to authenticated
  using (inviter_id = auth.uid() or invitee_id = auth.uid());

-- RPC to search users by email securely
create or replace function public.search_users_by_email(search_email text)
returns table(id uuid, display_name text, avatar_url text)
security definer set search_path = public
as $$
begin
  return query
  select p.id, p.display_name, p.avatar_url
  from auth.users au
  join public.profiles p on p.id = au.id
  where au.email ilike search_email;
end;
$$ language plpgsql;

-- Also let's create a trigger to auto-add an entry into profiles if not present, but init.sql doesn't show one.
-- Assuming profiles are handled elsewhere, we'll just stick to the requested.
