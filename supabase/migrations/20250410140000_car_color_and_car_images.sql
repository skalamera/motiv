-- Car exterior color + public storage for hero photos (uploads & AI-generated)

alter table public.cars
  add column if not exists color text;

comment on column public.cars.color is 'Exterior color label for display and AI image prompts.';
comment on column public.cars.image_url is 'Public URL (e.g. Supabase car-images bucket) for dashboard / selectors.';

insert into storage.buckets (id, name, public)
values ('car-images', 'car-images', true)
on conflict (id) do update set public = excluded.public;

-- Writes only under {uid}/{car_id}/...; reads are public for <img> URLs.
create policy "car_images_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'car-images' and split_part(name, '/', 1) = auth.uid()::text);

create policy "car_images_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'car-images' and split_part(name, '/', 1) = auth.uid()::text);

create policy "car_images_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'car-images' and split_part(name, '/', 1) = auth.uid()::text);

-- Public read so <img src={image_url}> works without a session (URL is unguessable per car).
create policy "car_images_public_read"
  on storage.objects for select
  using (bucket_id = 'car-images');

notify pgrst, 'reload schema';
