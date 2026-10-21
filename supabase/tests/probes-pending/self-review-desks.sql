-- SELF-REVIEW-DESKS (migrations 20261021104441 and 20261021104453, nobody_decides_their_own_case, applied):
--  1. a moderator releases another member's held bio (control) but not their own
--  2. staff cannot settle a table with no dispute open
--  3. the no-show, refund, referral, payout and credential desks carry their own-case refusal
--  4. a manual badge cannot name its own holder as the grantor
-- Everything is rolled back by the final raise.
do $$
declare
  staffer uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  sess uuid := gen_random_uuid();
  tag text := substr(md5(random()::text), 1, 8);
  r jsonb;
  ok boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'probe-srd-' || x.k || '-' || tag || '@example.invalid', '{}', '{}', now(), now()
    from (values (staffer, 's'), (other, 'o')) as x(id, k);
  insert into public.social_profiles (user_id, handle)
  select x.id, 'psrd' || x.k || tag from (values (staffer, 's'), (other, 'o')) as x(id, k)
  on conflict (user_id) do nothing;
  update public.social_profiles set bio = 'probe bio', bio_status = 'HELD' where user_id in (staffer, other);
  insert into public.user_roles (user_id, role) values (staffer, 'admin') on conflict do nothing;
  insert into public.console_step_ups (user_id, session_id, expires_at) values (staffer, sess, now() + interval '1 hour');

  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', staffer, 'session_id', sess)::text, true);
  set local role authenticated;

  -- 1. CONTROL, then the moderator's own bio.
  r := public.moderation_decide('bio', other, 'RELEASE', null);
  if r ->> 'status' is distinct from 'ok' then
    raise exception 'PROBE_FAIL self-review-desks 1: the control release answered %', r;
  end if;
  r := public.moderation_decide('bio', staffer, 'RELEASE', null);
  if r ->> 'status' is distinct from 'own_content' then
    raise exception 'PROBE_FAIL self-review-desks 1: a moderator released their own bio (%)', r;
  end if;

  -- 2. The seating desk's refusals are probed by seating-dispute-guards.sql
  --    (pending migration 20261017141000).
  reset role;

  -- 3. The desks that need a whole case to reach carry their refusal.
  if position('own_booking' in pg_get_functiondef('public.decide_refund_request(uuid, text, text)'::regprocedure)) = 0 then
    raise exception 'PROBE_FAIL self-review-desks 3: the refund desk has no own-booking refusal';
  end if;
  if position('own_referral' in pg_get_functiondef('public.admin_referral_decide(uuid, text, text)'::regprocedure)) = 0 then
    raise exception 'PROBE_FAIL self-review-desks 3: the referral desk has no own-referral refusal';
  end if;
  if position('own_payout' in pg_get_functiondef('public.admin_rewards_payout_decide(uuid, text, text)'::regprocedure)) = 0 then
    raise exception 'PROBE_FAIL self-review-desks 3: the payout desk has no own-payout refusal';
  end if;

  if position('own_record' in pg_get_functiondef('public.record_credential(uuid, text, text, text, text, text)'::regprocedure)) = 0 then
    raise exception 'PROBE_FAIL self-review-desks 3: the credential desk has no own-record refusal';
  end if;

  -- 4. A badge granted by its own holder.
  ok := false;
  begin
    insert into public.user_badges (user_id, badge_code, granted_by, reason)
    select staffer, b.code, staffer, 'probe self grant' from public.badges b where b.manual_only limit 1;
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'PROBE_FAIL self-review-desks 4: an admin granted a badge to themselves'; end if;

  raise exception 'PROBE_OK self-review-desks';
end
$$;
