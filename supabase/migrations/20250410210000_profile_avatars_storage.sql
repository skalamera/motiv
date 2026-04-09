-- Public profile pictures: {user_id}/avatar.{ext}

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "profile_avatars_insert_own" on storage.objects;
drop policy if exists "profile_avatars_update_own" on storage.objects;
drop policy if exists "profile_avatars_delete_own" on storage.objects;
drop policy if exists "profile_avatars_public_read" on storage.objects;

create policy "profile_avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars' and split_part(name, '/', 1) = auth.uid()::text);

create policy "profile_avatars_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-avatars' and split_part(name, '/', 1) = auth.uid()::text);

create policy "profile_avatars_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and split_part(name, '/', 1) = auth.uid()::text);

create policy "profile_avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'profile-avatars');

notify pgrst, 'reload schema';
