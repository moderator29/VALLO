-- MON-05 (with OPS-01), OPS-02 (a)(c), MON-P2-02, and V-33's card path: one
-- SQL function settles a card charge under the booking's lock. The first
-- matching charge settles and confirms; a replay moves nothing; a second
-- charge, a charge on a cancelled booking and a wrong amount are marked for a
-- refund to the card with an alert; a paid booking is refunded in parts in any
-- status, bounded cumulatively across both refund doors; a card-paid rent
-- charge settles the lister's share once, less the processor's fee, and a
-- second charge on it settles nothing. API roles cannot call either door.
-- Rolls back.
--
-- 29 September 2026: rewritten for Track A (docs/MONEY_ARCHITECTURE.md). There
-- is no wallet: a charge that cannot be applied is now outcome 'refund-due'
-- (the attempt FAILED, an alert, a refund to the card) instead of
-- 'returned-to-wallet', and every charge is opened with its split and an
-- approved agreement, as transactions_00_payment_gate requires, so the
-- fixture files an approved deal_agreements row per booking. Replaced:
-- "the duplicate went back to the wallet" is now "the duplicate is FAILED,
-- refund-due, and writes no ledger row"; the duplicate's replay is checked
-- after the app has marked it REFUNDED (what refundChargeToCard does), since a
-- FAILED attempt is re-evaluated on replay by design; "refunds landed in the
-- wallet" is now "the refunds are recorded for the card (booking_refunds,
-- processor_status pending) and reversed in the ledger"; "the lister's wallet
-- was credited gross less the fee" is now "the ledger row gives the lister the
-- split's share less the processor's fee, once". Dropped: the customer-borne
-- fee case (price plus fee is not a mismatch). The processor's fee is now
-- borne by the lister's subaccount as the split's bearer, so the payer is
-- charged the price exactly; price plus a fee is now an amount mismatch, and
-- the fee is checked on the lister's share instead.
-- The heal of a charge with no attempt row now records the charge and marks
-- it refund-due ('no_split'): without an attempt there is no split to apply.
do $$
declare
  member uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  admin  uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  stay   uuid := 'ed000000-0000-4000-8000-000000000003';
  lagos  date := (now() at time zone 'Africa/Lagos')::date;
  gbps   int  := 150;
  rate bigint; b1 uuid; b2 uuid; b3 uuid; b4 uuid; rb uuid; b6 uuid; insp uuid; rtotal bigint;
  a1 uuid; a2 uuid; a3 uuid; a6 uuid; ra uuid; g bigint;
  lister uuid := 'e0000000-0000-4000-8000-000000000001'; rental uuid := 'ed000000-0000-4000-8000-000000000007'; r jsonb; n int; st text; s bigint;
