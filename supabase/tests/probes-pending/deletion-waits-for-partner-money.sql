-- DELETION-WAITS-FOR-PARTNER-MONEY (migration 20261021104410_deletion_waits_for_partner_money_and_rewards, applied):
--  1. CONTROL: a new account answers the three new numbers at zero and is not blocked
--  2. a rewards payout on its way to the bank blocks the deletion
-- (Partner-held money needs a whole agreement to stand up; the predicate is read
--  against the live status check before applying, as the migration header says.)
-- Everything is rolled back by the final raise.
do $$
declare
  a   uuid := gen_random_uuid();
  tag text := substr(md5(random()::text), 1, 8);
  v   jsonb;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-dwp-' || tag || '@example.invalid', '{}', '{}', now(), now());
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- 1. CONTROL.
  v := public.account_deletion_blockers(a);
  if (v ->> 'partner_held_minor')::bigint is distinct from 0
     or (v ->> 'rewards_withdrawable_minor')::bigint is distinct from 0
     or (v ->> 'rewards_payouts_in_flight')::integer is distinct from 0
     or (v ->> 'blocked')::boolean then
    raise exception 'PROBE_FAIL deletion-waits-for-partner-money 1: a clean account read as %', v;
  end if;

  -- 2. A payout in flight.
  insert into public.rewards_payouts (member_id, amount_minor, reference, status, bank_code, account_last4, account_name)
  values (a, 150000, 'probe-dwp-' || gen_random_uuid(), 'processing', '058', '1111', 'PROBE');
  v := public.account_deletion_blockers(a);
  if (v ->> 'rewards_payouts_in_flight')::integer is distinct from 1 or not (v ->> 'blocked')::boolean then
    raise exception 'PROBE_FAIL deletion-waits-for-partner-money 2: a payout in flight read as %', v;
  end if;

  raise exception 'PROBE_OK deletion-waits-for-partner-money';
end
$$;
