-- POV04 (pending migrations pov01 to pov04): the choice RPC's rules.
--   only the payer; only a known word; a sale refuses card; a hotel room
--   refuses escrow; not once a payment is moving (any PENDING card attempt,
--   whatever its age, or a live arrangement) or the agreement is closed;
--   card on a system-approved agreement while a signal (here the incident
--   switch) fires goes to a person (in_review), never a dead end, and going
--   back to escrow is approved by the system again; the options read says
--   what may be picked; the router's read answers the same rail as the gate;
--   a card charge on a deal the partner holds is refund-due, never settled;
--   grants are explicit.
-- Everything is rolled back by the final raise.
do $$
declare
  guest constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  host  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  v_rental uuid; v_sale uuid; v_sale_owner uuid;
  b_rent uuid := gen_random_uuid();
  a_rent uuid := gen_random_uuid();
  a_sys uuid := gen_random_uuid();
  b_sys uuid := gen_random_uuid();
  a_sale uuid; insp uuid;
  a_pend uuid := gen_random_uuid();
  b_pend uuid := gen_random_uuid();
  ref text;
  st text;
  start_day date := (now() at time zone 'Africa/Lagos')::date + 40;
  r jsonb;
begin
  -- 17 October 2026: on the live database the example collection's agents row
  -- (e0000000-...-0002) no longer belongs to the example lister but to the QA
  -- member, who is the payer here, so every sale listing was the payer's own
  -- (the CI run of 17 October failed with "fixtures missing (a rental, a sale)").
  -- The fixture gives the row back to the example lister and
  -- points the example sales at it, for this transaction only, so a sale with
  -- another owner exists again. Nothing asserted below changes. Rolled back.
  update public.agents set user_id = 'e0000000-0000-4000-8000-000000000001'
   where id = 'e0000000-0000-4000-8000-000000000002'
     and user_id is distinct from 'e0000000-0000-4000-8000-000000000001'
     and not exists (select 1 from public.agents x where x.user_id = 'e0000000-0000-4000-8000-000000000001');
  update public.listings set agent_id = 'e0000000-0000-4000-8000-000000000002'
   where id in ('ed000000-0000-4000-8000-000000000004',
                'ed000000-0000-4000-8000-000000000006',
                'ed000000-0000-4000-8000-000000000012',
                'ed000000-0000-4000-8000-000000000014')
     and agent_id is distinct from 'e0000000-0000-4000-8000-000000000002';
  select l.id into v_rental from public.listings l where l.property_type = 'rental' and l.listing_intent = 'rent' limit 1;
  select l.id, a.user_id into v_sale, v_sale_owner from public.listings l join public.agents a on a.id = l.agent_id
   where l.listing_intent = 'sale' and a.user_id is not null and a.user_id <> guest limit 1;
  if v_rental is null or v_sale is null then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: fixtures missing (a rental, a sale)';
  end if;
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, case when listing_intent = 'sale' then 'sale' else 'letting' end, 'Probe Principal', 'approved', host, now(),
         'owner', 'call_back', host, now()
    from public.listings where id in (v_rental, v_sale) and listing_role <> 'owner' and not private.listing_has_live_mandate(id);
  update public.listings set is_demo = false where id in (v_rental, v_sale);
  update public.feature_flags set enabled = false where key = 'agreement_review_all';

  perform set_config('vallo.rent_charge', 'true', true);
  insert into public.bookings (id, listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor)
  values (b_rent, v_rental, guest, start_day, start_day + 1, 1, 200000, 200000, 200000),
         (b_sys, v_rental, guest, start_day + 5, start_day + 6, 1, 200000, 200000, 200000),
         (b_pend, v_rental, guest, start_day + 9, start_day + 10, 1, 200000, 200000, 200000);
  perform set_config('vallo.rent_charge', '', true);
  insert into public.deal_agreements (id, kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms, status, decided_by, decided_at)
  values (a_rent, 'stay', v_rental, b_rent, guest, host, 200000, '{}'::jsonb, 'approved', host, now()),
         (a_sys, 'stay', v_rental, b_sys, guest, host, 200000, '{}'::jsonb, 'approved', null, now()),
         (a_pend, 'stay', v_rental, b_pend, guest, host, 200000, '{}'::jsonb, 'approved', host, now());
  insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at)
  values (v_sale, guest, v_sale_owner, now()) returning id into insp;
  insert into public.deal_agreements (kind, listing_id, inspection_id, renter_id, owner_id, amount_minor, terms)
  values ('rent', v_sale, insp, guest, v_sale_owner, 900000000, '{"total_minor": 900000000}') returning id into a_sale;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated')::text, true);

  -- 1. The options read.
  r := public.payment_rail_options(a_rent);
  if r ->> 'status' <> 'ok' or r -> 'options' <> '["escrow", "card"]'::jsonb or r ->> 'default' <> 'escrow'
     or r ->> 'rail' <> 'escrow' or (r ->> 'payer')::boolean is not true or r ->> 'locked' is not null then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: the options read is wrong: %', r;
  end if;
  -- 2. Unknown words are refused.
  if public.payment_rail_choose(a_rent, 'wallet') ->> 'status' <> 'bad_choice' then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: an unknown word was accepted';
  end if;
  -- 3. The payer picks card, and the live rail follows.
  r := public.payment_rail_choose(a_rent, 'card');
  if r ->> 'status' <> 'ok' or public.payment_rail_options(a_rent) ->> 'rail' <> 'card' then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: the payer could not pick card: %', r;
  end if;
  -- 4. A sale refuses card.
  if public.payment_rail_choose(a_sale, 'card') ->> 'status' <> 'sale_escrow_only' then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: a sale accepted card';
  end if;
  if public.payment_rail_choose(a_sale, 'escrow') ->> 'status' <> 'ok' then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: a sale refused escrow';
  end if;

  -- 5. Only the payer.
  perform set_config('request.jwt.claims', json_build_object('sub', host, 'role', 'authenticated')::text, true);
  if public.payment_rail_choose(a_rent, 'escrow') ->> 'status' <> 'not_payer' then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: the lister set the payer''s rail';
  end if;
  if (public.payment_rail_options(a_rent) ->> 'payer')::boolean then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: the lister was read as the payer';
  end if;
  reset role;

  -- 6. Card on a system-approved agreement while a signal fires: a person
  --    looks (in_review), and escrow again is approved by the system.
  update public.feature_flags set enabled = true where key = 'agreement_review_all';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated')::text, true);
  r := public.payment_rail_choose(a_sys, 'card');
  reset role;
  if r ->> 'status' <> 'ok' or (r ->> 'review')::boolean is not true
     or (select status::text from public.deal_agreements where id = a_sys) <> 'in_review' then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: card under a signal did not go to a person: %', r;
  end if;
  update public.feature_flags set enabled = false where key = 'agreement_review_all';
  update public.deal_agreements set renter_confirmed_version = terms_version, owner_confirmed_version = terms_version where id = a_sys;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated')::text, true);
  r := public.payment_rail_choose(a_sys, 'escrow');
  reset role;
  if r ->> 'status' <> 'ok' or (select status::text from public.deal_agreements where id = a_sys) <> 'approved'
     or (select decided_by from public.deal_agreements where id = a_sys) is not null then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: going back to escrow was not approved by the system: %', r;
  end if;

  -- 6b. Any PENDING card attempt locks the choice, however old.
  update public.deal_agreements set payer_rail_choice = 'card', payer_rail_chosen_at = now() where id = a_pend;
  insert into public.transactions (booking_id, agreement_id, provider, provider_ref, amount_minor, currency, status, created_at,
                                   lister_share_minor, guarantee_minor, commission_minor, payee_subaccount_code)
  values (b_pend, a_pend, 'paystack', 'rm-book-probe-' || replace(gen_random_uuid()::text, '-', ''), 200000, 'NGN', 'PENDING',
          now() - interval '3 days', 200000, 0, 0, 'ACCT_probe');
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated')::text, true);
  if public.payment_rail_choose(a_pend, 'escrow') ->> 'status' <> 'payment_started' then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: an old PENDING card attempt did not lock the choice';
  end if;
  reset role;

  -- 7. Not once a payment is moving.
  insert into public.provider_arrangements (agreement_id, kind, reference, amount_minor, buyer_user_id, seller_user_id,
                                            buyer_customer_id, seller_customer_id)
  values (a_rent, 'standard', 'vallo-arr-probe-' || replace(gen_random_uuid()::text, '-', ''), 200000, guest, host, 'probe-b', 'probe-s');
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated')::text, true);
  if public.payment_rail_choose(a_rent, 'escrow') ->> 'status' <> 'payment_started' then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: the rail moved under a payment';
  end if;
  reset role;

  -- 8. Not on a closed agreement.
  update public.deal_agreements set status = 'cancelled' where id = a_sys;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated')::text, true);
  if public.payment_rail_choose(a_sys, 'escrow') ->> 'status' <> 'closed' then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: a cancelled agreement took a choice';
  end if;
  reset role;

  -- 9. The router's read answers the gate's rail.
  r := public.payment_rail_for_booking(b_rent);
  if r ->> 'rail' <> 'direct' or (r ->> 'payer_may_choose')::boolean is not true
     or (r ->> 'policy_id')::uuid is distinct from (private.rail_for_booking(b_rent)).policy_id then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: the router read disagrees with the gate: %', r;
  end if;

  -- 9b. Settlement never takes a card charge on a deal the partner holds.
  ref := 'rm-book-probe-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.transactions (booking_id, agreement_id, provider, provider_ref, amount_minor, currency, status,
                                   lister_share_minor, guarantee_minor, commission_minor, payee_subaccount_code)
  values (b_pend, a_pend, 'paystack', ref, 200000, 'NGN', 'PENDING', 200000, 0, 0, 'ACCT_probe');
  insert into public.provider_arrangements (agreement_id, kind, reference, amount_minor, buyer_user_id, seller_user_id,
                                            buyer_customer_id, seller_customer_id, status)
  values (a_pend, 'standard', 'vallo-arr-probe-' || replace(gen_random_uuid()::text, '-', ''), 200000, guest, host,
          'probe-b', 'probe-s', 'protected');
  r := private.settle_booking_charge(ref, 200000, 0, null);
  select t.status into st from public.transactions t where t.provider_ref = ref;
  if r ->> 'outcome' <> 'refund-due' or r ->> 'reason' <> 'partner_holds_payment' or st <> 'FAILED'
     or (select status::text from public.deal_agreements where id = a_pend) = 'paid' then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: a card charge was settled on a deal the partner holds: %', r;
  end if;

  -- 10. Grants.
  if not has_function_privilege('authenticated', 'public.payment_rail_choose(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.payment_rail_choose(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.payment_rail_options(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.payment_rail_for_booking(uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.payment_rail_for_booking(uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.settle_booking_charge(text, bigint, bigint, uuid)', 'execute') then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: grants are not as written';
  end if;
  if not exists (select 1 from public.audit_log where action = 'agreement.rail_chosen' and entity_id = a_rent::text) then
    raise exception 'PROBE_FAIL pov04-payer-rail-choice-rpcs: the choice was not audited';
  end if;

  raise exception 'PROBE_OK pov04-payer-rail-choice-rpcs';
end
$$;
