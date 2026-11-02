-- Validate the new contact number checks against the existing rows.
set lock_timeout = '5s';
alter table public.bookings validate constraint bookings_guest_phone_e164_chk;
alter table public.businesses validate constraint businesses_phone_e164_chk;
alter table public.businesses validate constraint businesses_representative_phone_e164_chk;
alter table public.listing_mandates validate constraint listing_mandates_principal_phone_e164_chk;
alter table public.agent_applications validate constraint agent_applications_phone_any_chk;
