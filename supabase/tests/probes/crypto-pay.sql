-- CRYPTO-PAY: crypto is one more payment attempt on an existing charge, with
-- no custody. A quote is only for the booking's own KYC-verified guest at the
-- stored total; the attempt opens through the normal payment gate with the
-- split and the lister's verified payout account; provider events are applied
-- once each (idempotent on the event id), in the allowed order only; a
-- settlement must be exactly the charge in naira; settling runs
-- private.settle_booking_charge and writes one append-only AML record with the
-- payer's KYC identity. API roles can write nothing and call no door. Rolls back.
do $$
declare
  member uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  lister uuid := 'e0000000-0000-4000-8000-000000000001';
  agent  uuid := 'e0000000-0000-4000-8000-000000000002';
  stay   uuid := 'ed000000-0000-4000-8000-000000000003';
  lagos  date := (now() at time zone 'Africa/Lagos')::date;
  ref    text := 'rm-yc-' || gen_random_uuid()::text;
  tg name; rate bigint; bk uuid; ag uuid; cp uuid; r jsonb; n int; st text; conf int; leg text;
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
  -- 7 October 2026 (D68d, D77): an agreement approved by the system (no
  -- decided_by) is payable only while no risk signal fires for it. This probe
  -- is about the payment, not the review, so its fixture deals are ordinary
  -- deals that raise no signal: the signals are switched off in
  -- agreement_risk_settings for this transaction only.
  update public.agreement_risk_settings
     set check_first_deal = false, check_amount = false, check_recent_change = false,
         check_payout_name = false, check_fraud_radar = false
   where id = 1;
  -- The example stay made real inside the transaction only (new-a1-03 lifts a
  -- gate the same way); everything rolls back.
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings disable trigger %I', tg);
  end loop;
  update public.listings set is_demo = false where id = stay;
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings enable trigger %I', tg);
  end loop;
  select rate_minor into rate from public.listings where id = stay;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 20, lagos + 22, 2, rate, rate * 2, rate * 2, 'PENDING') returning id into bk;
  -- The booking is priced by the listing; every figure below is its stored total.
  select total_minor / 2 into rate from public.bookings where id = bk;
  insert into public.deal_agreements (kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms, status)
  values ('stay', stay, bk, member, lister, rate * 2, '{}'::jsonb, 'approved') returning id into ag;
  insert into public.payout_accounts (agent_id, bank_name, account_number, account_name, is_default, bank_code,
                                      resolved_account_name, resolved_at, paystack_subaccount_code)
  values (agent, 'Probe Bank', '0123456789', 'PROBE LISTER', true, '058', 'PROBE LISTER', now(), 'ACCT_probe_lister');

  -- 1. No quote for a payer without KYC.
  begin
    insert into public.crypto_payments (reference, booking_id, payer_id, provider, asset, network, asset_decimals,
                                        amount_minor, rate_ngn, crypto_amount, quote_expires_at)
    values (ref, bk, member, 'yellowcard', 'USDT', 'TRON', 6, rate * 2, 1650.25, 1.000000, now() + interval '15 minutes');
    raise exception 'PROBE_FAIL crypto-pay: a quote was written for a payer without KYC';
  exception when insufficient_privilege then null;
  end;
  insert into public.identity_verifications (subject_id, method, outcome, legal_name, provider_ref)
  values (member, 'photo', 'matched', 'Probe Payer Legal', 'probe-kyc');

  -- 2. Not for the wrong amount, and precision beyond the asset is refused.
  begin
    insert into public.crypto_payments (reference, booking_id, payer_id, provider, asset, network, asset_decimals,
                                        amount_minor, rate_ngn, crypto_amount, quote_expires_at)
    values (ref, bk, member, 'yellowcard', 'USDT', 'TRON', 6, rate * 2 - 1, 1650.25, 1.000000, now() + interval '15 minutes');
    raise exception 'PROBE_FAIL crypto-pay: a quote was written for the wrong amount';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.crypto_payments (reference, booking_id, payer_id, provider, asset, network, asset_decimals,
                                        amount_minor, rate_ngn, crypto_amount, quote_expires_at)
    values (ref, bk, member, 'yellowcard', 'USDT', 'TRON', 6, rate * 2, 1650.25, 1.0000001, now() + interval '15 minutes');
    raise exception 'PROBE_FAIL crypto-pay: seven decimals of a six-decimal asset were stored';
  exception when check_violation then null;
  end;

  -- 3. The quote, then the attempt through the normal gate.
  insert into public.crypto_payments (reference, booking_id, payer_id, provider, asset, network, asset_decimals,
                                      amount_minor, rate_ngn, crypto_amount, quote_expires_at, provider_quote_id)
  values (ref, bk, member, 'yellowcard', 'USDT', 'TRON', 6, rate * 2, 1650.25, 103.014695, now() + interval '15 minutes', 'q-probe')
  returning id into cp;
  r := public.crypto_open_attempt(cp, 'ACCT_probe_reserve');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL crypto-pay: open %', r; end if;
  if r->>'lister_account_number' <> '0123456789' or r->>'lister_bank_code' <> '058' then
    raise exception 'PROBE_FAIL crypto-pay: the lister destination is %', r;
  end if;
  if (r->>'lister_share_minor')::bigint + (r->>'guarantee_minor')::bigint + (r->>'commission_minor')::bigint <> rate * 2 then
    raise exception 'PROBE_FAIL crypto-pay: the legs do not add up %', r;
  end if;
  select status::text, provider into st, leg from public.transactions where provider_ref = ref;
  if st <> 'PENDING' or leg <> 'yellowcard' then raise exception 'PROBE_FAIL crypto-pay: attempt % %', st, leg; end if;
  r := public.crypto_open_attempt(cp, 'ACCT_probe_reserve');
  if r->>'status' <> 'not_quoted' and r->>'status' <> 'already_open' then raise exception 'PROBE_FAIL crypto-pay: reopened %', r; end if;

  -- 4. Events, once each, in order.
  r := public.crypto_payment_apply(ref, 'yellowcard', 'probe-issue', 'app', 'awaiting_payment',
         jsonb_build_object('deposit_address', 'TProbeAddress1234567890', 'refund_address', 'TProbeRefund1234567890', 'provider_payment_id', 'yc-p-probe'));
  if r->>'outcome' <> 'applied' then raise exception 'PROBE_FAIL crypto-pay: issue %', r; end if;
  r := public.crypto_payment_apply(ref, 'yellowcard', 'probe-issue', 'webhook', 'awaiting_payment', '{}'::jsonb);
  if r->>'outcome' <> 'duplicate' then raise exception 'PROBE_FAIL crypto-pay: replay %', r; end if;
  r := public.crypto_payment_apply(ref, 'yellowcard', 'probe-c1', 'webhook', 'confirming',
         jsonb_build_object('confirmations', 1, 'confirmations_required', 19, 'tx_hash', 'probetxhash0000000001', 'crypto_received', '103.014695'));
  if r->>'outcome' <> 'applied' then raise exception 'PROBE_FAIL crypto-pay: confirming %', r; end if;
  r := public.crypto_payment_apply(ref, 'yellowcard', 'probe-c19', 'webhook', 'confirming', jsonb_build_object('confirmations', 19));
  if r->>'outcome' <> 'updated' then raise exception 'PROBE_FAIL crypto-pay: progress %', r; end if;
  select confirmations into conf from public.crypto_payments where id = cp;
  if conf <> 19 then raise exception 'PROBE_FAIL crypto-pay: confirmations %', conf; end if;
  select processor_status into leg from public.transactions where provider_ref = ref;
  if leg is distinct from 'processing' then raise exception 'PROBE_FAIL crypto-pay: in-flight marker %', leg; end if;
  r := public.crypto_payment_apply(ref, 'yellowcard', 'probe-conv', 'webhook', 'converting', '{}'::jsonb);
  if r->>'outcome' <> 'applied' then raise exception 'PROBE_FAIL crypto-pay: converting %', r; end if;
  r := public.crypto_payment_apply(ref, 'yellowcard', 'probe-late', 'webhook', 'confirming', '{}'::jsonb);
  if r->>'outcome' <> 'refused' then raise exception 'PROBE_FAIL crypto-pay: went backwards %', r; end if;

  -- 5. A settlement that is not exactly the charge is refused and alerted.
  r := public.crypto_payment_apply(ref, 'yellowcard', 'probe-bad-settle', 'webhook', 'settled', jsonb_build_object('settled_minor', rate * 2 - 1));
  if r->>'outcome' <> 'amount-mismatch' then raise exception 'PROBE_FAIL crypto-pay: short settlement %', r; end if;
  -- A settled report that states no settled amount is refused the same way.
  r := public.crypto_payment_apply(ref, 'yellowcard', 'probe-no-settle-amount', 'webhook', 'settled', '{}'::jsonb);
  if r->>'outcome' <> 'amount-mismatch' then raise exception 'PROBE_FAIL crypto-pay: settlement with no amount %', r; end if;
  select state into st from public.crypto_payments where id = cp;
  if st <> 'converting' then raise exception 'PROBE_FAIL crypto-pay: short settlement moved to %', st; end if;

  -- 6. The settlement: charge paid, one AML record with the KYC identity.
  r := public.crypto_payment_apply(ref, 'yellowcard', 'probe-settle', 'webhook', 'settled', jsonb_build_object('settled_minor', rate * 2));
  if r->>'outcome' <> 'applied' or r->'charge'->>'outcome' <> 'settled' then raise exception 'PROBE_FAIL crypto-pay: settle %', r; end if;
  select status::text into st from public.transactions where provider_ref = ref;
  if st <> 'SUCCESSFUL' then raise exception 'PROBE_FAIL crypto-pay: attempt is %', st; end if;
  select status::text into st from public.deal_agreements where id = ag;
  if st <> 'paid' then raise exception 'PROBE_FAIL crypto-pay: agreement is %', st; end if;
  select count(*) into n from public.crypto_aml_records
   where crypto_payment_id = cp and payer_legal_name = 'Probe Payer Legal' and asset = 'USDT' and network = 'TRON'
     and tx_hash = 'probetxhash0000000001' and amount_minor = rate * 2 and provider_reference = 'yc-p-probe';
  if n <> 1 then raise exception 'PROBE_FAIL crypto-pay: % AML records', n; end if;
  r := public.crypto_payment_apply(ref, 'yellowcard', 'probe-settle-2', 'reconcile', 'settled', jsonb_build_object('settled_minor', rate * 2));
  if r->>'outcome' <> 'stale' then raise exception 'PROBE_FAIL crypto-pay: second settle %', r; end if;
  select count(*) into n from public.ledger_entries where booking_id = bk;
  if n <> 1 then raise exception 'PROBE_FAIL crypto-pay: % ledger rows', n; end if;

  -- 7. Append-only.
  begin
    update public.crypto_aml_records set payer_legal_name = 'x' where crypto_payment_id = cp;
    raise exception 'PROBE_FAIL crypto-pay: an AML record was changed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.crypto_payment_events where crypto_payment_id = cp;
    raise exception 'PROBE_FAIL crypto-pay: an event was deleted';
  exception when insufficient_privilege then null;
  end;

  -- 8. The API roles: the payer reads their own row and nothing else.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  select count(*) into n from public.crypto_payments where id = cp;
  if n <> 1 then raise exception 'PROBE_FAIL crypto-pay: the payer cannot read their payment'; end if;
  select count(*) into n from public.crypto_aml_records;
  if n <> 0 then raise exception 'PROBE_FAIL crypto-pay: a member can read AML records'; end if;
  begin
    update public.crypto_payments set state = 'settled' where id = cp;
    raise exception 'PROBE_FAIL crypto-pay: a member can update a crypto payment';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.crypto_payment_apply(ref, 'yellowcard', 'probe-member', 'webhook', 'settled', '{}'::jsonb);
    raise exception 'PROBE_FAIL crypto-pay: a member can call the apply door';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', lister, 'role', 'authenticated')::text, true);
  select count(*) into n from public.crypto_payments where id = cp;
  if n <> 0 then raise exception 'PROBE_FAIL crypto-pay: somebody else can read the payment'; end if;
  reset role;
  set local role anon;
  begin
    perform 1 from public.crypto_payments limit 1;
    raise exception 'PROBE_FAIL crypto-pay: anon can read crypto payments';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise exception 'PROBE_OK crypto-pay';
end $$;
