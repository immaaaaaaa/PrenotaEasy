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
