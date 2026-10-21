-- D85 Invite and Earn, for supabase/migrations/20261008195310_d85_referral_signup_80_invite_and_earn.sql.
-- The founder's ruling of 8 October 2026 as the lead amended it: 80 naira
-- when the invited person signs up fully (email confirmed, terms accepted and
-- a first name set), no payment, no phone step until TERMII_SENDER_ID is set.
--
-- Proves, all rolled back by the final raise:
--   1. signup-80-phone is the one live consumer campaign; signup-80 and
--      launch-d51 are ended; the guard still refuses a campaign with no identity anchor;
--   2. a sign-up that carries a code is ATTRIBUTED at once (no phone needed);
--   3. one who completes phone + onboarding QUALIFIES at 8,000 kobo (an
--      email alone does not), waits
--      out the 7-day window (nothing available inside it), and after the
--      window becomes Available with an 8,000 kobo ledger entry;
--   4. one missing a step (phone never confirmed) does NOT qualify, and the
--      member reads "waiting on phone" for them;
--   5. finishing onboarding later qualifies through the profile trigger;
--   6. one phone cannot earn twice;
--   7. a provider sign-up (no metadata) records the invite through
--      referral_claim_code, and that call refuses its own code and an old
--      account;
--   8. members read progress only through the function; anon cannot.
-- Switches are set in this transaction only. Live flags are never asserted.
--
-- 17 October 2026, rebased on the founder's ruling of 13 October 2026 (D63 in
-- docs/RULINGS.md; migration 20261013172138_fx01_referral_counts_after_phone_verified):
-- an invited person counts only after they verify their phone number. fx01
-- ended signup-80 and started signup-80-phone, the same terms (8,000 kobo, a
-- 7 day window, the same cap) with requirement_keys ['phone_verified',
-- 'onboarding_completed'], and the confirmed phone is then always the identity
-- anchor. So step 1 now finds signup-80 ended and signup-80-phone the one live
-- consumer campaign; the step that qualifies is a confirmed phone, not a
-- confirmed email (an email alone is checked NOT to qualify); the missing
-- step in 4 is the phone (blocked on phone_not_verified, the member reads
-- "waiting on phone"); 5 and 7 have a confirmed phone; and 6 is one phone
-- earning once (the inbox rule now applies only without a phone, which this
-- campaign never allows). Every other assertion is unchanged.
-- fx01-referral-counts-after-phone-verified.sql proves the phone rule on its own.
do $$
declare
  alphabet   constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  this_month date := date_trunc('month', now() at time zone 'Africa/Lagos')::date;
  tag        text := replace(left(gen_random_uuid()::text, 8), '-', '');
  referrer   uuid := gen_random_uuid();
  full_user  uuid := gen_random_uuid();   -- does every step
  no_email   uuid := gen_random_uuid();   -- never confirms the email
  late_setup uuid := gen_random_uuid();   -- finishes onboarding last
  alias_user uuid := gen_random_uuid();   -- the same Gmail inbox as full_user
  oauth_user uuid := gen_random_uuid();   -- a provider sign-up with no metadata
  old_user   uuid := gen_random_uuid();   -- an account older than a day
  inv_code   text := '';
  camp       uuid;
  rid        uuid;
  st         text; v text; amt bigint; ok boolean; i int; res text;
  prog       record;
  phone_1    text := '+23480' || (10000000 + floor(random() * 89999999))::bigint;
