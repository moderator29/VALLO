-- Run in the Supabase SQL editor (the connector stops for approval on functions that
-- contain DELETE). Second guard for "a confirmed number never changes": confirm_phone
-- refuses a code for a number other than the one already confirmed, and never
-- overwrites an existing confirmed number. phone_otp_issue already refuses to send such
-- a code (migration 20261102115531), so this is a belt to that brace.
set lock_timeout = '5s';
create or replace function public.confirm_phone(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uid uuid := auth.uid();
  otp private.phone_otps%rowtype;
begin
  if uid is null then return 'signed_out'; end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' then return 'wrong'; end if;

  select * into otp from private.phone_otps where user_id = uid for update;
  if not found then return 'no_code'; end if;
  if otp.expires_at < now() then
    delete from private.phone_otps where user_id = uid;
    return 'expired';
  end if;
  if otp.attempts >= 5 then
    delete from private.phone_otps where user_id = uid;
    return 'locked';
  end if;
  if otp.code_hash <> encode(extensions.digest(uid::text || ':' || p_code, 'sha256'), 'hex') then
    update private.phone_otps set attempts = attempts + 1 where user_id = uid;
    return 'wrong';
  end if;

  delete from private.phone_otps where user_id = uid;
  if exists (select 1 from public.confirmed_phones c where c.phone = otp.phone and c.user_id <> uid) then
    return 'taken';
  end if;
  if exists (select 1 from public.confirmed_phones c where c.user_id = uid and c.phone <> otp.phone) then
    return 'taken';
  end if;

  begin
    insert into public.confirmed_phones (user_id, phone, confirmed_at)
    values (uid, otp.phone, now())
    on conflict (user_id) do nothing;
  exception when unique_violation then
    return 'taken';
  end;

  if exists (select 1 from auth.users u where u.id = uid and u.email_confirmed_at is not null) then
    perform private.award_badge(uid, 'verified_member', 'Email and phone confirmed',
      jsonb_build_object('phone_confirmed_at', now()));
  end if;
  return 'confirmed';
end;
$fn$;
