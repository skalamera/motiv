-- Free-text label for service logs without a maintenance_schedules row (manual history entries).
alter table public.maintenance_logs
  add column if not exists title text;

comment on column public.maintenance_logs.title is
  'When schedule_id is set, task usually comes from maintenance_schedules; when null, title stores the user-entered service name.';
