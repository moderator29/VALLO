-- ESC-02 (with SUP-03, DB-P2-01, SEC-P2-01) and ESC-P2-01.
-- A guest's own insert is priced from the listing (a 3-kobo booking is stored
-- at the listing's nightly rate and cannot be paid for 3 kobo); past dates,
-- overlaps, host-blocked nights, rentals and unpublished listings are refused;
-- the deployed reserve() insert and the rent charge still work; neither the
-- guest nor an admin over the API can rewrite a booking, the owner role cannot
-- change its price, and a status change leaves an audit row. Always rolls back.
-- 29 September 2026: custody is retired (docs/MONEY_ARCHITECTURE.md), so the
-- wallet fixture and the pay_booking_from_wallet check are gone. "The 3-kobo
-- booking cannot be paid for 3 kobo" is now checked where payment opens: the
-- host's acceptance draws the stay agreement at the listing's price, and once
-- it is approved the payment gate refuses a 3-kobo charge and accepts only the
-- agreed amount with its split. The rent charge control files the approved
-- rent agreement that rent_payments_00_needs_approved_agreement now requires.
do $$
declare
  member uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  admin  uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  lister uuid := 'e0000000-0000-4000-8000-000000000001';
  stay   uuid := 'ed000000-0000-4000-8000-000000000003';
  rental uuid := 'ed000000-0000-4000-8000-000000000007';
  lagos  date := (now() at time zone 'Africa/Lagos')::date;
  claims text := json_build_object('sub', '957b3bd2-cce3-425d-bba9-5cd876ca3d62', 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text;
  bk uuid; bk2 uuid; insp uuid; r jsonb; n int; t bigint; rate bigint; ag public.deal_agreements%rowtype; g bigint;
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
  -- An example stay made real inside the transaction, and an example rental.
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
  -- SCUML item 17 (live 29 Sep): an agent listing goes live only on an
  -- approved mandate. The fixture files one as the platform would.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id = rental and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set is_demo = false, status = 'PUBLISHED', listing_intent = 'rent',
         rent_amount_minor = 150000000, rent_period = 'year', rate_minor = 0, rate_period = null,
         total_move_in_cost_minor = null
   where id = rental;

  -- ATTACK: three nights at 1 kobo, total 3. Stored price must be the listing's.
  set local role authenticated;
  perform set_config('request.jwt.claims', claims, true);
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, adults, children,
    price_per_night_minor, cleaning_fee_minor, service_fee_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 10, lagos + 13, 3, 1, 0, 1, 0, 0, 3, 3, 'PENDING')
  returning id into bk2;
  select total_minor into t from public.bookings where id = bk2;
  if t <> rate * 3 then raise exception 'PROBE_FAIL esc-02: 3-kobo booking stored total %', t; end if;
  -- ...and paying it cannot succeed for 3 kobo. The host accepts (the
  -- trigger draws the agreement from the stored booking), an admin approves,
  -- and the payment gate then takes only the agreed amount.
  reset role;
  update public.bookings set status = 'CONFIRMED' where id = bk2;
  select * into ag from public.deal_agreements where booking_id = bk2;
  if ag.id is null or ag.kind <> 'stay' or ag.amount_minor <> rate * 3 then
    raise exception 'PROBE_FAIL esc-02: the accepted 3-kobo booking drew agreement % for %', ag.id, ag.amount_minor;
  end if;
  -- 17 October 2026 (D73 as refined on 13 October, DECISIONS_2026-10-13.md
  -- row 21; pov02 and pov03): a nightly shortlet is now escrow unless the payer
  -- picks card, and a Paystack charge carries only the direct rail. The guest
  -- picks card, as the pay page records it, so the gate below is the same
  -- direct-rail gate this probe was written against.
  update public.deal_agreements set status = 'approved', decided_at = now(), decided_by = admin,
         payer_rail_choice = 'card', payer_rail_chosen_at = now()
   where id = ag.id;
  r := public.payment_split_for_booking(bk2);
  if r->>'status' not in ('ok', 'payee_not_set_up') or (r->>'status' = 'ok' and (r->>'amount_minor')::bigint <> rate * 3) then
    raise exception 'PROBE_FAIL esc-02: split for the 3-kobo booking answered %', r;
  end if;
  begin
    insert into public.transactions (booking_id, provider, provider_ref, amount_minor, status, agreement_id,
      payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
    values (bk2, 'paystack', 'probe-esc02-3kobo-' || gen_random_uuid(), 3, 'PENDING', ag.id,
      ag.owner_id, 'ACCT_probe_payee', 'ACCT_probe_reserve', 3, 0, 0);
    raise exception 'PROBE_FAIL esc-02: a 3-kobo charge opened against the agreement';
  exception when insufficient_privilege then
    if sqlerrm not like 'payment_gate:%' then raise; end if;
  end;
  -- CONTROL: the agreed amount, with its split, opens.
  g := (rate * 3 * coalesce((ag.terms ->> 'guarantee_bps')::int, 150)) / 10000;
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, status, agreement_id,
    payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
  values (bk2, 'paystack', 'probe-esc02-agreed-' || gen_random_uuid(), rate * 3, 'PENDING', ag.id,
    ag.owner_id, 'ACCT_probe_payee', 'ACCT_probe_reserve', rate * 3 - g - (rate * 3 * coalesce((ag.terms ->> 'commission_bps')::int, 0)) / 10000,
    g, (rate * 3 * coalesce((ag.terms ->> 'commission_bps')::int, 0)) / 10000);

  -- ATTACK: the same insert with the rent charge's mark set. The mark is
  -- honoured only for a non-API session role, so this is priced too.
  set local role authenticated;
  perform set_config('request.jwt.claims', claims, true);
  perform set_config('vallo.rent_charge', 'true', true);
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, adults, children,
    price_per_night_minor, cleaning_fee_minor, service_fee_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 70, lagos + 73, 3, 1, 0, 1, 0, 0, 3, 3, 'PENDING')
  returning id into bk2;
  perform set_config('vallo.rent_charge', '', true);
  select total_minor into t from public.bookings where id = bk2;
  if t <> rate * 3 then raise exception 'PROBE_FAIL esc-02: marked guest insert stored total %', t; end if;
  reset role;
  delete from public.bookings where id = bk2;

  -- CONTROL: the deployed reserve() insert, honestly priced, succeeds unchanged.
  set local role authenticated;
  perform set_config('request.jwt.claims', claims, true);
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, adults, children,
    price_per_night_minor, cleaning_fee_minor, service_fee_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 30, lagos + 32, 2, 1, 0, rate, 0, 0, rate * 2, rate * 2, 'PENDING')
  returning id into bk;
  select total_minor into t from public.bookings where id = bk;
  if t <> rate * 2 then raise exception 'PROBE_FAIL esc-02: honest booking stored %', t; end if;

  -- REFUSAL: past check-in.
  begin
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, adults, children,
      price_per_night_minor, cleaning_fee_minor, service_fee_minor, subtotal_minor, total_minor, status)
    values (stay, member, lagos - 10, lagos - 8, 2, 1, 0, rate, 0, 0, rate * 2, rate * 2, 'PENDING');
    raise exception 'PROBE_FAIL esc-02: past booking accepted';
  exception when check_violation then null;
  end;

  -- REFUSAL: a stay booking on a rental (no nightly rate).
  begin
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, adults, children,
      price_per_night_minor, cleaning_fee_minor, service_fee_minor, subtotal_minor, total_minor, status)
    values (rental, member, lagos + 40, lagos + 41, 1, 1, 0, 1, 0, 0, 1, 1, 'PENDING');
    raise exception 'PROBE_FAIL esc-02: booking on a rental accepted';
  exception when check_violation then null;
  end;

  -- REFUSAL: overlapping dates (checked as another guest, so the per-guest
  -- hold limit is not what refuses it).
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  begin
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, adults, children,
      price_per_night_minor, cleaning_fee_minor, service_fee_minor, subtotal_minor, total_minor, status)
    values (stay, admin, lagos + 31, lagos + 33, 2, 1, 0, rate, 0, 0, rate * 2, rate * 2, 'PENDING');
    raise exception 'PROBE_FAIL esc-02: overlap accepted';
  exception when exclusion_violation then null;
  end;
  perform set_config('request.jwt.claims', claims, true);

  -- REFUSAL: host-blocked nights and an unpublished listing (the honest
  -- booking is set aside first so only the rule under test can refuse).
  reset role;
  delete from public.bookings where id = bk;
  insert into public.availability (listing_id, date, status) values (stay, lagos + 50, 'unavailable');
  set local role authenticated;
  perform set_config('request.jwt.claims', claims, true);
  begin
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, adults, children,
      price_per_night_minor, cleaning_fee_minor, service_fee_minor, subtotal_minor, total_minor, status)
    values (stay, member, lagos + 49, lagos + 51, 2, 1, 0, rate, 0, 0, rate * 2, rate * 2, 'PENDING');
    raise exception 'PROBE_FAIL esc-02: blocked night accepted';
  exception when exclusion_violation then null;
  end;
  reset role;
  update public.listings set status = 'DRAFT' where id = stay;
  set local role authenticated;
  perform set_config('request.jwt.claims', claims, true);
  begin
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, adults, children,
      price_per_night_minor, cleaning_fee_minor, service_fee_minor, subtotal_minor, total_minor, status)
    values (stay, member, lagos + 60, lagos + 61, 1, 1, 0, rate, 0, 0, rate, rate, 'PENDING');
    raise exception 'PROBE_FAIL esc-02: booking on a draft accepted';
  exception when check_violation then null;
  end;
  reset role;
  -- SCUML item 17 (live 29 Sep): an agent listing goes live only on an
  -- approved mandate. The fixture files one as the platform would.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id = stay and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set status = 'PUBLISHED' where id = stay;

  -- CONTROL: the rent charge still opens, priced from the move-in figures.
  insert into public.inspection_requests (listing_id, requester_id, lister_id, state, requested_at, slot_at)
  values (rental, member, lister, 'CONFIRMED', now(), now() + interval '1 day') returning id into insp;
  insert into public.deal_agreements (kind, listing_id, inspection_id, renter_id, owner_id, amount_minor, terms,
         status, decided_at, decided_by)
  values ('rent', rental, insp, member, lister, 150000000, '{}'::jsonb, 'approved', now(), admin);
  r := private.open_rent_charge(member, insp, lagos + 7);
  if r->>'status' <> 'ok' or (r->>'total_minor')::bigint <> 150000000 then
    raise exception 'PROBE_FAIL esc-02: rent charge %', r;
  end if;

  -- ESC-P2-01. The guest cannot touch their booking; an admin over the API
  -- can read it but not rewrite it; the owner role cannot change its price;
  -- a status change leaves an audit row.
  set local role authenticated;
  perform set_config('request.jwt.claims', claims, true);
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, adults, children,
    price_per_night_minor, cleaning_fee_minor, service_fee_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 30, lagos + 32, 2, 1, 0, rate, 0, 0, rate * 2, rate * 2, 'PENDING')
  returning id into bk;
  -- Refused by RLS (0 rows) today, and by the grant (42501) once MON-10's
  -- revoke is in; either way nothing changes.
  begin
    update public.bookings set total_minor = 1, status = 'CONFIRMED' where id = bk;
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  if n <> 0 then raise exception 'PROBE_FAIL esc-p2-01: guest updated % rows', n; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  select count(*) into n from public.bookings where id = bk;
  if n <> 1 then raise exception 'PROBE_FAIL esc-p2-01: admin cannot read the booking'; end if;
  -- Refused by RLS (0 rows) today, and by the grant (42501) once MON-10's
  -- revoke is in; either way nothing changes.
  begin
    update public.bookings set status = 'CONFIRMED', total_minor = 0, subtotal_minor = 0, price_per_night_minor = 0 where id = bk;
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  if n <> 0 then raise exception 'PROBE_FAIL esc-p2-01: admin rewrote % rows over the API', n; end if;
  -- Refused by RLS (0 rows) today, and by the grant (42501) once MON-10's
  -- revoke is in; either way nothing changes.
  begin
    update public.bookings set status = 'CONFIRMED' where id = bk;
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  if n <> 0 then raise exception 'PROBE_FAIL esc-p2-01: admin confirmed % rows over the API', n; end if;
  reset role;
  begin
    update public.bookings set total_minor = 0, subtotal_minor = 0, price_per_night_minor = 0 where id = bk;
    raise exception 'PROBE_FAIL esc-p2-01: price rewritten by the owner role';
  exception when insufficient_privilege then null;
  end;
  update public.bookings set status = 'CANCELLED' where id = bk;
  select count(*) into n from public.audit_log
   where entity_type = 'booking' and entity_id = bk::text and action = 'booking.status_changed';
  if n <> 1 then raise exception 'PROBE_FAIL esc-p2-01: % audit rows for a status change', n; end if;

  raise exception 'PROBE_OK esc-02';
end $$;
