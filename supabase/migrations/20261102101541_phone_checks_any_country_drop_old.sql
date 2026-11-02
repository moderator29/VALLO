-- Drop the Nigerian-only checks on the two confirmation tables.
set lock_timeout = '5s';
alter table public.confirmed_phones drop constraint if exists confirmed_phones_phone_check;
alter table private.phone_otps drop constraint if exists phone_otps_phone_check;
