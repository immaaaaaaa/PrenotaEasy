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
