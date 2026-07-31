-- ===========================================================================
-- Fixed booking slots per service (additive, backwards compatible)
-- - services.booking_mode: 'auto' (default, current behaviour) | 'fixed_slots'
-- - service_slots: weekly recurring pattern (weekday + time + optional operator)
-- - service_slot_exceptions: per-date removals of a recurring slot or one-off
--   extra slots that do not recur
-- ===========================================================================

alter table public.services
  add column if not exists booking_mode text not null default 'auto'
  check (booking_mode in ('auto', 'fixed_slots'));

create table if not exists public.service_slots (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  service_id   uuid not null references public.services (id) on delete cascade,
  weekday      int  not null check (weekday between 0 and 6), -- 0 = Monday … 6 = Sunday
  start_time   time not null,
  employee_id  uuid references public.employees (id) on delete set null, -- null = any operator
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.service_slot_exceptions (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  service_id   uuid not null references public.services (id) on delete cascade,
  date         date not null,
  kind         text not null check (kind in ('removed', 'extra')),
  -- 'removed': hides the referenced recurring slot on that date
  slot_id      uuid references public.service_slots (id) on delete cascade,
  -- 'extra': a one-off slot on that date only
  start_time   time,
  employee_id  uuid references public.employees (id) on delete set null,
  created_at   timestamptz not null default now(),
  check (
    (kind = 'removed' and slot_id is not null)
    or (kind = 'extra' and start_time is not null)
  )
);

create index if not exists service_slots_service_idx
  on public.service_slots (service_id, weekday);
create index if not exists service_slot_exceptions_service_date_idx
  on public.service_slot_exceptions (service_id, date);

alter table public.service_slots enable row level security;
alter table public.service_slot_exceptions enable row level security;

-- Same model as the other child tables: public booking goes through the
-- service_role key server-side; owners manage their own rows.
create policy "service_slots_owner_all" on public.service_slots
  for all using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

create policy "service_slot_exceptions_owner_all" on public.service_slot_exceptions
  for all using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));
