-- Library "Other" documents (PDFs and images)

alter table public.manuals drop constraint if exists manuals_manual_kind_check;

alter table public.manuals
  add constraint manuals_manual_kind_check
  check (manual_kind in ('owner', 'maintenance', 'other'));

notify pgrst, 'reload schema';
