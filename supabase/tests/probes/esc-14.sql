-- ESC-14: a stay the host accepted but the guest never paid lapses 24 hours
-- after acceptance, or on check-in day once the acceptance is two hours old,
-- and its nights go back. Controls left alone: a paid CONFIRMED stay, an
-- accepted stay still inside its 24 hours with a future check-in, a stay
-- accepted within the last two hours on check-in day, a payment in flight
-- (on check-in day too, up to 26 hours after acceptance), and a rent charge.
-- Rolls back.
-- 29 September 2026: payment now opens only on an approved agreement
-- (docs/MONEY_ARCHITECTURE.md), and the sweep's clock follows it: a stay whose
-- agreement is approved lapses 24 hours after APPROVAL, or on check-in day
-- once the approval is two hours old; one whose agreement still waits on the
-- parties or review is kept for 72 hours after acceptance unless check-in day
-- has come; a stay with no agreement (accepted before Track A) keeps the
-- acceptance clock. The fixtures now accept each stay the way the app does
-- (PENDING to CONFIRMED, so the trigger draws the agreement), approve it
-- where the case needs it, and open every charge through the payment gate
-- (approved agreement, same amount, the split); the paid stay's charge opens
-- PENDING and then succeeds. "In flight" is private.payment_attempt_in_flight
-- (opened in the last 45 minutes). Every original assertion is kept, with the
-- approval taking the place of the acceptance as the clock; the 26-hour cap
-- on a checkout is kept too (26 hours after approval). Added: a pre-Track-A
-- stay with no agreement still lapses on the acceptance clock, an agreement
-- awaiting the parties inside 72 hours is kept, and one past 72 hours lapses.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  admin  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  lister constant uuid := gen_random_uuid();   -- host, filed below
  lister_agent uuid;
  s1 constant uuid := gen_random_uuid();
  s2 constant uuid := gen_random_uuid();
  s3 constant uuid := gen_random_uuid();
  s4 constant uuid := gen_random_uuid();
  lagos date := (now() at time zone 'Africa/Lagos')::date;
  stale uuid; legacy uuid; today uuid; today_new uuid; today_paying uuid; fresh uuid; paid uuid; paying uuid;
  stalled uuid; waiting uuid; waiting_old uuid;
  -- one row per case: listing, check-in offset, nights, accepted hours ago,
  -- approved hours ago (null = the agreement still waits on the parties),
  -- charge opened minutes ago (null = none).
  c record; bid uuid; ag public.deal_agreements%rowtype; g bigint;
  r jsonb; st text; n int;
