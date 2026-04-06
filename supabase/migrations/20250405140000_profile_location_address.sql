-- Home / starting point for local scenic drive suggestions
alter table public.profiles
  add column if not exists location_address text;

comment on column public.profiles.location_address is 'User-entered home address for regional features (e.g. scenic drives).';
