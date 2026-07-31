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
