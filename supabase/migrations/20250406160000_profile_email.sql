alter table public.profiles add column if not exists email text;

-- Update existing profiles with their email from auth.users
update public.profiles p
set email = au.email
from auth.users au
where p.id = au.id;

drop function if exists public.search_users_by_email(text);

create or replace function public.search_users_by_email(search_email text)
returns table(id uuid, display_name text, avatar_url text, email text)
security definer set search_path = public
as $$
begin
  return query
  select p.id, p.display_name, p.avatar_url, p.email
  from public.profiles p
  where p.email ilike search_email;
end;
$$ language plpgsql;

-- Trigger to auto insert/update email on profile when user changes email or is created
create or replace function public.handle_new_user()
returns trigger
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute procedure public.handle_new_user();
