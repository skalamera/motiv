-- Owner vs maintenance manual PDFs.
-- NOTIFY refreshes PostgREST so the API sees the new column immediately.

alter table public.manuals
  add column if not exists manual_kind text not null default 'owner';

alter table public.manuals drop constraint if exists manuals_manual_kind_check;
alter table public.manuals
  add constraint manuals_manual_kind_check
  check (manual_kind in ('owner', 'maintenance'));

notify pgrst, 'reload schema';
