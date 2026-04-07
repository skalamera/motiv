-- Allow authenticated users to view profiles so friend requests and event invites can resolve display names
drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_all" on public.profiles
  for select to authenticated
  using (true);
