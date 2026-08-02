-- PrenotaEasy — initial schema
-- Run this in your Supabase project's SQL editor (Dashboard → SQL Editor → New query).
-- Weekday convention: 0 = Monday, 1 = Tuesday, ... 6 = Sunday (Italian week).

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.businesses (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users (id) on delete set null,
  name          text not null,
  slug          text not null unique,
  timezone      text not null default 'Europe/Rome',
  phone         text,
  address       text,
  -- Booking behaviour (sensible defaults; not required during onboarding).
  slot_step_min     int  not null default 15,
  booking_lead_min  int  not null default 0,   -- min minutes between now and a bookable slot
  booking_horizon_days int not null default 30,
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.business_hours (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  weekday      int  not null check (weekday between 0 and 6),
  is_closed    boolean not null default false,
  open_time    time,
  close_time   time,
  break_start  time,   -- optional lunch/afternoon break
  break_end    time,
  unique (business_id, weekday)
);

create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  duration_min int  not null check (duration_min > 0),
  price_cents  int  not null default 0 check (price_cents >= 0),
  sort         int  not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.employees (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  color        text not null default '#c24e63',
  sort         int  not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.customers (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  phone        text not null,           -- stored in E.164 where possible (e.g. +39...)
  created_at   timestamptz not null default now(),
  unique (business_id, phone)
);

create table if not exists public.appointments (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  employee_id   uuid not null references public.employees (id) on delete cascade,
  service_id    uuid references public.services (id) on delete set null,
  customer_id   uuid references public.customers (id) on delete set null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        text not null default 'booked'
                check (status in ('booked', 'cancelled', 'completed', 'no_show')),
  source        text not null default 'client' check (source in ('client', 'owner')),
  notes         text,
  -- Snapshots so history stays stable if a service/customer is later edited.
  service_name  text not null,
  duration_min  int  not null,
  price_cents   int  not null default 0,
  customer_name text not null,
  customer_phone text not null,
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists appointments_biz_emp_start_idx
  on public.appointments (business_id, employee_id, starts_at);
create index if not exists appointments_biz_start_idx
  on public.appointments (business_id, starts_at);

-- Hard guarantee: no two active appointments overlap for the same employee.
alter table public.appointments
  drop constraint if exists appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    employee_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Public booking happens server-side with the service_role key (bypasses RLS),
-- so anon clients get NO direct table access. Owners reach their own rows only.
-- ---------------------------------------------------------------------------

alter table public.businesses     enable row level security;
alter table public.business_hours enable row level security;
alter table public.services       enable row level security;
alter table public.employees      enable row level security;
alter table public.customers      enable row level security;
alter table public.appointments   enable row level security;

-- businesses: owner scoped
create policy "businesses_select_own" on public.businesses
  for select using (owner_id = auth.uid());
create policy "businesses_insert_own" on public.businesses
  for insert with check (owner_id = auth.uid());
create policy "businesses_update_own" on public.businesses
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "businesses_delete_own" on public.businesses
  for delete using (owner_id = auth.uid());

-- Child tables: owner of the parent business can do everything.
create policy "hours_owner_all" on public.business_hours
  for all using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

create policy "services_owner_all" on public.services
  for all using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

create policy "employees_owner_all" on public.employees
  for all using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

create policy "customers_owner_all" on public.customers
  for all using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

create policy "appointments_owner_all" on public.appointments
  for all using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

-- ===== SEED (demo salon) =====
-- PrenotaEasy — demo seed data
-- Run AFTER 0001_init.sql. Creates an unclaimed demo salon reachable at /b/demo
-- so you can try the client booking flow immediately.
-- Safe to re-run: it clears and recreates the demo business only.

do $$
declare
  biz uuid := '11111111-1111-1111-1111-111111111111';
  emp_giulia uuid := '22222222-2222-2222-2222-222222222201';
  emp_marco  uuid := '22222222-2222-2222-2222-222222222202';
  svc_taglio uuid := '33333333-3333-3333-3333-333333333301';
  svc_piega  uuid := '33333333-3333-3333-3333-333333333302';
  cust uuid := '44444444-4444-4444-4444-444444444401';
  tz text := 'Europe/Rome';
begin
  delete from public.businesses where id = biz;  -- cascades to children

  insert into public.businesses (id, owner_id, name, slug, timezone, phone, address, onboarded)
  values (biz, null, 'Salone Bellezza Demo', 'demo', tz, '+39 06 1234567', 'Via Roma 1, Roma', true);

  -- Hours: Mon–Fri 09:00–19:00 with 13:00–14:30 break, Sat 09:00–18:00, Sun closed.
  insert into public.business_hours (business_id, weekday, is_closed, open_time, close_time, break_start, break_end) values
    (biz, 0, false, '09:00', '19:00', '13:00', '14:30'),
    (biz, 1, false, '09:00', '19:00', '13:00', '14:30'),
    (biz, 2, false, '09:00', '19:00', '13:00', '14:30'),
    (biz, 3, false, '09:00', '19:00', '13:00', '14:30'),
    (biz, 4, false, '09:00', '19:00', '13:00', '14:30'),
    (biz, 5, false, '09:00', '18:00', null, null),
    (biz, 6, true,  null, null, null, null);

  insert into public.services (id, business_id, name, duration_min, price_cents, sort) values
    (svc_taglio, biz, 'Taglio donna', 45, 3000, 0),
    (svc_piega,  biz, 'Piega',        30, 2000, 1),
    (gen_random_uuid(), biz, 'Taglio uomo',   30, 2000, 2),
    (gen_random_uuid(), biz, 'Colore',        90, 6500, 3),
    (gen_random_uuid(), biz, 'Barba',         20, 1500, 4);

  insert into public.employees (id, business_id, name, color, sort) values
    (emp_giulia, biz, 'Giulia', '#c24e63', 0),
    (emp_marco,  biz, 'Marco',  '#4c7bd0', 1);

  insert into public.customers (id, business_id, name, phone) values
    (cust, biz, 'Anna Rossi', '+393401234567');

  -- A couple of appointments today so the agenda isn't empty.
  insert into public.appointments
    (business_id, employee_id, service_id, customer_id, starts_at, ends_at,
     source, service_name, duration_min, price_cents, customer_name, customer_phone)
  values
    (biz, emp_giulia, svc_taglio, cust,
     (current_date + time '10:00') at time zone tz,
     (current_date + time '10:45') at time zone tz,
     'client', 'Taglio donna', 45, 3000, 'Anna Rossi', '+393401234567'),
    (biz, emp_marco, svc_piega, cust,
     (current_date + time '11:30') at time zone tz,
     (current_date + time '12:00') at time zone tz,
     'client', 'Piega', 30, 2000, 'Anna Rossi', '+393401234567');
end $$;
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
-- ===========================================================================
-- Optional add-ons per service (additive, backwards compatible)
-- - service_addons: 1-to-many with services; each has extra time and price
-- - appointments.addons: jsonb snapshot of the add-ons chosen at booking time
--   (appointments keep their history even if add-ons are edited/removed later)
-- ===========================================================================

create table if not exists public.service_addons (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  service_id        uuid not null references public.services (id) on delete cascade,
  name              text not null,
  extra_min         int  not null default 0 check (extra_min >= 0),
  extra_price_cents int  not null default 0 check (extra_price_cents >= 0),
  sort              int  not null default 0,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists service_addons_service_idx
  on public.service_addons (service_id);

alter table public.appointments
  add column if not exists addons jsonb;

alter table public.service_addons enable row level security;

create policy "service_addons_owner_all" on public.service_addons
  for all using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));
-- ===========================================================================
-- Security hardening
-- 1. Formalize operator_pages_enabled (was added by hand: schema drift)
-- 2. Guard trigger on businesses: clients with anon/authenticated JWTs
--    (i.e. the browser, even the owner's session) cannot change privileged
--    columns. The service role (server APIs, master admin) and direct SQL
--    keep full access.
--    - slug: changing it would break every QR code and link already printed
--    - operator_pages_enabled: the premium flag must not be self-serviceable
-- ===========================================================================

alter table public.businesses
  add column if not exists operator_pages_enabled boolean not null default false;

create or replace function public.businesses_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  -- Only guard end-user JWTs; service_role and direct SQL pass through.
  if jwt_role in ('anon', 'authenticated') then
    if new.slug is distinct from old.slug
       or new.operator_pages_enabled is distinct from old.operator_pages_enabled then
      raise exception 'Modifica non consentita';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_guard_trg on public.businesses;
create trigger businesses_guard_trg
  before update on public.businesses
  for each row execute function public.businesses_guard();
