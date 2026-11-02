-- Validate the new checks against the existing rows.
set lock_timeout = '5s';
alter table public.confirmed_phones validate constraint confirmed_phones_e164_chk;
alter table private.phone_otps validate constraint phone_otps_e164_chk;
