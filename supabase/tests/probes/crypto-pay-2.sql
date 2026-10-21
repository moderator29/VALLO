-- CRYPTO-PAY-2: one payment of a charge at a time. A second crypto attempt on
-- a charge whose first crypto payment is moving is refused `in_flight`; so is
-- a crypto attempt while a card attempt on the charge is in flight; once the
-- first expires, a new one opens. A duplicate delivery about an unfinished
-- payment refreshes the in-flight clock on its PENDING transaction.
-- Rolls back.
do $$
declare
  member uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  lister uuid := 'e0000000-0000-4000-8000-000000000001';
  agent  uuid := 'e0000000-0000-4000-8000-000000000002';
  stay   uuid := 'ed000000-0000-4000-8000-000000000003';
  lagos  date := (now() at time zone 'Africa/Lagos')::date;
  ref_a  text := 'rm-yc-' || gen_random_uuid()::text;
  ref_b  text := 'rm-yc-' || gen_random_uuid()::text;
  ref_c  text := 'rm-yc-' || gen_random_uuid()::text;
  tg name; rate bigint; bk uuid; bk2 uuid; a uuid; b uuid; c uuid; r jsonb; checked timestamptz;
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
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 30, lagos + 32, 2, rate, rate * 2, rate * 2, 'PENDING') returning id into bk2;
  select total_minor / 2 into rate from public.bookings where id = bk;
  insert into public.deal_agreements (kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms, status)
  values ('stay', stay, bk, member, lister, rate * 2, '{}'::jsonb, 'approved'),
         ('stay', stay, bk2, member, lister, rate * 2, '{}'::jsonb, 'approved');
  insert into public.payout_accounts (agent_id, bank_name, account_number, account_name, is_default, bank_code,
                                      resolved_account_name, resolved_at, paystack_subaccount_code)
  values (agent, 'Probe Bank', '0123456789', 'PROBE LISTER', true, '058', 'PROBE LISTER', now(), 'ACCT_probe_lister');
  insert into public.identity_verifications (subject_id, method, outcome, legal_name, provider_ref)
  values (member, 'photo', 'matched', 'Probe Payer Legal', 'probe-kyc-2');

  insert into public.crypto_payments (reference, booking_id, payer_id, provider, asset, network, asset_decimals,
                                      amount_minor, rate_ngn, crypto_amount, quote_expires_at)
  values (ref_a, bk, member, 'yellowcard', 'USDT', 'TRON', 6, rate * 2, 1650.25, 103.014695, now() + interval '15 minutes')
  returning id into a;
  insert into public.crypto_payments (reference, booking_id, payer_id, provider, asset, network, asset_decimals,
                                      amount_minor, rate_ngn, crypto_amount, quote_expires_at)
  values (ref_b, bk, member, 'yellowcard', 'USDT', 'TRON', 6, rate * 2, 1650.25, 103.014695, now() + interval '15 minutes')
  returning id into b;

  -- 1. Two quotes are fine; the first opens.
  r := public.crypto_open_attempt(a, 'ACCT_probe_reserve');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL crypto-pay-2: first open %', r; end if;
  r := public.crypto_payment_apply(ref_a, 'yellowcard', 'p2-issue-a', 'app', 'awaiting_payment',
         jsonb_build_object('deposit_address', 'TProbeAddress1234567890', 'provider_payment_id', 'yc-p2-a'));
  if r->>'outcome' <> 'applied' then raise exception 'PROBE_FAIL crypto-pay-2: issue %', r; end if;

  -- 2. The second is refused while the first is moving.
  r := public.crypto_open_attempt(b, 'ACCT_probe_reserve');
  if r->>'status' <> 'in_flight' then raise exception 'PROBE_FAIL crypto-pay-2: second crypto payment opened %', r; end if;

  -- 3. A duplicate delivery refreshes the in-flight clock on the PENDING attempt.
  update public.transactions set processor_checked_at = now() - interval '3 hours' where provider_ref = ref_a;
  r := public.crypto_payment_apply(ref_a, 'yellowcard', 'p2-issue-a', 'webhook', 'awaiting_payment', '{}'::jsonb);
  if r->>'outcome' <> 'duplicate' then raise exception 'PROBE_FAIL crypto-pay-2: duplicate %', r; end if;
  select processor_checked_at into checked from public.transactions where provider_ref = ref_a;
  if checked < now() - interval '1 minute' then raise exception 'PROBE_FAIL crypto-pay-2: clock not refreshed %', checked; end if;

  -- 4. Once the first expires, the second opens.
  r := public.crypto_payment_apply(ref_a, 'yellowcard', 'p2-expire-a', 'reconcile', 'expired', '{}'::jsonb);
  if r->>'outcome' <> 'applied' then raise exception 'PROBE_FAIL crypto-pay-2: expire %', r; end if;
  r := public.crypto_open_attempt(b, 'ACCT_probe_reserve');
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL crypto-pay-2: after expiry %', r; end if;

  -- 5. A card attempt in flight on another charge blocks crypto on it.
  perform set_config('vallo.recording_unknown_charge', 'on', true);
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, checkout_opened_at)
  values (bk2, 'paystack', 'rm-book-' || gen_random_uuid()::text, rate * 2, 'NGN', 'PENDING', now());
  perform set_config('vallo.recording_unknown_charge', '', true);
  insert into public.crypto_payments (reference, booking_id, payer_id, provider, asset, network, asset_decimals,
                                      amount_minor, rate_ngn, crypto_amount, quote_expires_at)
  values (ref_c, bk2, member, 'yellowcard', 'USDT', 'TRON', 6, rate * 2, 1650.25, 103.014695, now() + interval '15 minutes')
  returning id into c;
  r := public.crypto_open_attempt(c, 'ACCT_probe_reserve');
  if r->>'status' <> 'in_flight' then raise exception 'PROBE_FAIL crypto-pay-2: crypto opened beside a card in flight %', r; end if;

  raise exception 'PROBE_OK crypto-pay-2';
end $$;
