-- Body style and drivetrain (garage + AI hero image prompt context)

alter table public.cars
  add column if not exists body_type text,
  add column if not exists drivetrain text;

comment on column public.cars.body_type is
  'Body style: Coupe, Sedan, Convertible, SUV, Pick-up, Hatchback (optional).';
comment on column public.cars.drivetrain is
  'Drivetrain: 4WD, AWD, FWD, RWD (optional).';

notify pgrst, 'reload schema';