begin
  -- 17 October 2026: on the live database the example collection's agents row
  -- (e0000000-...-0002) no longer belongs to the example lister: every probe
  -- that made the QA member an agent hit agents_user_id_key, an inspection by
  -- the QA member on an example listing was refused by
  -- inspection_requests_parties_differ, a stay they booked there drew no
  -- agreement (the host was the guest), and the example payout account
  -- answered payee_not_set_up for the example lister. The fixture gives the
  -- row back to the example lister and points the listings this probe uses
  -- at it, for this transaction only, so the two parties are the people the
  -- probe was written for. Nothing asserted below changes. Rolled back.
  update public.agents set user_id = 'e0000000-0000-4000-8000-000000000001'
   where id = 'e0000000-0000-4000-8000-000000000002'
     and user_id is distinct from 'e0000000-0000-4000-8000-000000000001'
     and not exists (select 1 from public.agents x where x.user_id = 'e0000000-0000-4000-8000-000000000001');
  update public.listings set agent_id = 'e0000000-0000-4000-8000-000000000002'
   where id in ('ed000000-0000-4000-8000-000000000003',
                'ed000000-0000-4000-8000-000000000007')
     and agent_id is distinct from 'e0000000-0000-4000-8000-000000000002';
  -- 7 October 2026 (D68d, D77): an agreement approved by the system (no
  -- decided_by) is payable only while no risk signal fires for it. This probe
  -- is about the payment, not the review, so its fixture deals are ordinary
  -- deals that raise no signal: the signals are switched off in
  -- agreement_risk_settings for this transaction only.
  update public.agreement_risk_settings
     set check_first_deal = false, check_amount = false, check_recent_change = false,
         check_payout_name = false, check_fraud_radar = false
   where id = 1;
  -- 29 September: the console's second factor. An admin or a staff member
  -- holds their role only on a session that proved a security key, so this
  -- probe's session carries one for every admin and for the QA member (who
  -- some probes make staff), rolled back with everything else.
  insert into public.console_step_ups (user_id, session_id, expires_at)
  select console_probe_uid, '00000000-0000-4000-8000-00000000c0de', now() + interval '1 hour'
    from (select user_id from public.user_roles where role in ('admin', 'super_admin')
          union select '03f3dd52-ea28-4852-9abe-e5b0a67c2a43'::uuid
          union select '957b3bd2-cce3-425d-bba9-5cd876ca3d62'::uuid) s(console_probe_uid)
  on conflict (user_id, session_id) do update set expires_at = excluded.expires_at;
  -- SCUML item 17 (live 29 Sep): an agent listing goes live only on an
  -- approved mandate. The fixture files one as the platform would.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id = stay and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set is_demo = false, status = 'PUBLISHED' where id = stay;
  select rate_minor into rate from public.listings where id = stay;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 20, lagos + 22, 2, rate, rate * 2, rate * 2, 'PENDING') returning id into b1;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 30, lagos + 31, 1, rate, rate, rate, 'CANCELLED') returning id into b2;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 40, lagos + 41, 1, rate, rate, rate, 'PENDING') returning id into b3;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 50, lagos + 51, 1, rate, rate, rate, 'PENDING') returning id into b4;
  -- 17 October 2026 (D73 as refined on 13 October, DECISIONS_2026-10-13.md
  -- row 21; pov02 and pov03): a nightly shortlet and a registered business's
  -- apartment are no longer settled direct by the policy; each is escrow
  -- unless the payer picks card, and a Paystack charge carries only the
  -- direct rail. Every fixture agreement below records the payer's choice of
  -- card, as the pay page does, so each charge is the direct-rail card charge
  -- this probe was written against. Nothing asserted changes.
  -- Each payable booking carries an approved agreement for its price.
  insert into public.deal_agreements (kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms, status, payer_rail_choice, payer_rail_chosen_at)
  values ('stay', stay, b1, member, lister, rate * 2, '{}'::jsonb, 'approved', 'card', now()) returning id into a1;
  insert into public.deal_agreements (kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms, status, payer_rail_choice, payer_rail_chosen_at)
  values ('stay', stay, b2, member, lister, rate, '{}'::jsonb, 'approved', 'card', now()) returning id into a2;
  insert into public.deal_agreements (kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms, status, payer_rail_choice, payer_rail_chosen_at)
  values ('stay', stay, b3, member, lister, rate, '{}'::jsonb, 'approved', 'card', now()) returning id into a3;
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, status, agreement_id,
         payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor) values
    (b1, 'paystack', 'probe-b2-A', rate * 2, 'PENDING', a1, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve',
       rate * 2 - rate * 2 * gbps / 10000, rate * 2 * gbps / 10000, 0),
    (b1, 'paystack', 'probe-b2-B', rate * 2, 'PENDING', a1, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve',
       rate * 2 - rate * 2 * gbps / 10000, rate * 2 * gbps / 10000, 0),
    (b2, 'paystack', 'probe-b2-C', rate, 'PENDING', a2, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve',
       rate - rate * gbps / 10000, rate * gbps / 10000, 0),
    (b3, 'paystack', 'probe-b2-D', rate, 'PENDING', a3, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve',
       rate - rate * gbps / 10000, rate * gbps / 10000, 0);

  -- CONTROL: the first matching charge settles and confirms, with one ledger
  -- row, one Guarantee contribution, and the agreement marked paid.
  r := private.settle_booking_charge('probe-b2-A', rate * 2, 1500, null);
  if r->>'outcome' <> 'settled' or (r->>'confirmed')::boolean is not true then raise exception 'PROBE_FAIL mon-05: first charge %', r; end if;
  select status::text into st from public.bookings where id = b1;
  if st <> 'CONFIRMED' then raise exception 'PROBE_FAIL mon-05: booking %', st; end if;
  select count(*) into n from public.ledger_entries where booking_id = b1;
  if n <> 1 then raise exception 'PROBE_FAIL mon-05: % ledger rows', n; end if;
  -- The processor's fee comes out of the lister's share (the split's bearer).
  if (r->'ledger'->>'agentShareMinor')::bigint <> rate * 2 - rate * 2 * gbps / 10000 - 1500
     or (r->'ledger'->>'guaranteeMinor')::bigint <> rate * 2 * gbps / 10000 then
    raise exception 'PROBE_FAIL mon-05: settled split %', r->'ledger';
  end if;
  select count(*) into n from public.guarantee_reserve_entries where booking_id = b1 and kind = 'contribution';
  if n <> 1 then raise exception 'PROBE_FAIL mon-05: % Guarantee contributions', n; end if;
  select status::text into st from public.deal_agreements where id = a1;
  if st <> 'paid' then raise exception 'PROBE_FAIL mon-05: agreement is % after payment', st; end if;
  -- A replay moves nothing.
  r := private.settle_booking_charge('probe-b2-A', rate * 2, 1500, null);
  if r->>'outcome' <> 'already-settled' then raise exception 'PROBE_FAIL mon-05: replay %', r; end if;

  -- A second charge on a paid booking settles nothing and is due back to the card.
  r := private.settle_booking_charge('probe-b2-B', rate * 2, 1500, null);
  if r->>'outcome' <> 'refund-due' or r->>'reason' not in ('already_paid', 'agreement_paid') then
    raise exception 'PROBE_FAIL mon-05: duplicate %', r;
  end if;
  select status::text into st from public.transactions where provider_ref = 'probe-b2-B';
  if st <> 'FAILED' then raise exception 'PROBE_FAIL mon-05: duplicate attempt is %', st; end if;
  select count(*) into n from public.ledger_entries where booking_id = b1;
  if n <> 1 then raise exception 'PROBE_FAIL mon-05: duplicate wrote a ledger row'; end if;
  select count(*) into n from public.guarantee_reserve_entries where booking_id = b1;
  if n <> 1 then raise exception 'PROBE_FAIL mon-05: duplicate wrote a Guarantee contribution'; end if;
  select count(*) into n from public.risk_alerts where entity_id = b1::text and status = 'open';
  if n < 1 then raise exception 'PROBE_FAIL mon-05: no alert for the duplicate'; end if;
  -- ... and once its card refund is submitted (the app marks it REFUNDED), a
  -- replay moves nothing either.
  update public.transactions set status = 'REFUNDED' where provider_ref = 'probe-b2-B';
  r := private.settle_booking_charge('probe-b2-B', rate * 2, 1500, null);
  if r->>'outcome' <> 'already-settled' then raise exception 'PROBE_FAIL mon-05: duplicate replay %', r; end if;

  -- OPS-02 (a): a charge landing on a cancelled booking is refund-due, no "host accepted".
  r := private.settle_booking_charge('probe-b2-C', rate, 0, null);
  if r->>'outcome' <> 'refund-due' or r->>'reason' <> 'booking_cancelled' then raise exception 'PROBE_FAIL ops-02: late charge %', r; end if;
  select count(*) into n from public.booking_state_events where booking_id = b2;
  if n <> 0 then raise exception 'PROBE_FAIL ops-02: history written for a cancelled booking'; end if;
  select count(*) into n from public.ledger_entries where booking_id = b2;
  if n <> 0 then raise exception 'PROBE_FAIL ops-02: a ledger row for a cancelled booking'; end if;

  -- OPS-02 (c): an amount that is not the booking's price is refund-due.
  r := private.settle_booking_charge('probe-b2-D', 1, 0, null);
  if r->>'outcome' <> 'refund-due' or r->>'reason' <> 'amount_mismatch' then raise exception 'PROBE_FAIL ops-02: mismatch %', r; end if;
  select status::text into st from public.bookings where id = b3;
  if st <> 'PENDING' then raise exception 'PROBE_FAIL ops-02: mismatch moved the booking to %', st; end if;
  select status::text into st from public.deal_agreements where id = a3;
  if st <> 'approved' then raise exception 'PROBE_FAIL ops-02: mismatch moved the agreement to %', st; end if;
  -- Price plus a fee is a mismatch too: the payer is charged the price exactly.
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, status, agreement_id,
         payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
  values (b3, 'paystack', 'probe-b2-G', rate, 'PENDING', a3, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve',
          rate - rate * gbps / 10000, rate * gbps / 10000, 0);
  r := private.settle_booking_charge('probe-b2-G', rate + 1500, 1500, null);
  if r->>'outcome' <> 'refund-due' or r->>'reason' <> 'amount_mismatch' then raise exception 'PROBE_FAIL ops-02: price plus fee %', r; end if;

  -- A charge with no attempt row, named by the processor's metadata, is
  -- recorded against its booking and marked refund-due: there is no split.
  r := private.settle_booking_charge('probe-b2-E', rate, 0, b4);
  if r->>'outcome' <> 'refund-due' or r->>'reason' <> 'no_split' then raise exception 'PROBE_FAIL mon-05: heal %', r; end if;
  select status::text into st from public.transactions where provider_ref = 'probe-b2-E' and booking_id = b4;
  if st is distinct from 'FAILED' then raise exception 'PROBE_FAIL mon-05: healed attempt is %', st; end if;
  select status::text into st from public.bookings where id = b4;
  if st <> 'PENDING' then raise exception 'PROBE_FAIL mon-05: a charge without a split moved the booking to %', st; end if;
  r := private.settle_booking_charge('probe-b2-F', rate, 0, null);
  if r->>'outcome' <> 'unknown-reference' then raise exception 'PROBE_FAIL mon-05: unknown %', r; end if;

  -- MON-P2-02: a COMPLETED stay is refunded in parts, bounded cumulatively.
  update public.bookings set status = 'COMPLETED' where id = b1;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  begin
    perform public.refund_booking_payment(admin, b1, 1, 'probe-b2-ref-x', 'goodwill', null);
    raise exception 'PROBE_FAIL mon-p2-02: authenticated can call the refund door';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.settle_booking_charge('probe-b2-A', 1, 0, null);
    raise exception 'PROBE_FAIL mon-05: authenticated can call the settle door';
  exception when insufficient_privilege then null;
  end;
  reset role;
  r := private.refund_booking_payment(member, b1, 1000, 'probe-b2-ref-0', 'goodwill', null);
  if r->>'status' <> 'forbidden' then raise exception 'PROBE_FAIL mon-p2-02: member refund %', r; end if;
  r := private.refund_booking_payment(admin, b1, 1000, 'probe-b2-ref-1', 'goodwill', 'part refund');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL mon-p2-02: part refund %', r; end if;
  r := private.refund_booking_payment(admin, b1, rate * 2, 'probe-b2-ref-2', 'not_as_listed', null);
  if r->>'status' <> 'over_refund' then raise exception 'PROBE_FAIL mon-p2-02: cumulative bound %', r; end if;
  r := private.refund_booking_payment(admin, b1, rate * 2 - 1000, 'probe-b2-ref-3', 'not_as_listed', null);
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL mon-p2-02: rest refund %', r; end if;
  r := private.refund_booking_payment(admin, b1, 1, 'probe-b2-ref-4', 'goodwill', null);
  if r->>'status' <> 'over_refund' then raise exception 'PROBE_FAIL mon-p2-02: past the total %', r; end if;
  -- The refunds go to the card: recorded pending for the processor, and
  -- reversed in the ledger, for exactly what was paid.
  select coalesce(sum(refund_minor), 0), count(*) filter (where processor_status <> 'pending')
    into s, n from public.booking_refunds where booking_id = b1;
  if s <> rate * 2 or n <> 0 then raise exception 'PROBE_FAIL mon-p2-02: refunds recorded % (% not pending for the card)', s, n; end if;
  select coalesce(sum(gross_minor), 0) into s from public.ledger_entries where booking_id = b1 and gross_minor < 0;
  if s <> -(rate * 2) then raise exception 'PROBE_FAIL mon-p2-02: ledger reversed %', s; end if;
  select status::text into st from public.bookings where id = b1;
  if st <> 'COMPLETED' then raise exception 'PROBE_FAIL mon-p2-02: refund moved the status to %', st; end if;

  -- MON-P2-02: the two refund doors share one bound. A goodwill part refund
  -- through the new door, then refund-and-cancel for the whole price through
  -- the old one, is refused; the remainder is allowed.
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 80, lagos + 82, 2, rate, rate * 2, rate * 2, 'PENDING') returning id into b6;
  insert into public.deal_agreements (kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms, status, payer_rail_choice, payer_rail_chosen_at)
  values ('stay', stay, b6, member, lister, rate * 2, '{}'::jsonb, 'approved', 'card', now()) returning id into a6;
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, status, agreement_id,
         payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
  values (b6, 'paystack', 'probe-b2-H', rate * 2, 'PENDING', a6, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve',
          rate * 2 - rate * 2 * gbps / 10000, rate * 2 * gbps / 10000, 0);
  r := private.settle_booking_charge('probe-b2-H', rate * 2, 0, null);
  if r->>'outcome' <> 'settled' then raise exception 'PROBE_FAIL mon-05: two-door setup %', r; end if;
  r := private.refund_booking_payment(admin, b6, 1000, 'probe-b2-ref-h1', 'goodwill', 'part refund');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL mon-p2-02: goodwill %', r; end if;
  r := private.refund_and_cancel_booking(admin, b6, rate * 2, 'probe-b2-ref-h2', 'not_as_listed', 'whole price');
  if r->>'status' <> 'over_refund' then raise exception 'PROBE_FAIL mon-p2-02: two doors refunded more than was paid %', r; end if;
  r := private.refund_and_cancel_booking(admin, b6, rate * 2 - 1000, 'probe-b2-ref-h3', 'not_as_listed', 'the rest');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL mon-p2-02: the remainder %', r; end if;

  -- V-33 with MON-05: a card-paid rent charge settled by the function gives
  -- the lister the split's share less the fee, once; a second charge settles nothing.
  -- SCUML item 17 (live 29 Sep): an agent listing goes live only on an
  -- approved mandate. The fixture files one as the platform would.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id = rental and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  -- 7 October 2026 (b2 rail at open): a Paystack charge must resolve to the
  -- direct rail. A shortlet is escrow; the fixture lets the place as a
  -- registered business's apartment, which the rail policy settles direct.
  update public.listings set is_demo = false, status = 'PUBLISHED', listing_intent = 'rent', property_type = 'apartment',
         rent_amount_minor = 150000000, rent_period = 'year', rate_minor = 0, rate_period = null,
         caution_deposit_minor = null, service_charge_minor = null, agency_fee_minor = null,
         legal_fee_minor = null, agreement_fee_minor = null, total_move_in_cost_minor = null
   where id = rental;
  insert into public.inspection_requests (listing_id, requester_id, lister_id, state, requested_at, slot_at)
  values (rental, member, lister, 'CONFIRMED', now(), now() + interval '1 day') returning id into insp;
  insert into public.deal_agreements (kind, listing_id, inspection_id, renter_id, owner_id, amount_minor, terms, status, payer_rail_choice, payer_rail_chosen_at)
  values ('rent', rental, insp, member, lister, 150000000, '{}'::jsonb, 'approved', 'card', now()) returning id into ra;
  r := private.open_rent_charge(member, insp, lagos + 7);
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL mon-05: rent charge did not open %', r; end if;
  rb := (r->>'booking_id')::uuid; rtotal := (r->>'total_minor')::bigint;
  g := rtotal * gbps / 10000;
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, status, agreement_id,
         payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor) values
    (rb, 'paystack', 'probe-b2-R1', rtotal, 'PENDING', ra, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve', rtotal - g, g, 0),
    (rb, 'paystack', 'probe-b2-R2', rtotal, 'PENDING', ra, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve', rtotal - g, g, 0);
  r := private.settle_booking_charge('probe-b2-R1', rtotal, 150000, null);
  if r->>'outcome' <> 'settled' then raise exception 'PROBE_FAIL mon-05: rent card %', r; end if;
  select coalesce(sum(net_settlement_minor), 0), count(*) into s, n from public.ledger_entries where booking_id = rb and gross_minor > 0;
  if n <> 1 or s <> rtotal - g - 150000 then raise exception 'PROBE_FAIL v-33: rent card settled % to the lister in % rows', s, n; end if;
  r := private.settle_booking_charge('probe-b2-R2', rtotal, 150000, null);
  if r->>'outcome' <> 'refund-due' then raise exception 'PROBE_FAIL mon-05: second rent charge %', r; end if;
  select count(*) into n from public.ledger_entries where booking_id = rb;
  if n <> 1 then raise exception 'PROBE_FAIL v-33: second charge settled to the lister (% ledger rows)', n; end if;

  raise exception 'PROBE_OK mon-05';
end $$;
