-- my_invite_step (20261028095359): the invited member reads their own next
-- step toward counting, and nobody else reads anything.
--   1. a member who was not invited reads null;
--   2. an invited member with no confirmed phone reads 'phone';
--   3. once the phone is confirmed and the profile finished they read null
--      (the referral has qualified);
--   4. the referrer reads null for the same referral (it is the invitee's own step);
--   5. anon cannot run it.
-- All rolled back by the final raise.
do $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  this_month date := date_trunc('month', now() at time zone 'Africa/Lagos')::date;
  tag text := replace(left(gen_random_uuid()::text, 8), '-', '');
  referrer uuid := gen_random_uuid();
  invitee uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid();
  inv_code text := '';
  v text; i int; step text; ok boolean;
begin
  insert into public.referral_budget_periods as b (period_month, cap_minor, reason)
  values (this_month, 1000000, 'probe: this month''s budget for this transaction')
  on conflict (period_month) do update set cap_minor = b.cap_minor + 1000000;

  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
  values (referrer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-step-ref-' || tag || '@example.invalid', '{}', '{"first_name": "Rita", "terms_version": "probe"}', now(), now(), now());
  for i in 1..20 loop
    inv_code := '';
    for v in select substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1) from generate_series(1, 6) loop
      inv_code := inv_code || v;
    end loop;
    exit when not exists (select 1 from public.referral_codes where referral_codes.code = inv_code);
  end loop;
  insert into public.referral_codes (user_id, code) values (referrer, inv_code);

  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
  values (invitee, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-step-inv-' || tag || '@example.invalid', '{}',
          jsonb_build_object('referral_code', inv_code, 'first_name', 'Ada', 'terms_version', 'probe'), now(), now(), now());
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
  values (stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-step-str-' || tag || '@example.invalid', '{}', '{"first_name": "Sam", "terms_version": "probe"}', now(), now(), now());
  insert into public.profiles (id, first_name, terms_accepted_at, terms_version)
  values (invitee, 'Ada', now(), 'probe') on conflict (id) do update
     set first_name = 'Ada', terms_accepted_at = coalesce(public.profiles.terms_accepted_at, now()), terms_version = 'probe';

  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  if public.my_invite_step() is not null then
    raise exception 'PROBE_FAIL my-invite-step: a member who was not invited read a step';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', invitee, 'role', 'authenticated')::text, true);
  step := public.my_invite_step();
  if step is distinct from 'phone' then
    raise exception 'PROBE_FAIL my-invite-step: an invited member with no confirmed phone reads %, not phone', step;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', referrer, 'role', 'authenticated')::text, true);
  if public.my_invite_step() is not null then
    raise exception 'PROBE_FAIL my-invite-step: the referrer read the invitee''s step';
  end if;

  insert into public.confirmed_phones (user_id, phone)
  values (invitee, '+23480' || (10000000 + floor(random() * 89999999))::bigint);
  perform set_config('request.jwt.claims', json_build_object('sub', invitee, 'role', 'authenticated')::text, true);
  if public.my_invite_step() is not null then
    raise exception 'PROBE_FAIL my-invite-step: a counted member still reads a step';
  end if;

  ok := has_function_privilege('anon', 'public.my_invite_step()', 'execute');
  if ok then raise exception 'PROBE_FAIL my-invite-step: anon can run it'; end if;

  raise exception 'PROBE_ROLLBACK my-invite-step: all five checks passed';
end $$;
