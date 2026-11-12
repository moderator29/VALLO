-- SUBSCRIPTION-UNMATCHED-EVENT-CAN-RETRY (migration
-- supabase/migrations/pending/subscription_unmatched_event_2026-11-12.sql,
-- NOT APPLIED):
--  1. a delivery nothing on this platform can be matched to answers
--     `unmatched`, and so does the retry of that same delivery
--  2. the `unmatched` rows are still written, one per attempt, because they
--     are the forensic record of a delivery nobody could place
--  3. CONTROL: a delivery that WAS acted on still answers `duplicate` the
--     second time, which is what stops one charge being applied twice
--  4. CONTROL: an event type this function does not act on is still `ignored`
--     without writing anything
--
-- FAILS BEFORE THE MIGRATION on 1: `private.subscription_log` writes every
-- outcome, `unmatched` included, into `public.subscription_events` under
-- (provider, mode, event_key), which is exactly the key the function's replay
-- guard reads, so the retry answers `duplicate` and the delivery can never be
-- applied. The event key for a charge is `charge.success:<reference>`, the
-- same string on every redelivery by design, so this is permanent.
--
-- Everything is rolled back by the final raise.
do $$
declare
  tag  text := substr(md5(random()::text), 1, 12);
  key  text;
  v    jsonb;
  n    integer;
  u    uuid := gen_random_uuid();
  plan public.entitlement_plans;
  code text;
  opened jsonb;
  ref  text;
begin
  -- 1 and 2: a charge under a customer and plan that match nothing here.
  key := 'charge.success:probe-sub-' || tag;
  v := public.subscription_apply_event('test', 'charge.success', key,
         jsonb_build_object('reference', 'probe-sub-' || tag,
                            'amount_minor', 500000, 'currency', 'NGN',
                            'customer_code', 'CUS_probe' || tag,
                            'plan_code', 'PLN_probe' || tag));
  if v ->> 'outcome' is distinct from 'unmatched' then
    raise exception 'PROBE_FAIL subscription-unmatched-event-can-retry 1a: first delivery read as %', v;
  end if;

  v := public.subscription_apply_event('test', 'charge.success', key,
         jsonb_build_object('reference', 'probe-sub-' || tag,
                            'amount_minor', 500000, 'currency', 'NGN',
                            'customer_code', 'CUS_probe' || tag,
                            'plan_code', 'PLN_probe' || tag));
  if v ->> 'outcome' is distinct from 'unmatched' then
    raise exception 'PROBE_FAIL subscription-unmatched-event-can-retry 1b: the retry read as % '
                    || 'rather than unmatched, so a paid renewal that arrives before the row that '
                    || 'identifies it can never be applied', v;
  end if;

  select count(*) into n from public.subscription_events e
   where e.provider = 'paystack' and e.mode = 'test' and e.event_key = key;
  if n < 2 then
    raise exception 'PROBE_FAIL subscription-unmatched-event-can-retry 2: % unmatched rows for two attempts', n;
  end if;
  if exists (select 1 from public.subscription_events e
              where e.provider = 'paystack' and e.mode = 'test' and e.event_key = key
                and e.outcome <> 'unmatched') then
    raise exception 'PROBE_FAIL subscription-unmatched-event-can-retry 2b: an unmatched key carries another outcome';
  end if;

  -- 3: CONTROL. A real checkout through the same doors the app uses, so the
  -- SAME key is matched and acted on, and the second arrival is a duplicate.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-sub-' || tag || '@example.invalid', '{}', '{}', now(), now());
  select p.* into plan from public.entitlement_plans p
   where not p.is_default and p.price_minor is not null and p.price_minor > 0
     and p.billing_interval = 'month' and p.effective_from <= now()
     and (p.effective_to is null or p.effective_to > now())
   order by p.effective_from desc limit 1;
  if plan.id is null then
    raise exception 'PROBE_FAIL subscription-unmatched-event-can-retry 3: no plan is on sale to buy';
  end if;
  code := public.subscription_provider_plan_record(plan.plan_key, 'test', 'PLN_probe' || tag, plan.price_minor);
  if code is null then
    raise exception 'PROBE_FAIL subscription-unmatched-event-can-retry 3: no provider plan code for %', plan.plan_key;
  end if;
  opened := public.subscription_checkout_open(u, plan.plan_key, 'test', code, plan.price_minor, repeat('a', 64));
  if (opened ->> 'ok')::boolean is not true then
    raise exception 'PROBE_FAIL subscription-unmatched-event-can-retry 3: the checkout would not open: %', opened;
  end if;
  ref := opened ->> 'reference';

  key := 'charge.success:' || ref;
  v := public.subscription_apply_event('test', 'charge.success', key,
         jsonb_build_object('reference', ref, 'amount_minor', plan.price_minor, 'currency', 'NGN',
                            'customer_code', 'CUS_probe' || tag));
  if v ->> 'outcome' is distinct from 'applied' then
    raise exception 'PROBE_FAIL subscription-unmatched-event-can-retry 3a: a real charge read as %', v;
  end if;
  v := public.subscription_apply_event('test', 'charge.success', key,
         jsonb_build_object('reference', ref, 'amount_minor', plan.price_minor, 'currency', 'NGN',
                            'customer_code', 'CUS_probe' || tag));
  if v ->> 'outcome' is distinct from 'duplicate' then
    raise exception 'PROBE_FAIL subscription-unmatched-event-can-retry 3b: a charge already applied read as % '
                    || 'on its second arrival, which would apply one payment twice', v;
  end if;

  -- 4: CONTROL. An event this function does not act on writes nothing.
  v := public.subscription_apply_event('test', 'charge.dispute.create', 'probe-ignored-' || tag, '{}'::jsonb);
  if v ->> 'outcome' is distinct from 'ignored' then
    raise exception 'PROBE_FAIL subscription-unmatched-event-can-retry 4: an unhandled event read as %', v;
  end if;
  if exists (select 1 from public.subscription_events e where e.event_key = 'probe-ignored-' || tag) then
    raise exception 'PROBE_FAIL subscription-unmatched-event-can-retry 4b: an unhandled event was recorded';
  end if;

  raise exception 'PROBE_OK subscription-unmatched-event-can-retry';
end
$$;
