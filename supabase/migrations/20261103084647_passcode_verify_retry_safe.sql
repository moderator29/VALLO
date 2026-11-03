set lock_timeout = '5s';

-- A PASSCODE CHECK THAT CAN BE RETRIED (2 November 2026). On a weak
-- connection the answer to a right or wrong code can be lost on its way back,
-- and the app now asks again rather than giving up. Asking again must not
-- count the same typed code twice, so each typed code carries an attempt id:
-- the same id within two minutes gets the same answer, uncounted. Only the
-- member's latest attempt is remembered (one row each). The one-argument
-- passcode_verify is unchanged.
create table if not exists private.passcode_last_attempts (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  attempt_id  uuid not null,
  outcome     jsonb not null,
  at          timestamptz not null default now()
);
revoke all on private.passcode_last_attempts from public, anon, authenticated;

create or replace function public.passcode_verify(p_code text, p_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_last private.passcode_last_attempts%rowtype;
  v_outcome jsonb;
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = '42501';
  end if;
  if p_attempt is null then
    return private.passcode_attempt(v_uid, p_code);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('passcode_verify:' || v_uid::text, 0));
  select * into v_last from private.passcode_last_attempts where user_id = v_uid;
  if v_last.user_id is not null and v_last.attempt_id = p_attempt and v_last.at > now() - interval '2 minutes' then
    return v_last.outcome || jsonb_build_object('repeated', true);
  end if;
  v_outcome := private.passcode_attempt(v_uid, p_code);
  insert into private.passcode_last_attempts (user_id, attempt_id, outcome, at)
  values (v_uid, p_attempt, v_outcome, now())
  on conflict (user_id) do update set attempt_id = excluded.attempt_id, outcome = excluded.outcome, at = excluded.at;
  return v_outcome;
end;
$fn$;
revoke all on function public.passcode_verify(text, uuid) from public, anon;
grant execute on function public.passcode_verify(text, uuid) to authenticated;
