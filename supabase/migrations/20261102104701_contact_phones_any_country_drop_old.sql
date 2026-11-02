-- Drop the Nigerian-only contact number checks replaced in 20261102104659.
set lock_timeout = '5s';
alter table public.bookings drop constraint if exists bookings_guest_phone_shape_chk;
alter table public.businesses drop constraint if exists businesses_phone_check;
alter table public.businesses drop constraint if exists businesses_representative_phone_check;
alter table public.listing_mandates drop constraint if exists listing_mandates_principal_phone_check;
alter table public.agent_applications drop constraint if exists agent_applications_phone_chk;