begin
  -- ------------------------------------------------------------ 1. the campaign
  select id into camp from public.referral_campaigns
   where slug = 'signup-80-phone' and status = 'active' and kind = 'consumer' and reward_minor = 8000
     and requirement_keys = array['phone_verified', 'onboarding_completed'] and review_window = interval '7 days';
  if camp is null then raise exception 'PROBE_FAIL d85-referral-signup-80: signup-80-phone is not the live 8,000 kobo sign-up campaign'; end if;
  if exists (select 1 from public.referral_campaigns where slug = 'signup-80' and status <> 'ended') then
    raise exception 'PROBE_FAIL d85-referral-signup-80: signup-80 is still live';
  end if;
  if exists (select 1 from public.referral_campaigns where slug = 'launch-d51' and status <> 'ended') then
    raise exception 'PROBE_FAIL d85-referral-signup-80: launch-d51 is still live';
  end if;
  if (select count(*) from public.referral_campaigns where kind = 'consumer' and status = 'active') <> 1 then
    raise exception 'PROBE_FAIL d85-referral-signup-80: more than one consumer campaign is live';
  end if;
  ok := false;
  begin
    insert into public.referral_campaigns (slug, kind, title, reward_minor, member_cap_minor, review_window, requirement_keys, starts_at, reason)
    values ('probe-d85-anchorless', 'consumer', 'Probe', 8000, 16000, interval '1 day', array['onboarding_completed'], now(), 'probe: no identity anchor');
  exception when sqlstate 'RM421' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL d85-referral-signup-80: a campaign with neither phone nor email was saved'; end if;

  -- Room in this month's budget for this transaction only.
  insert into public.referral_budget_periods as b (period_month, cap_minor, reason)
  values (this_month, 1000000, 'probe: this month''s budget for this transaction')
  on conflict (period_month) do update set cap_minor = b.cap_minor + 1000000;

  -- ------------------------------------------------------- the inviting member
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
  values (referrer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-d85-ref-' || tag || '@example.invalid', '{}', '{"first_name": "Rita", "terms_version": "probe"}', now(), now(), now());
  for i in 1..20 loop
    inv_code := '';
    for v in select substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1) from generate_series(1, 6) loop
      inv_code := inv_code || v;
    end loop;
    exit when not exists (select 1 from public.referral_codes where referral_codes.code = inv_code);
  end loop;
  insert into public.referral_codes (user_id, code) values (referrer, inv_code);

  -- ------------------------------------------- 2. attributed at sign-up
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (full_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe.d85.' || tag || '+invite@gmail.com', '{}',
          jsonb_build_object('referral_code', lower(inv_code), 'first_name', 'Ada', 'terms_version', 'probe'), now(), now());
  select id, status into rid, st from public.referrals where referred_id = full_user;
  if rid is null or st <> 'attributed' then
    raise exception 'PROBE_FAIL d85-referral-signup-80: a sign-up with a code was not attributed at once (%)', st;
  end if;
  if not exists (select 1 from public.referrals where id = rid and referrer_id = referrer and campaign_id = camp) then
    raise exception 'PROBE_FAIL d85-referral-signup-80: the sign-up was attributed to the wrong member or campaign';
  end if;
  -- Onboarding is finished at sign-up here; the email is not confirmed yet.
  insert into public.profiles (id, first_name, terms_accepted_at, terms_version)
  values (full_user, 'Ada', now(), 'probe') on conflict (id) do update
     set first_name = 'Ada', terms_accepted_at = coalesce(public.profiles.terms_accepted_at, now()), terms_version = 'probe';
  if (select status from public.referrals where id = rid) <> 'attributed' then
    raise exception 'PROBE_FAIL d85-referral-signup-80: a referral qualified before the phone was confirmed';
  end if;
  -- An email alone never counts (13 October ruling).
  update auth.users set email_confirmed_at = now() where id = full_user;
  if (select status from public.referrals where id = rid) <> 'attributed' then
    raise exception 'PROBE_FAIL d85-referral-signup-80: a referral qualified on a confirmed email alone';
  end if;

  -- ------------------------------ 3. phone confirmed: qualifies at 8,000 kobo
  insert into public.confirmed_phones (user_id, phone) values (full_user, phone_1);
  select status, reward_minor into st, amt from public.referrals where id = rid;
  if st <> 'pending' or amt <> 8000 then
    raise exception 'PROBE_FAIL d85-referral-signup-80: a fully signed-up referral is % at % kobo, not pending at 8,000', st, amt;
  end if;
  if not exists (select 1 from public.referrals where id = rid and review_until = qualified_at + interval '7 days'
                   and qualifying_tx_id is null and referred_phone_key is not null and blocked_on is null) then
    raise exception 'PROBE_FAIL d85-referral-signup-80: qualification did not freeze the 7-day window and the identity, or recorded a payment';
  end if;
  -- Nothing is available inside the window.
  perform public.referral_release_due();
  if (select status from public.referrals where id = rid) <> 'pending'
     or exists (select 1 from public.rewards_ledger where referral_id = rid) then
    raise exception 'PROBE_FAIL d85-referral-signup-80: a reward became available inside its review window';
  end if;
  -- After the window: seven days are simulated by moving this one row's
  -- frozen window into the past with the guard stood down for one statement,
  -- in this transaction only.
  alter table public.referrals disable trigger referrals_guard;
  update public.referrals set review_until = now() - interval '1 second' where id = rid;
  alter table public.referrals enable trigger referrals_guard;
  perform public.referral_release_due();
  if (select status from public.referrals where id = rid) <> 'available' then
    raise exception 'PROBE_FAIL d85-referral-signup-80: after its window the reward is not available';
  end if;
  if not exists (select 1 from public.rewards_ledger where referral_id = rid and member_id = referrer
                   and kind = 'reward_earned' and amount_minor = 8000) then
    raise exception 'PROBE_FAIL d85-referral-signup-80: the Rewards Balance has no 8,000 kobo entry for the referral';
  end if;

  -- ------------------------------ 4. a missing step: the phone never confirmed
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (no_email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-d85-noemail-' || tag || '@example.invalid', '{}',
          jsonb_build_object('referral_code', inv_code, 'first_name', 'Bola', 'terms_version', 'probe'), now(), now());
  insert into public.profiles (id, first_name, terms_accepted_at, terms_version)
  values (no_email, 'Bola', now(), 'probe') on conflict (id) do update
     set first_name = 'Bola', terms_accepted_at = coalesce(public.profiles.terms_accepted_at, now()), terms_version = 'probe';
  v := private.referral_try_qualify(no_email);
  select status, blocked_on into st, v from public.referrals where referred_id = no_email;
  if st is distinct from 'attributed' or v is distinct from 'phone_not_verified' then
    raise exception 'PROBE_FAIL d85-referral-signup-80: without a confirmed phone the referral is % (%)', st, v;
  end if;
  perform public.referral_qualify_pending(5000);
  if (select status from public.referrals where referred_id = no_email) <> 'attributed' then
    raise exception 'PROBE_FAIL d85-referral-signup-80: the sweep qualified a referral missing its phone';
  end if;

  -- ---------------------------- 5. onboarding finished last: the profile trigger
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (late_setup, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-d85-late-' || tag || '@example.invalid', '{}', jsonb_build_object('referral_code', inv_code), now(), now());
  update auth.users set email_confirmed_at = now() where id = late_setup;
  insert into public.confirmed_phones (user_id, phone) values (late_setup, '+23481' || (10000000 + floor(random() * 89999999))::bigint);
  select status, blocked_on into st, v from public.referrals where referred_id = late_setup;
  if st is distinct from 'attributed' or v is distinct from 'onboarding_incomplete' then
    raise exception 'PROBE_FAIL d85-referral-signup-80: before onboarding the referral is % (%)', st, v;
  end if;
  insert into public.profiles (id, first_name, terms_accepted_at, terms_version)
  values (late_setup, 'Chika', null, null) on conflict (id) do nothing;
  update public.profiles set first_name = 'Chika', terms_accepted_at = now(), terms_version = 'probe' where id = late_setup;
  if (select status from public.referrals where referred_id = late_setup) <> 'pending' then
    raise exception 'PROBE_FAIL d85-referral-signup-80: finishing onboarding did not qualify the referral';
  end if;

  -- ------------------------------------- 6. one phone earns once
  -- The same person on a second account: the Gmail inbox of full_user (dots
  -- and a +tag), and full_user's phone, moved to this account (one account per
  -- phone, so it leaves full_user first). Rolled back.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
  values (alias_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probed85' || tag || '@googlemail.com', '{}',
          jsonb_build_object('referral_code', inv_code, 'first_name', 'Ade', 'terms_version', 'probe'), now(), now(), now());
  insert into public.profiles (id, first_name, terms_accepted_at, terms_version)
  values (alias_user, 'Ade', now(), 'probe') on conflict (id) do update
     set first_name = 'Ade', terms_accepted_at = coalesce(public.profiles.terms_accepted_at, now()), terms_version = 'probe';
  delete from public.confirmed_phones where user_id = full_user;
  insert into public.confirmed_phones (user_id, phone) values (alias_user, phone_1);
  perform private.referral_try_qualify(alias_user);
  if (select status from public.referrals where referred_id = alias_user) <> 'reversed' then
    raise exception 'PROBE_FAIL d85-referral-signup-80: one phone earned twice';
  end if;

  -- --------------------------- 7. a provider sign-up claims the kept invite
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
  values (oauth_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-d85-oauth-' || tag || '@example.invalid', '{"provider": "google"}', '{"full_name": "Dayo Probe"}', now(), now(), now());
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
  values (old_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-d85-old-' || tag || '@example.invalid', '{}', '{}', now() - interval '3 days', now(), now());
  if exists (select 1 from public.referrals where referred_id = oauth_user) then
    raise exception 'PROBE_FAIL d85-referral-signup-80: a sign-up with no code was attributed';
  end if;
  insert into public.profiles (id, first_name, terms_accepted_at, terms_version)
  values (oauth_user, 'Dayo', now(), 'probe') on conflict (id) do update
     set first_name = 'Dayo', terms_accepted_at = coalesce(public.profiles.terms_accepted_at, now()), terms_version = 'probe';
  insert into public.confirmed_phones (user_id, phone) values (oauth_user, '+23482' || (10000000 + floor(random() * 89999999))::bigint);

  perform set_config('request.jwt.claim.sub', oauth_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', oauth_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  res := public.referral_claim_code(inv_code);
  execute 'reset role';
  if res <> 'attributed' or (select status from public.referrals where referred_id = oauth_user) <> 'pending' then
    raise exception 'PROBE_FAIL d85-referral-signup-80: a provider sign-up could not claim its invite (%)', res;
  end if;

  perform set_config('request.jwt.claim.sub', referrer::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', referrer, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  res := public.referral_claim_code(inv_code);
  execute 'reset role';
  if res <> 'own_code' then raise exception 'PROBE_FAIL d85-referral-signup-80: a member claimed their own code (%)', res; end if;

  perform set_config('request.jwt.claim.sub', old_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', old_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  res := public.referral_claim_code(inv_code);
  execute 'reset role';
  if res <> 'too_late' then raise exception 'PROBE_FAIL d85-referral-signup-80: an old account claimed an invite (%)', res; end if;

  -- ------------------------------------- 8. what the inviting member reads
  perform set_config('request.jwt.claim.sub', referrer::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', referrer, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  ok := true;
  for prog in select * from public.my_referral_progress(50) loop
    if prog.id = rid and not (prog.stage = 'earned' and prog.earned_state = 'available' and prog.reward_minor = 8000
                              and prog.first_name = 'Ada') then ok := false; end if;
    if prog.first_name = 'Bola' and not (prog.stage = 'signing_up' and prog.waiting_on = 'phone') then ok := false; end if;
    if prog.first_name = 'Chika' and not (prog.stage = 'in_review' and prog.review_until > now()) then ok := false; end if;
    if prog.first_name = 'Ade' and not (prog.stage = 'not_eligible' and prog.not_eligible_reason = 'already_rewarded') then ok := false; end if;
  end loop;
  select count(*) into i from public.my_referral_progress(50);
  execute 'reset role';
  if not ok then raise exception 'PROBE_FAIL d85-referral-signup-80: the member''s progress does not say where each referral stands'; end if;
  if i <> 5 then raise exception 'PROBE_FAIL d85-referral-signup-80: the member reads % referrals, not their own 5', i; end if;

  if has_function_privilege('anon', 'public.my_referral_progress(int)', 'EXECUTE')
     or has_function_privilege('anon', 'public.referral_claim_code(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.referral_qualify_pending(int)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.referral_mailbox_key(uuid)', 'EXECUTE') then
    raise exception 'PROBE_FAIL d85-referral-signup-80: an API role can run a function it must not';
  end if;
  if has_table_privilege('authenticated', 'public.referrals', 'SELECT') then
    raise exception 'PROBE_FAIL d85-referral-signup-80: members read the referrals table directly';
  end if;

  raise exception 'PROBE_OK d85-referral-signup-80';
end $$;
