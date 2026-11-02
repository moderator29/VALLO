-- Contact numbers from every country (2 November 2026): booking contacts, business and
-- representative numbers, listing mandates and agent applications accept any E.164
-- mobile. The application reads numbers with lib/phone.ts (Nigeria first, then every
-- country through lib/phone-intl.ts). The agent_applications check also keeps the old
-- Nigerian spellings it allowed.
set lock_timeout = '5s';
alter table public.bookings add constraint bookings_guest_phone_e164_chk
  check (guest_phone is null or guest_phone ~ '^\+[1-9][0-9]{6,14}$') not valid;
alter table public.businesses add constraint businesses_phone_e164_chk
  check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$') not valid;
alter table public.businesses add constraint businesses_representative_phone_e164_chk
  check (representative_phone is null or representative_phone ~ '^\+[1-9][0-9]{6,14}$') not valid;
alter table public.listing_mandates add constraint listing_mandates_principal_phone_e164_chk
  check (principal_phone is null or principal_phone ~ '^\+[1-9][0-9]{6,14}$') not valid;
alter table public.agent_applications add constraint agent_applications_phone_any_chk
  check (phone is null or phone ~ '^(\+?234|0)\d{10}$' or phone ~ '^\+[1-9][0-9]{6,14}$') not valid;
