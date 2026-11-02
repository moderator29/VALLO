-- Phone confirmation for every country (2 November 2026). The code issuer accepted
-- only a Nigerian mobile; it now accepts any E.164 number (+, a non-zero digit, 6 to
-- 14 more digits). Nigerian numbers still go through Termii and the rest through Twilio
-- in the application layer.
set lock_timeout = '5s';
create or replace function public.phone_otp_issue(p_user uuid, p_phone text, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if p_user is null or p_phone !~ '^\+[1-9][0-9]{6,14}$' or p_code !~ '^[0-9]{6}$' then
    return 'invalid';
  end if;
  if exists (select 1 from public.confirmed_phones c where c.phone = p_phone and c.user_id <> p_user) then
    return 'taken';
  end if;
  if exists (select 1 from public.confirmed_phones c where c.phone = p_phone and c.user_id = p_user) then
    return 'already';
  end if;
  insert into private.phone_otps (user_id, phone, code_hash, expires_at, attempts, created_at)
  values (
    p_user, p_phone,
    encode(extensions.digest(p_user::text || ':' || p_code, 'sha256'), 'hex'),
    now() + interval '10 minutes', 0, now()
  )
  on conflict (user_id) do update
    set phone = excluded.phone, code_hash = excluded.code_hash,
        expires_at = excluded.expires_at, attempts = 0, created_at = now();
  return 'issued';
end;
$fn$;
