-- V-33: rent never rests at Vallo. A paid rent charge settles the lister's
-- share to the lister in the same charge, for the gross less the Guarantee
-- contribution and the processor's cut, once per booking; a support refund
-- records as owed back by the lister at most what the lister received, the
-- fee being the platform's cost. Everything runs on an example listing made
-- real inside the transaction, and the block always rolls back.
--
-- 29 September 2026: rewritten for Track A (docs/MONEY_ARCHITECTURE.md).
-- There is no wallet, so the lister is no longer credited a payment_in entry:
-- the charge is split by Paystack and settle_booking_charge records the
-- lister's share in ledger_entries (net_settlement_minor). Replaced: "a
-- wallet-paid charge credits the lister" and "a card charge credits gross
-- less the fee" are now one card charge opened with its split and an approved
-- agreement (the payment gate), whose ledger row gives the lister the split's
-- share less the fee; "a second ledger row credits nobody" is now "a second
-- charge on the booking settles nothing" (the rent-to-wallet trigger it
-- guarded is retired and gone); "a refund takes the credit back out of the
-- lister's wallet" is now "a refund goes to the card (booking_refunds pending)
-- and what the lister received is recorded as owed back (rent_refunds_owed)",
-- and the bound that the lister gives back at most what the lister received
-- is kept. Dropped: the lister_short path (a refund waiting until the
-- lister's wallet held it, the debt held against the spendable balance, paid
-- on retry). With no balance a refund never waits on the lister, so that
-- subject is retired custody with no equivalent. The execute check on the
-- retired trigger function private.settle_rent_charge_to_lister (gone) is
-- replaced by the same check on both settle doors.
do $$
declare
  member uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  admin  uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  lister uuid := 'e0000000-0000-4000-8000-000000000001';
  lst    uuid := 'ed000000-0000-4000-8000-000000000003';
  gbps   int  := 150;
  fee    bigint := 200000;
  lagos  date := (now() at time zone 'Africa/Lagos')::date;
  insp uuid; ag uuid; r jsonb; bk uuid; total bigint; g bigint; tx uuid;
  n int; s bigint; st text;
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
   where id in ('ed000000-0000-4000-8000-000000000003')
     and agent_id is distinct from 'e0000000-0000-4000-8000-000000000002';
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
    from public.listings where id = lst and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  -- 7 October 2026 (b2 rail at open): a Paystack charge must resolve to the
  -- direct rail. A shortlet is escrow; the fixture lets the place as a
  -- registered business's apartment, which the rail policy settles direct.
  update public.listings set is_demo = false, status = 'PUBLISHED', listing_intent = 'rent', property_type = 'apartment',
         rent_amount_minor = 200000000, caution_deposit_minor = 20000000, service_charge_minor = null,
         agency_fee_minor = 20000000, legal_fee_minor = null, agreement_fee_minor = null,
         total_move_in_cost_minor = null, rent_period = 'year', rate_minor = 0, rate_period = null
   where id = lst;

  -- 1. A card-paid rent charge settles the lister's share in the same charge.
  insert into public.inspection_requests (listing_id, requester_id, lister_id, state, requested_at, slot_at)
  values (lst, member, lister, 'CONFIRMED', now(), now() + interval '1 day') returning id into insp;
  -- Approved by a person (D68d): a system approval on the direct rail is
  -- payable only while no risk signal fires, and this deal is over the
  -- amount threshold. This probe is about the money, not the review.
  -- 17 October 2026 (D73 as refined on 13 October, DECISIONS_2026-10-13.md
  -- row 21; pov02 and pov03): a registered business's apartment is no longer
  -- settled direct by the policy; every rent is escrow unless the payer picks
  -- card, and a Paystack charge carries only the direct rail. The renter
  -- picks card on the agreement, as the pay page records it, so the charge
  -- below is the direct-rail card charge this probe was written against.
  insert into public.deal_agreements (kind, listing_id, inspection_id, renter_id, owner_id, amount_minor, terms, status,
         decided_by, decided_at, payer_rail_choice, payer_rail_chosen_at)
  values ('rent', lst, insp, member, lister, 240000000, '{}'::jsonb, 'approved', admin, now(), 'card', now()) returning id into ag;
  r := private.open_rent_charge(member, insp, lagos + 7);
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL v-33: open %', r; end if;
  bk := (r->>'booking_id')::uuid; total := (r->>'total_minor')::bigint;
  if total <> 240000000 then raise exception 'PROBE_FAIL v-33: move-in total %', total; end if;
  g := total * gbps / 10000;
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, agreement_id,
         payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
  values (bk, 'paystack', 'probe-v33-card-' || gen_random_uuid(), total, 'NGN', 'PENDING', ag,
          lister, 'ACCT_probe_lister', 'ACCT_probe_reserve', total - g, g, 0)
  returning id into tx;
  r := private.settle_booking_charge((select provider_ref from public.transactions where id = tx), total, fee, null);
  if r->>'outcome' <> 'settled' then raise exception 'PROBE_FAIL v-33: card settle %', r; end if;
  select coalesce(sum(net_settlement_minor), 0), count(*) into s, n
    from public.ledger_entries where booking_id = bk and gross_minor > 0;
  if n <> 1 or s <> total - g - fee then
    raise exception 'PROBE_FAIL v-33: lister settled % in % rows, expected % once', s, n, total - g - fee;
  end if;
  -- Nothing rests at Vallo: the charge is the lister's share, the Guarantee
  -- contribution and the commission, and nothing else.
  select count(*) into n from public.transactions
   where id = tx and payee_user_id = lister and lister_share_minor + guarantee_minor + commission_minor = amount_minor;
  if n <> 1 then raise exception 'PROBE_FAIL v-33: the charge is not wholly split'; end if;

  -- 2. A second charge on the same booking settles to nobody: the agreement
  --    is paid, so the payment gate will not even open one (a second charge
  --    opened before the first settled is refund-due; mon-05 checks that).
  select status::text into st from public.deal_agreements where id = ag;
  if st <> 'paid' then raise exception 'PROBE_FAIL v-33: agreement is % after payment', st; end if;
  begin
    insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, agreement_id,
           payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
    values (bk, 'paystack', 'probe-v33-card2-' || gen_random_uuid(), total, 'NGN', 'PENDING', ag,
           lister, 'ACCT_probe_lister', 'ACCT_probe_reserve', total - g, g, 0);
    raise exception 'PROBE_FAIL v-33: a second charge opened on a paid agreement';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.ledger_entries where booking_id = bk;
  if n <> 1 then raise exception 'PROBE_FAIL v-33: a second payment settled to the lister again (% ledger rows)', n; end if;

  -- 3. A full refund goes to the card, and the lister owes back at most what
  --    the lister received: the fee and the Guarantee contribution never
  --    reached the lister.
  r := private.refund_and_cancel_booking(admin, bk, total, 'probe-v33-ref-' || gen_random_uuid(), 'guest_choice', 'probe');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL v-33: refund %', r; end if;
  select count(*) into n from public.booking_refunds
   where booking_id = bk and refund_minor = total and processor_status = 'pending';
  if n <> 1 then raise exception 'PROBE_FAIL v-33: the refund is not recorded for the card'; end if;
  r := private.refund_booking_payment(admin, bk, 1, 'probe-v33-ref2-' || gen_random_uuid(), 'goodwill', 'probe');
  if r->>'status' <> 'over_refund' then raise exception 'PROBE_FAIL v-33: refunded past what was paid %', r; end if;
  select amount_minor into s from public.rent_refunds_owed where booking_id = bk and lister_id = lister and cleared_at is null;
  if s is null then raise exception 'PROBE_FAIL v-33: the lister''s debt was not recorded'; end if;
  if s > total - g - fee then
    raise exception 'PROBE_FAIL v-33: the lister is recorded as owing % back, more than the % the lister received', s, total - g - fee;
  end if;

  if has_function_privilege('authenticated', 'private.settle_booking_charge(text,bigint,bigint,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.settle_booking_charge(text,bigint,bigint,uuid)', 'execute') then
    raise exception 'PROBE_FAIL v-33: authenticated can execute the settle door';
  end if;

  -- CONTROL (member, API role): reads own charges. REFUSAL: writes a ledger row.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  perform count(*) from public.transactions;
  begin
    insert into public.ledger_entries (booking_id, transaction_id, gross_minor, platform_fee_minor, agent_share_minor, processor_fee_minor, net_settlement_minor)
    values (bk, null, 1, 0, 1, 0, 1);
    raise exception 'PROBE_FAIL v-33: member wrote a ledger row';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise exception 'PROBE_OK v-33';
end $$;
