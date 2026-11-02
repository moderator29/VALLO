-- Add the international shape check beside the old Nigerian-only one.
set lock_timeout = '5s';
alter table public.confirmed_phones
  add constraint confirmed_phones_e164_chk check (phone ~ '^\+[1-9][0-9]{6,14}$') not valid;
alter table private.phone_otps
  add constraint phone_otps_e164_chk check (phone ~ '^\+[1-9][0-9]{6,14}$') not valid;
