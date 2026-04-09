-- Allow schedule rows from "import tasks" flow

alter table public.maintenance_schedules
  drop constraint if exists maintenance_schedules_source_check;

alter table public.maintenance_schedules
  add constraint maintenance_schedules_source_check
  check (source in ('manual', 'web', 'custom', 'user_provided'));

notify pgrst, 'reload schema';
