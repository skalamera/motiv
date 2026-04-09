-- Allow logged-in users to see which workshop library keys exist (names only; no chunk content).

create or replace function public.list_car_library_keys()
returns table (library_key text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct c.library_key
  from public.car_library_chunks c
  order by 1;
$$;

revoke all on function public.list_car_library_keys() from public;
grant execute on function public.list_car_library_keys() to authenticated;

notify pgrst, 'reload schema';
