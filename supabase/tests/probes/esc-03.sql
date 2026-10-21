-- ESC-03 and SUP-P2-02: holding a calendar costs something. Three unconfirmed
-- stays per guest and one per listing, at most 90 nights; OPS-02 (b): the hold
-- sweep spares a hold whose payment started in the last two hours, never past
-- its TTL plus two hours, and releases a stale one; two host declines do not
-- start a guest's cooldown, two lapsed holds do; a rent move-in date already
-- held answers date_taken. Rolls back.
-- 29 September 2026: a charge now opens only through the payment gate
-- (transactions_00_payment_gate: an approved agreement for the same amount and
-- the Paystack split), and a rent charge only on an approved rent agreement
-- (rent_payments_00_needs_approved_agreement). The OPS-02 fixtures therefore
-- file an approved agreement and the split for each hold before its charge,
-- and the rent fixture files the approved rent agreement. "In flight" is now
-- private.payment_attempt_in_flight (opened in the last 45 minutes, or the
-- processor last said ongoing within 2 hours), so the spared hold's
-- hour-old charge carries a processor status of ongoing checked 10 minutes
-- ago. Every assertion is unchanged. The fixture bookings are no longer
-- deleted (agreements and their frozen terms hold them by foreign key); none
-- of them counts toward the cooldown on s4.
do $$
declare
  member uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  lister uuid := 'e0000000-0000-4000-8000-000000000001';
  s1 uuid := 'ed000000-0000-4000-8000-000000000003';
  s2 uuid := 'ed000000-0000-4000-8000-000000000037';
  s3 uuid := 'ed000000-0000-4000-8000-000000000039';
  s4 uuid := 'ed000000-0000-4000-8000-000000000018';
  rental uuid := 'ed000000-0000-4000-8000-000000000007';
  lagos date := (now() at time zone 'Africa/Lagos')::date;
  claims text := json_build_object('sub', '957b3bd2-cce3-425d-bba9-5cd876ca3d62', 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text;
  b uuid; b_old uuid; b_paying uuid; b_capped uuid; d1 uuid; d2 uuid; bid uuid; ag uuid; amt bigint; g bigint; host uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43'; insp uuid; r jsonb; st text;
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
                'ed000000-0000-4000-8000-000000000007',
                'ed000000-0000-4000-8000-000000000018',
                'ed000000-0000-4000-8000-000000000037',
                'ed000000-0000-4000-8000-000000000039')
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
    from public.listings where id in (s1, s2, s3, s4) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set is_demo = false, status = 'PUBLISHED' where id in (s1, s2, s3, s4);
  set local role authenticated;
  perform set_config('request.jwt.claims', claims, true);
  -- CONTROL: three unconfirmed stays on three listings.
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (s1, member, lagos + 10, lagos + 12, 2, 1, 2, 2, 'PENDING'),
         (s2, member, lagos + 10, lagos + 12, 2, 1, 2, 2, 'PENDING'),
         (s3, member, lagos + 10, lagos + 12, 2, 1, 2, 2, 'PENDING');
  -- REFUSAL: a fourth unconfirmed stay.
  begin
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
    values (s4, member, lagos + 10, lagos + 12, 2, 1, 2, 2, 'PENDING');
    raise exception 'PROBE_FAIL esc-03: a fourth hold was accepted';
  exception when check_violation then
    if sqlerrm not like 'booking_hold_limit%' then raise; end if;
  end;
  -- REFUSAL: a second hold on the same listing.
  begin
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
    values (s1, member, lagos + 20, lagos + 22, 2, 1, 2, 2, 'PENDING');
    raise exception 'PROBE_FAIL esc-03: a second hold on one listing was accepted';
  exception when check_violation then
    if sqlerrm not like 'booking_hold_limit%' then raise; end if;
  end;
  reset role;
  delete from public.bookings where guest_id = member;
  set local role authenticated;
  perform set_config('request.jwt.claims', claims, true);
  -- REFUSAL: a year held in one go (SUP-P2-02).
  begin
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
    values (s4, member, lagos + 1, lagos + 366, 365, 0, 0, 0, 'PENDING');
    raise exception 'PROBE_FAIL sup-p2-02: 365 nights accepted';
  exception when check_violation then
    if sqlerrm not like 'booking_too_long%' then raise; end if;
  end;
  reset role;

  -- OPS-02: the sweep spares a hold whose payment started in the last two
  -- hours, and releases one whose attempt is older.
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status, created_at)
  values (s1, member, lagos + 30, lagos + 31, 1, 1, 1, 1, 'PENDING', now() - interval '49 hours') returning id into b_paying;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status, created_at)
  values (s2, member, lagos + 30, lagos + 31, 1, 1, 1, 1, 'PENDING', now() - interval '49 hours') returning id into b_old;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status, created_at)
  values (s3, member, lagos + 30, lagos + 31, 1, 1, 1, 1, 'PENDING', now() - interval '51 hours') returning id into b_capped;
  -- Each charge goes through the gate: an approved agreement for the booking's
  -- stored total, and the split.
  foreach bid in array array[b_paying, b_old, b_capped] loop
    select total_minor into amt from public.bookings where id = bid;
    -- 17 October 2026 (D73 as refined on 13 October, DECISIONS_2026-10-13.md
    -- row 21; pov03): a nightly shortlet no longer takes the hotel row; it is
    -- escrow unless the guest picks card, and a Paystack charge carries only
    -- the direct rail. Each fixture agreement records the guest's choice of
    -- card, as the pay page does, so the sweep is tested on the card charges
    -- it was written for.
    insert into public.deal_agreements (kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms,
           status, decided_at, decided_by, payer_rail_choice, payer_rail_chosen_at)
    select 'stay', listing_id, id, guest_id, lister, amt, '{}'::jsonb, 'approved', now() - interval '47 hours', host,
           'card', now() - interval '47 hours'
      from public.bookings where id = bid
    returning id into ag;
    g := (amt * 150) / 10000;
    insert into public.transactions (booking_id, provider, provider_ref, amount_minor, status, created_at, agreement_id,
           payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor,
           processor_status, processor_checked_at)
    values (bid, 'paystack', 'probe-m7-' || bid, amt, 'PENDING',
            case bid when b_paying then now() - interval '1 hour' when b_old then now() - interval '3 hours'
                     else now() - interval '30 minutes' end,
            ag, lister, 'ACCT_probe_payee', 'ACCT_probe_reserve', amt - g, g, 0,
            case when bid = b_paying then 'ongoing' end,
            case when bid = b_paying then now() - interval '10 minutes' end);
  end loop;
  r := private.expire_booking_holds(interval '48 hours', 500);
  select status::text into st from public.bookings where id = b_paying;
  if st <> 'PENDING' then raise exception 'PROBE_FAIL ops-02: a hold with a payment in flight was released (%)', r; end if;
  select status::text into st from public.bookings where id = b_old;
  if st <> 'CANCELLED' then raise exception 'PROBE_FAIL ops-02: a stale hold was kept (%)', r; end if;
  select status::text into st from public.bookings where id = b_capped;
  if st <> 'CANCELLED' then raise exception 'PROBE_FAIL esc-03: a fresh checkout kept a hold past its cap (%)', r; end if;

  -- Two holds the HOST declined do not start the guest's cooldown.
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (s4, member, lagos + 60, lagos + 61, 1, 1, 1, 1, 'CANCELLED') returning id into d1;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (s4, member, lagos + 62, lagos + 63, 1, 1, 1, 1, 'CANCELLED') returning id into d2;
  insert into public.booking_state_events (booking_id, from_status, to_status, actor_id, note) values
    (d1, 'PENDING', 'CANCELLED', host, 'declined'), (d2, 'PENDING', 'CANCELLED', host, 'declined');
  set local role authenticated;
  perform set_config('request.jwt.claims', claims, true);
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (s4, member, lagos + 64, lagos + 65, 1, 1, 1, 1, 'PENDING') returning id into b;
  reset role;
  delete from public.bookings where id = b;
  -- ...but two the guest let lapse do.
  update public.booking_state_events set actor_id = null where booking_id in (d1, d2);
  set local role authenticated;
  perform set_config('request.jwt.claims', claims, true);
  begin
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
    values (s4, member, lagos + 66, lagos + 67, 1, 1, 1, 1, 'PENDING');
    raise exception 'PROBE_FAIL esc-03: the cooldown did not start after two lapsed holds';
  exception when check_violation then
    if sqlerrm not like 'booking_rate_limit%' then raise; end if;
  end;
  reset role;

  -- ESC-03 amendment: a rent move-in date held by a stay answers date_taken.
  -- SCUML item 17 (live 29 Sep): an agent listing goes live only on an
  -- approved mandate. The fixture files one as the platform would.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id = rental and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set is_demo = false, status = 'PUBLISHED', listing_intent = 'rent',
         rent_amount_minor = 150000000, rent_period = 'year', rate_minor = 0, rate_period = null
   where id = rental;
  perform set_config('vallo.rent_charge', 'true', true);
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (rental, lister, lagos + 40, lagos + 41, 1, 1, 1, 1, 'CONFIRMED');
  perform set_config('vallo.rent_charge', '', true);
  insert into public.inspection_requests (listing_id, requester_id, lister_id, state, requested_at, slot_at)
  values (rental, member, lister, 'CONFIRMED', now(), now() + interval '1 day') returning id into insp;
  insert into public.deal_agreements (kind, listing_id, inspection_id, renter_id, owner_id, amount_minor, terms,
         status, decided_at, decided_by)
  values ('rent', rental, insp, member, lister, 150000000, '{}'::jsonb, 'approved', now(), host);
  r := private.open_rent_charge(member, insp, lagos + 40);
  if r->>'status' <> 'date_taken' then raise exception 'PROBE_FAIL esc-03: rent on a held date answered %', r; end if;
  r := private.open_rent_charge(member, insp, lagos + 42);
  if r->>'status' <> 'ok' then raise exception 'PROBE_FAIL esc-03: rent control %', r; end if;
  raise exception 'PROBE_OK esc-03';
end $$;
