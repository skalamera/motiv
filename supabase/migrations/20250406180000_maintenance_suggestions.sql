-- Saved AI "next service" suggestions per vehicle; completing one creates a maintenance_log.

create table public.maintenance_suggestions (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  headline text not null,
  primary_service text not null,
  rationale text,
  urgency text not null check (urgency in ('routine', 'soon', 'due_now')),
  estimated_miles_remaining int,
  related_schedule_task text,
  caveats text,
  created_at timestamptz not null default now()
);

create index maintenance_suggestions_car_id_idx on public.maintenance_suggestions (car_id);

alter table public.maintenance_suggestions enable row level security;

create policy "maintenance_suggestions_all_own_car" on public.maintenance_suggestions
  for all using (
    exists (
      select 1 from public.cars c
      where c.id = maintenance_suggestions.car_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cars c
      where c.id = maintenance_suggestions.car_id and c.user_id = auth.uid()
    )
  );

comment on table public.maintenance_suggestions is
  'User-saved AI next-service recommendations; mark complete inserts maintenance_logs and removes the row.';
