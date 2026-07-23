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

  insert into public.businesses (id, owner_id, name, slug, timezone, phone, address)
  values (biz, null, 'Salone Bellezza Demo', 'demo', tz, '+39 06 1234567', 'Via Roma 1, Roma');

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
