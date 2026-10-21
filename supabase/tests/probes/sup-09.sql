-- SUP-09: one home is let to one tenant. Two tenants with accepted
-- inspections and approved agreements open move-in charges for different
-- days; the first pays by card; the second's card payment is then not
-- applied (refund-due, 'already_let', the charge stays PENDING) and no new
-- charge opens on the home. Control: the first tenant's payment settles to
-- the lister, once. A tenancy stops holding the home once it is refunded in
-- full, cancelled, or past its term: each of those lets the next tenant pay.
-- Rolls back.
--
-- 29 September 2026: rewritten for Track A (docs/MONEY_ARCHITECTURE.md).
-- There is no wallet, so both tenants pay by card, and every charge is opened
-- with its split and an approved agreement (transactions_00_payment_gate and
-- rent_payments_00_needs_approved_agreement), so the fixture files an
-- approved deal_agreements row per inspection. Replaced: "tenant A pays from
-- the wallet" is now a card charge settled by settle_booking_charge; "tenant
-- B's wallet payment is refused, nothing debited" and "tenant B's card goes
-- back to the wallet" are now one check, B's card charge is refund-due
-- ('already_let') and writes no ledger row; "the lister was credited once"
-- (a payment_in wallet entry) is now one positive ledger row across both
-- bookings; each later "pays" is a card charge that settles.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';   -- tenant A
  admin  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';   -- tenant B
  lister constant uuid := 'e0000000-0000-4000-8000-000000000001';
  home   constant uuid := 'ed000000-0000-4000-8000-000000000002';
  lagos date := (now() at time zone 'Africa/Lagos')::date;
  insp_a uuid; insp_b uuid; insp_b2 uuid; insp_a2 uuid; insp_b3 uuid;
  ag_a uuid; ag_b uuid; ag_a2 uuid;
  r jsonb; bk_a uuid; bk_b uuid; bk_a2 uuid; n bigint; st text;
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
   where id in ('ed000000-0000-4000-8000-000000000002')
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
  -- SCUML item 17 (live 29 Sep): an agent listing goes live only on an
  -- approved mandate. The fixture files one as the platform would.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id = home and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings
     set is_demo = false, status = 'PUBLISHED', listing_intent = 'rent',
         rent_amount_minor = 1000, caution_deposit_minor = 0, service_charge_minor = 0,
         agency_fee_minor = 0, legal_fee_minor = 0, agreement_fee_minor = 0,
         total_move_in_cost_minor = null
   where id = home;
  update public.agents set is_demo = false where user_id = lister;

  insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at, state, slot_at)
  values (home, member, lister, now(), 'CONFIRMED', now() + interval '1 day') returning id into insp_a;
  insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at, state, slot_at)
  values (home, admin, lister, now(), 'CONFIRMED', now() + interval '1 day') returning id into insp_b;
  insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at, state, slot_at)
  values (home, admin, lister, now(), 'CONFIRMED', now() + interval '1 day') returning id into insp_b2;
  insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at, state, slot_at)
  values (home, member, lister, now(), 'CONFIRMED', now() + interval '1 day') returning id into insp_a2;
  insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at, state, slot_at)
  values (home, admin, lister, now(), 'CONFIRMED', now() + interval '1 day') returning id into insp_b3;

  -- Every inspection has its agreement approved, so only the letting can refuse.
  -- 17 October 2026 (D73 as refined on 13 October, DECISIONS_2026-10-13.md
  -- row 21; pov02 and pov03): a registered business's apartment is no longer
  -- settled direct by the policy; every rent is escrow unless the payer picks
  -- card, and a Paystack charge carries only the direct rail. Each renter
  -- picks card on the agreement, as the pay page records it, so the charges
  -- below are the direct-rail card charges this probe was written against.
  insert into public.deal_agreements (kind, listing_id, inspection_id, renter_id, owner_id, amount_minor, terms, status,
         payer_rail_choice, payer_rail_chosen_at)
  values ('rent', home, insp_a,  member, lister, 1000, '{}'::jsonb, 'approved', 'card', now()),
         ('rent', home, insp_b,  admin,  lister, 1000, '{}'::jsonb, 'approved', 'card', now()),
         ('rent', home, insp_b2, admin,  lister, 1000, '{}'::jsonb, 'approved', 'card', now()),
         ('rent', home, insp_a2, member, lister, 1000, '{}'::jsonb, 'approved', 'card', now()),
         ('rent', home, insp_b3, admin,  lister, 1000, '{}'::jsonb, 'approved', 'card', now());
  select id into ag_a from public.deal_agreements where inspection_id = insp_a;
  select id into ag_b from public.deal_agreements where inspection_id = insp_b;
  select id into ag_a2 from public.deal_agreements where inspection_id = insp_a2;

  -- Both charges open while nobody has paid.
  r := private.open_rent_charge(member, insp_a, lagos + 10);
  if r ->> 'status' <> 'ok' then raise exception 'PROBE_FAIL sup-09: tenant A could not open: %', r; end if;
  bk_a := (r ->> 'booking_id')::uuid;
  r := private.open_rent_charge(admin, insp_b, lagos + 20);
  if r ->> 'status' <> 'ok' then raise exception 'PROBE_FAIL sup-09: tenant B could not open: %', r; end if;
  bk_b := (r ->> 'booking_id')::uuid;

  -- Both card charges open before either settles (each agreement is approved).
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, agreement_id,
         payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
  values (bk_a, 'paystack', 'probe-sup09-card-a', 1000, 'NGN', 'PENDING', ag_a, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve', 985, 15, 0),
         (bk_b, 'paystack', 'probe-sup09-card-b', 1000, 'NGN', 'PENDING', ag_b, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve', 985, 15, 0);

  -- CONTROL: tenant A pays by card.
  r := private.settle_booking_charge('probe-sup09-card-a', 1000, 0, null);
  if r ->> 'outcome' <> 'settled' then raise exception 'PROBE_FAIL sup-09: tenant A could not pay: %', r; end if;

  -- Tenant B's card payment is not applied: refund-due to the card.
  r := private.settle_booking_charge('probe-sup09-card-b', 1000, 0, null);
  if r ->> 'outcome' <> 'refund-due' or r ->> 'reason' <> 'already_let' then
    raise exception 'PROBE_FAIL sup-09: a card payment for a let home was %', r;
  end if;
  select status::text into st from public.bookings where id = bk_b;
  if st <> 'PENDING' then raise exception 'PROBE_FAIL sup-09: tenant B''s charge moved to %', st; end if;

  -- No new charge opens on the home.
  r := private.open_rent_charge(admin, insp_b2, lagos + 30);
  if r ->> 'status' <> 'already_let' then raise exception 'PROBE_FAIL sup-09: a charge opened on a let home: %', r; end if;

  -- CONTROL: the lister was settled once, for tenant A.
  select count(*) into n from public.ledger_entries where booking_id in (bk_a, bk_b) and gross_minor > 0;
  if n <> 1 then raise exception 'PROBE_FAIL sup-09: the lister was settled % times', n; end if;
  if not exists (select 1 from public.ledger_entries where booking_id = bk_a and gross_minor > 0) then
    raise exception 'PROBE_FAIL sup-09: the settlement is not tenant A''s';
  end if;

  -- A tenancy refunded in full no longer holds the home: B pays.
  insert into public.booking_refunds (booking_id, guest_id, paid_minor, refund_minor, retained_minor, reason, wallet_reference)
  values (bk_a, member, 1000, 1000, 0, 'host_cancelled', 'probe-sup09-refund-a');
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, agreement_id,
         payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
  values (bk_b, 'paystack', 'probe-sup09-card-b2', 1000, 'NGN', 'PENDING', ag_b, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve', 985, 15, 0);
  r := private.settle_booking_charge('probe-sup09-card-b2', 1000, 0, null);
  if r ->> 'outcome' <> 'settled' then raise exception 'PROBE_FAIL sup-09: a refunded tenancy still held the home: %', r; end if;

  -- A cancelled tenancy no longer holds the home: A opens and pays again.
  update public.bookings set status = 'CANCELLED' where id = bk_b;
  r := private.open_rent_charge(member, insp_a2, lagos + 40);
  if r ->> 'status' <> 'ok' then raise exception 'PROBE_FAIL sup-09: a cancelled tenancy still held the home: %', r; end if;
  bk_a2 := (r ->> 'booking_id')::uuid;
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, agreement_id,
         payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
  values (bk_a2, 'paystack', 'probe-sup09-card-a2', 1000, 'NGN', 'PENDING', ag_a2, lister, 'ACCT_probe_lister', 'ACCT_probe_reserve', 985, 15, 0);
  r := private.settle_booking_charge('probe-sup09-card-a2', 1000, 0, null);
  if r ->> 'outcome' <> 'settled' then raise exception 'PROBE_FAIL sup-09: A could not pay after the cancellation: %', r; end if;

  -- A tenancy past its term no longer holds the home: B opens again.
  r := private.open_rent_charge(admin, insp_b3, lagos + 50);
  if r ->> 'status' <> 'already_let' then raise exception 'PROBE_FAIL sup-09: a current tenancy did not hold the home: %', r; end if;
  update public.rent_payments set move_in = lagos - 400 where booking_id = bk_a2;
  r := private.open_rent_charge(admin, insp_b3, lagos + 50);
  if r ->> 'status' <> 'ok' then raise exception 'PROBE_FAIL sup-09: an ended tenancy still held the home: %', r; end if;

  raise exception 'PROBE_OK sup-09';
end
$$;
