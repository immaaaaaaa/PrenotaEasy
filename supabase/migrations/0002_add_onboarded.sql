-- Migration: Add onboarded column to businesses
alter table public.businesses add column if not exists onboarded boolean not null default false;

-- Mark any existing businesses (e.g. demo) as onboarded
update public.businesses set onboarded = true;