begin
  -- 16 November 2026: the example collection is gone from the live database (the
  -- Vallo Examples user e0000000-...-0001, its listings, hotels and threads; the
  -- agent row e0000000-...-0002 now belongs to a real account), and the founder
  -- does not want it back. This probe used to borrow it. It now files its own
  -- host for this transaction: a fresh auth user (the signup trigger makes the
  -- profile), an approved business agent, and fresh listings with the same facts
  -- as the example rows it borrowed: four nightly shortlets, in Lekki, Victoria
  -- Island, Lekki and Wuse 2 (s1 to s4). All of it is rolled back with the
  -- probe. Nothing asserted below changes.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (lister, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-esc-14-host-' || lister || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (lister, 'Probe esc-14 host', 'business', 'APPROVED')
  returning id into lister_agent;
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (s1, lister_agent, 'DRAFT', 'Probe One bedroom serviced flat, Lekki Phase 1', 'Fully furnished with an inverter that carries the flat through the night. Let by the night.', 'shortlet', 'LA', 'Lagos', 'Lekki Phase 1', 6.4472, 3.4738, 1, 1, 1, 'fully_furnished', 'rent', 8500000, 'night', 'agent');
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (s2, lister_agent, 'DRAFT', 'Probe One bedroom shortlet on Victoria Island', 'One bedroom with a kitchen, a work desk and a balcony, in a serviced block a street back from the water.', 'shortlet', 'LA', 'Lagos', 'Victoria Island', 6.4281, 3.4219, 1, 1, 1, 'fully_furnished', 'rent', 8500000, 'night', 'agent');
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (s3, lister_agent, 'DRAFT', 'Probe Two bedroom shortlet in Lekki Phase 1', 'Two bedrooms, both en suite, a living room that seats six, and twenty four hour power in the estate.', 'shortlet', 'LA', 'Lagos', 'Lekki Phase 1', 6.446, 3.4738, 2, 2, 2, 'fully_furnished', 'rent', 12000000, 'night', 'agent');
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (s4, lister_agent, 'DRAFT', 'Probe One bedroom serviced flat in Wuse 2', 'Furnished and let by the night, with a standby generator for the block.', 'shortlet', 'FC', 'Abuja', 'Wuse 2', 9.0812, 7.4668, 1, 1, 1, 'fully_furnished', 'rent', 7000000, 'night', 'agent');
  -- SCUML item 17 (live 29 Sep): an agent listing goes live only on an
  -- approved mandate. The fixture files one as the platform would.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id in (s1, s2, s3, s4) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set is_demo = false, status = 'PUBLISHED' where id in (s1, s2, s3, s4);

  for c in
    select * from (values
      ('stale',        s1, 10, 2, 26,  25,   null::int),
      ('today',        s2,  0, 1,  4,   3,   null),
      ('today_new',    s3,  0, 1,  2,   1,   null),
      ('today_paying', s4,  0, 1,  4,   3,   10),
      ('fresh',        s3, 20, 1,  3,   2,   null),
      ('paid',         s4, 30, 1, 80,  72,   null),
      ('paying',       s1, 40, 1, 26,  25,   20),
      ('stalled',      s2, 50, 1, 31,  30,   5),
      ('waiting',      s1, 70, 1,  2, null,  null),
      ('waiting_old',  s3, 80, 1, 73, null,  null)
    ) v(name, listing, off, nights, accepted_h, approved_h, charge_m)
  loop
    -- The guest asks, the host accepts: the acceptance trigger draws the agreement.
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
    values (c.listing, member, lagos + c.off, lagos + c.off + c.nights, c.nights, 1, 1, 1, 'PENDING') returning id into bid;
    update public.bookings set status = 'CONFIRMED' where id = bid;
    update public.booking_state_events set created_at = now() - make_interval(hours => c.accepted_h)
     where booking_id = bid and to_status = 'CONFIRMED';
    if not found then
      insert into public.booking_state_events (booking_id, from_status, to_status, note, created_at)
      values (bid, 'PENDING', 'CONFIRMED', 'accepted', now() - make_interval(hours => c.accepted_h));
    end if;
    select * into ag from public.deal_agreements where booking_id = bid;
    if ag.id is null or ag.status <> 'awaiting_parties' then
      raise exception 'PROBE_FAIL esc-14: accepting % drew no waiting agreement (%)', c.name, ag.status;
    end if;
    if c.approved_h is not null then
      update public.deal_agreements
         set status = 'approved', decided_by = admin, decided_at = now() - make_interval(hours => c.approved_h)
       where id = ag.id;
    end if;
    if c.charge_m is not null or c.name = 'paid' then
      -- 17 October 2026 (D73 as refined on 13 October, DECISIONS_2026-10-13.md
      -- row 21; pov03): a nightly shortlet no longer takes the hotel row; it
      -- is escrow unless the guest picks card, and a Paystack charge carries
      -- only the direct rail. A stay with a card charge records the guest's
      -- choice of card first, as the pay page does.
      update public.deal_agreements set payer_rail_choice = 'card', payer_rail_chosen_at = now() where id = ag.id;
      g := (ag.amount_minor * coalesce((ag.terms ->> 'guarantee_bps')::int, 150)) / 10000;
      insert into public.transactions (booking_id, provider, provider_ref, amount_minor, status, created_at, agreement_id,
             payee_user_id, payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
      values (bid, 'paystack', 'probe-esc14-' || c.name || '-' || bid, ag.amount_minor, 'PENDING',
              now() - make_interval(mins => coalesce(c.charge_m, 60 * 70)), ag.id,
              ag.owner_id, 'ACCT_probe_payee', 'ACCT_probe_reserve', ag.amount_minor - g, g, 0);
      if c.name = 'paid' then
        update public.transactions set status = 'SUCCESSFUL' where booking_id = bid;
        update public.deal_agreements set status = 'paid', paid_at = now() - interval '70 hours' where id = ag.id;
      end if;
    end if;
    case c.name
      when 'stale' then stale := bid;
      when 'today' then today := bid;
      when 'today_new' then today_new := bid;
      when 'today_paying' then today_paying := bid;
      when 'fresh' then fresh := bid;
      when 'paid' then paid := bid;
      when 'paying' then paying := bid;
      when 'stalled' then stalled := bid;
      when 'waiting' then waiting := bid;
      else waiting_old := bid;
    end case;
  end loop;
  insert into public.availability (listing_id, date, status) values (s1, lagos + 10, 'booked'), (s1, lagos + 11, 'booked')
  on conflict do nothing;

  -- A stay accepted before Track A has no agreement; the acceptance is its clock.
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (s4, member, lagos + 60, lagos + 61, 1, 1, 1, 1, 'CONFIRMED') returning id into legacy;
  insert into public.booking_state_events (booking_id, from_status, to_status, note, created_at)
  values (legacy, 'PENDING', 'CONFIRMED', 'accepted', now() - interval '25 hours');

  r := private.expire_booking_holds(interval '48 hours', 500);

  select status::text into st from public.bookings where id = stale;
  if st <> 'CANCELLED' then raise exception 'PROBE_FAIL esc-14: approved 25h ago and unpaid is %', st; end if;
  select count(*) into n from public.availability where listing_id = s1 and date in (lagos + 10, lagos + 11) and status = 'booked';
  if n <> 0 then raise exception 'PROBE_FAIL esc-14: the nights were not given back'; end if;
  select count(*) into n from public.deal_agreements where booking_id = stale and status = 'cancelled';
  if n <> 1 then raise exception 'PROBE_FAIL esc-14: the lapsed stay''s agreement was not cancelled'; end if;
  select status::text into st from public.bookings where id = legacy;
  if st <> 'CANCELLED' then raise exception 'PROBE_FAIL esc-14: accepted 25h ago with no agreement and unpaid is %', st; end if;
  select status::text into st from public.bookings where id = today;
  if st <> 'CANCELLED' then raise exception 'PROBE_FAIL esc-14: unpaid on check-in day, approved 3h ago, is %', st; end if;
  select status::text into st from public.bookings where id = today_new;
  if st <> 'CONFIRMED' then raise exception 'PROBE_FAIL esc-14: approved 1h ago on check-in day was cancelled'; end if;
  select status::text into st from public.bookings where id = today_paying;
  if st <> 'CONFIRMED' then raise exception 'PROBE_FAIL esc-14: a payment in flight on check-in day was not waited for'; end if;
  select status::text into st from public.bookings where id = fresh;
  if st <> 'CONFIRMED' then raise exception 'PROBE_FAIL esc-14: approved 2h ago was cancelled'; end if;
  select status::text into st from public.bookings where id = paid;
  if st <> 'CONFIRMED' then raise exception 'PROBE_FAIL esc-14: a paid stay was cancelled'; end if;
  select status::text into st from public.bookings where id = paying;
  if st <> 'CONFIRMED' then raise exception 'PROBE_FAIL esc-14: a payment in flight was not waited for'; end if;
  select status::text into st from public.bookings where id = waiting;
  if st <> 'CONFIRMED' then raise exception 'PROBE_FAIL esc-14: an agreement awaiting the parties for 2h was cancelled'; end if;
  select status::text into st from public.bookings where id = waiting_old;
  if st <> 'CANCELLED' then raise exception 'PROBE_FAIL esc-14: an agreement awaiting the parties for 73h kept the nights (%)', st; end if;
  select status::text into st from public.bookings where id = stalled;
  if st <> 'CANCELLED' then raise exception 'PROBE_FAIL esc-14: checkouts kept an unpaid stay past the cap (%)', st; end if;
  if not (r -> 'accepted_unpaid') @> to_jsonb(array[stale, legacy, today, stalled, waiting_old]) then
    raise exception 'PROBE_FAIL esc-14: result %', r;
  end if;
  if not (r -> 'agreement_pending') @> to_jsonb(array[waiting]) then
    raise exception 'PROBE_FAIL esc-14: the waiting agreement is not reported as pending (%)', r;
  end if;
  raise exception 'PROBE_OK esc-14';
end $$;
