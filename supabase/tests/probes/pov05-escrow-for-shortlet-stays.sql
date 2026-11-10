-- POV05 (pending migrations pov01 to pov05): a shortlet stay can be held in
-- escrow, a card choice is never also held, a held stay counts as paid for
-- the trip details, and the hold sweep, marked by its own entry points,
-- never cancels money the partner holds or is still moving. A cancel of a
-- held stay needs the explicit unwind; an unfunded arrangement is cancelled
-- with its stay; released and split are terminal; rent_split_cancel stops
-- when nothing was cancelled; a double payment raises an alert.
-- Everything is rolled back by the final raise.
do $$
declare
  guest constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  host  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  v_short uuid;
  b_short uuid := gen_random_uuid();
  a_short uuid := gen_random_uuid();
  b_un uuid := gen_random_uuid();
  a_un uuid := gen_random_uuid();
  b_mv uuid := gen_random_uuid();
  a_mv uuid := gen_random_uuid();
  b_rel uuid := gen_random_uuid();
  a_rel uuid := gen_random_uuid();
  arr uuid;
  start_day date := (now() at time zone 'Africa/Lagos')::date + 50;
  r jsonb;
  st text;
  refused boolean;
  alerts_before bigint;
begin
  select l.id into v_short from public.listings l
   where l.property_type = 'shortlet' and l.listing_intent = 'rent' and l.rate_period = 'night' limit 1;
  if v_short is null then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: fixtures missing (a nightly shortlet)';
  end if;
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', host, now(), 'owner', 'call_back', host, now()
    from public.listings where id = v_short and listing_role <> 'owner' and not private.listing_has_live_mandate(id);
  update public.listings set is_demo = false where id = v_short;
  /* The open reads private.rentals_protected_pay_on(), which since 10 November
     2026 follows payments_escrowpay_on. Both on, inside this transaction only. */
  update public.feature_flags set enabled = true where key in ('payments_payluk_on', 'payments_escrowpay_on');
  update public.feature_flags set enabled = false where key = 'agreement_review_all';

  insert into public.bookings (id, listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (b_short, v_short, guest, start_day, start_day + 1, 1, 200000, 200000, 200000, 'CONFIRMED'),
         (b_un, v_short, guest, start_day + 3, start_day + 4, 1, 200000, 200000, 200000, 'CONFIRMED'),
         (b_mv, v_short, guest, start_day + 6, start_day + 7, 1, 200000, 200000, 200000, 'CONFIRMED'),
         (b_rel, v_short, guest, start_day + 9, start_day + 10, 1, 200000, 200000, 200000, 'CONFIRMED');
  insert into public.deal_agreements (id, kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms, status, decided_by, decided_at)
  values (a_short, 'stay', v_short, b_short, guest, host, 200000, '{"check_in": "2030-01-01"}'::jsonb, 'approved', host, now()),
         (a_un, 'stay', v_short, b_un, guest, host, 200000, '{"check_in": "2030-01-01"}'::jsonb, 'approved', host, now()),
         (a_mv, 'stay', v_short, b_mv, guest, host, 200000, '{"check_in": "2030-01-01"}'::jsonb, 'approved', host, now()),
         (a_rel, 'stay', v_short, b_rel, guest, host, 200000, '{"check_in": "2030-01-01"}'::jsonb, 'approved', host, now());

  -- 0. The custody guard stays as it is, and nothing here is named like custody.
  if not exists (select 1 from pg_event_trigger where evtfoid = 'private.refuse_custody_objects()'::regprocedure and evtenabled <> 'D') then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: the custody guard is not enabled';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('public', 'private') and p.proname ~ '(^|_)escrows?(_|$)') then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: a function is named like custody';
  end if;

  -- 1. A stay at a listing is no longer refused for its kind.
  r := public.provider_arrangement_open(a_short, 'standard', null);
  if r ->> 'status' in ('not_payable', 'not_escrow') then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: an escrow shortlet stay could not open: %', r;
  end if;

  -- 2. Card chosen: never also held.
  update public.provider_arrangements set status = 'cancelled' where agreement_id = a_short;
  update public.deal_agreements set payer_rail_choice = 'card', payer_rail_chosen_at = now() where id = a_short;
  r := public.provider_arrangement_open(a_short, 'standard', null);
  if r ->> 'status' <> 'not_escrow' then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: a card choice opened escrow: %', r;
  end if;
  update public.deal_agreements set payer_rail_choice = 'escrow', payer_rail_chosen_at = now() where id = a_short;

  -- 3. Held money counts as paid for the stay; money only on its way does not.
  if private.booking_is_paid(b_short) then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: an unpaid stay read as paid';
  end if;
  insert into public.provider_arrangements (agreement_id, kind, reference, amount_minor, buyer_user_id, seller_user_id,
                                            buyer_customer_id, seller_customer_id, status)
  values (a_short, 'standard', 'vallo-arr-probe-' || replace(gen_random_uuid()::text, '-', ''), 200000, guest, host,
          'probe-b', 'probe-s', 'protected');
  if not private.booking_is_paid(b_short) then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: a held stay did not read as paid';
  end if;

  -- 4. The sweep is marked by its own entry points, never by the statement text.
  if pg_get_functiondef('private.release_stale_booking_holds()'::regprocedure) !~ 'vallo\.hold_sweep'
     or pg_get_functiondef('public.expire_booking_holds(interval, integer)'::regprocedure) !~ 'vallo\.hold_sweep'
     or pg_get_functiondef('private.in_hold_sweep()'::regprocedure) ~* 'current_query' then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: the sweep is not marked by its entry points';
  end if;

  -- 5. The sweep leaves a held stay alone.
  perform set_config('vallo.hold_sweep', 'on', true);
  update public.bookings set status = 'CANCELLED' where id = b_short;
  perform set_config('vallo.hold_sweep', '', true);
  select status::text into st from public.bookings where id = b_short;
  if st <> 'CONFIRMED' then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: the sweep cancelled a held stay (%)', st;
  end if;

  -- 6. Anything else is told to unwind it through the held payment.
  refused := false;
  begin
    update public.bookings set status = 'CANCELLED' where id = b_short;
  exception when insufficient_privilege then
    refused := sqlerrm like 'partner_hold:%';
  end;
  if not refused then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: a held stay was cancelled outside its held payment';
  end if;
  -- 6b. The unwind path (staff, or after the partner returned the money) is explicit.
  if public.partner_hold_unwind_cancel(b_short, 'probe') <> 'partner_holds' then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: the unwind cancelled while the partner still holds the money';
  end if;
  perform set_config('vallo.partner_hold_unwind', 'on', true);
  update public.bookings set status = 'CANCELLED' where id = b_short;
  perform set_config('vallo.partner_hold_unwind', '', true);
  if (select status::text from public.bookings where id = b_short) <> 'CANCELLED' then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: the explicit unwind could not cancel';
  end if;

  -- 7. Money still moving (unknown, payment_processing) is never cancelled
  --    automatically, and not by anyone without the unwind.
  insert into public.provider_arrangements (agreement_id, kind, reference, amount_minor, buyer_user_id, seller_user_id,
                                            buyer_customer_id, seller_customer_id, status, created_at)
  values (a_mv, 'standard', 'vallo-arr-probe-' || replace(gen_random_uuid()::text, '-', ''), 200000, guest, host,
          'probe-b', 'probe-s', 'unknown', now() - interval '3 days');
  perform set_config('vallo.hold_sweep', 'on', true);
  update public.bookings set status = 'CANCELLED' where id = b_mv;
  perform set_config('vallo.hold_sweep', '', true);
  if (select status::text from public.bookings where id = b_mv) <> 'CONFIRMED' then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: the sweep cancelled a stay whose payment is unknown';
  end if;
  refused := false;
  begin
    update public.bookings set status = 'CANCELLED' where id = b_mv;
  exception when insufficient_privilege then
    refused := sqlerrm like 'partner_payment_moving:%';
  end;
  if not refused then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: a stay was cancelled while its payment was unknown';
  end if;

  -- 8. An unfunded arrangement: two hours' grace from the sweep, then the
  --    stay and the arrangement are cancelled together.
  insert into public.provider_arrangements (agreement_id, kind, reference, amount_minor, buyer_user_id, seller_user_id,
                                            buyer_customer_id, seller_customer_id, status, created_at)
  values (a_un, 'standard', 'vallo-arr-probe-' || replace(gen_random_uuid()::text, '-', ''), 200000, guest, host,
          'probe-b', 'probe-s', 'awaiting_payment', now() - interval '10 minutes')
  returning id into arr;
  perform set_config('vallo.hold_sweep', 'on', true);
  update public.bookings set status = 'CANCELLED' where id = b_un;
  if (select status::text from public.bookings where id = b_un) <> 'CONFIRMED' then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: the sweep did not give an unfunded arrangement its two hours';
  end if;
  update public.provider_arrangements set created_at = now() - interval '3 hours' where id = arr;
  update public.bookings set status = 'CANCELLED' where id = b_un;
  perform set_config('vallo.hold_sweep', '', true);
  if (select status::text from public.bookings where id = b_un) <> 'CANCELLED'
     or (select status from public.provider_arrangements where id = arr) <> 'cancelled'
     or not exists (select 1 from public.provider_arrangement_events e where e.arrangement_id = arr and e.to_status = 'cancelled') then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: the sweep did not cancel the unfunded arrangement with its stay';
  end if;

  -- 9. Released (terminal): the sweep never cancels it; a person's cancel stands.
  insert into public.provider_arrangements (agreement_id, kind, reference, amount_minor, buyer_user_id, seller_user_id,
                                            buyer_customer_id, seller_customer_id, status)
  values (a_rel, 'standard', 'vallo-arr-probe-' || replace(gen_random_uuid()::text, '-', ''), 200000, guest, host,
          'probe-b', 'probe-s', 'released');
  perform set_config('vallo.hold_sweep', 'on', true);
  update public.bookings set status = 'CANCELLED' where id = b_rel;
  perform set_config('vallo.hold_sweep', '', true);
  if (select status::text from public.bookings where id = b_rel) <> 'CONFIRMED' then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: the sweep cancelled a released stay';
  end if;
  update public.bookings set status = 'CANCELLED' where id = b_rel;
  if (select status::text from public.bookings where id = b_rel) <> 'CANCELLED' then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: a released stay could not be closed by a person';
  end if;

  -- 10. A partner-funded arrangement on a deal already paid by card raises an alert.
  select count(*) into alerts_before from public.risk_alerts where entity_id = a_mv::text and severity::text = 'high';
  update public.deal_agreements set payer_rail_choice = 'card', payer_rail_chosen_at = now() where id = a_mv;
  insert into public.transactions (booking_id, agreement_id, provider, provider_ref, amount_minor, currency, status,
                                   lister_share_minor, guarantee_minor, commission_minor, payee_subaccount_code)
  values (b_mv, a_mv, 'paystack', 'rm-book-probe-' || replace(gen_random_uuid()::text, '-', ''), 200000, 'NGN', 'PENDING',
          200000, 0, 0, 'ACCT_probe');
  update public.transactions set status = 'SUCCESSFUL' where booking_id = b_mv and provider = 'paystack';
  update public.provider_arrangements set status = 'protected' where agreement_id = a_mv;
  if (select count(*) from public.risk_alerts where entity_id = a_mv::text and severity::text = 'high') <= alerts_before then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: a deal funded twice raised no alert';
  end if;

  -- 11. rent_split_cancel says partner_holds and checks FOUND.
  if pg_get_functiondef('private.rent_split_cancel(uuid, uuid, text, text)'::regprocedure) !~ 'if not found then'
     or pg_get_functiondef('private.rent_split_cancel(uuid, uuid, text, text)'::regprocedure) !~ 'partner_holds' then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: rent_split_cancel does not respect FOUND';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'bookings_00_partner_hold_keeps_the_stay' and tgenabled = 'O')
     or not exists (select 1 from pg_trigger where tgname = 'provider_arrangements_02_paid_twice_alert' and tgenabled = 'O') then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: a trigger is missing or disabled';
  end if;
  if has_function_privilege('authenticated', 'public.partner_hold_unwind_cancel(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.partner_hold_unwind_cancel(uuid, text)', 'execute') then
    raise exception 'PROBE_FAIL pov05-escrow-for-shortlet-stays: a member can call the unwind';
  end if;

  raise exception 'PROBE_OK pov05-escrow-for-shortlet-stays';
end
$$;
