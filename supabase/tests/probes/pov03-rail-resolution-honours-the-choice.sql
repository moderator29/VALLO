-- POV03 (pending migrations pov01 to pov03): the rail for every case, with
-- and without the payer's choice.
--   rent (a rent charge on a rental)   escrow by default, card when chosen
--   shortlet at a nightly rate         escrow by default (ruling 4), card when chosen
--   sale                               escrow, even with card stored
--   hotel room                         direct (card), whatever is stored
--   guest house room                   direct (card): hotel, guest_house,
--                                      resort and serviced_apartments
--   shortlet operator's room           escrow by default, card when chosen
--   restaurant                         card only
-- and the gate follows: an escrow agreement needs no review, a card one is
-- reviewed when a signal fires (agreement_review_required reads the rail).
-- Live fixtures: the rental, shortlet, sale and restaurant listings are is_demo and bookings refuse
-- a demo listing, so the probe clears is_demo on its listings first, and
-- files a mandate where the listing needs one, as b2-rail-at-open does.
-- Everything is rolled back by the final raise.
do $$
declare
  guest constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  host  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  v_rental uuid; v_short uuid; v_sale uuid; v_sale_owner uuid; v_rest uuid; v_rest_owner uuid;
  lister constant uuid := gen_random_uuid();   -- the lister, filed below
  lister_agent uuid;
  b_rent uuid := gen_random_uuid();
  b_short uuid := gen_random_uuid();
  b_room uuid;
  a_rent uuid := gen_random_uuid();
  a_short uuid := gen_random_uuid();
  a_room uuid := gen_random_uuid();
  a_sale uuid; a_rest uuid; insp uuid;
  biz uuid; acc uuid; rt uuid; rp uuid; pol uuid; dd date;
  k text; b_k uuid; a_k uuid; biz_k uuid; acc_k uuid; rt_k uuid; rp_k uuid;
  start_day date := (now() at time zone 'Africa/Lagos')::date + 30;
  r record;
  opts text[];
  rv jsonb;
begin
  -- 16 November 2026: the example collection is gone from the live database (the
  -- Vallo Examples user e0000000-...-0001, its listings, hotels and threads; the
  -- agent row e0000000-...-0002 now belongs to a real account), and the founder
  -- does not want it back. This probe used to borrow it. It now files its own
  -- host for this transaction: a fresh auth user (the signup trigger makes the
  -- profile), an approved business agent, and fresh listings with the same facts
  -- as the example rows it borrowed: a yearly rental in Yaba (v_rental), a
  -- nightly shortlet in Lekki (v_short), the Lekki house for sale (v_sale) and
  -- the restaurant in Jabi (v_rest), all listed by the one fresh lister. All of
  -- it is rolled back with the probe. Nothing asserted below changes.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (lister, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-pov03-rail-resolution-honours-the-choice-host-' || lister || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (lister, 'Probe pov03-rail-resolution-honours-the-choice host', 'business', 'APPROVED')
  returning id into lister_agent;
  v_rental := gen_random_uuid(); v_short := gen_random_uuid(); v_sale := gen_random_uuid(); v_rest := gen_random_uuid();
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rent_amount_minor, rent_period, caution_deposit_minor, service_charge_minor, service_charge_period, agency_fee_minor, legal_fee_minor, agreement_fee_minor, total_move_in_cost_minor, minimum_tenancy_months, listing_role)
  values (v_rental, lister_agent, 'DRAFT', 'Probe Mini flat in Yaba', 'One room, its own kitchen and bathroom, on the first floor of a small block off Commercial Avenue.', 'rental', 'LA', 'Lagos', 'Yaba', 6.5095, 3.3711, 1, 1, 1, 'unfurnished', 'rent', 120000000, 'year', 24000000, 6000000, 'year', 12000000, 12000000, 6000000, 180000000, 12, 'agent');
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (v_short, lister_agent, 'DRAFT', 'Probe One bedroom serviced flat, Lekki Phase 1', 'Fully furnished with an inverter that carries the flat through the night. Let by the night.', 'shortlet', 'LA', 'Lagos', 'Lekki Phase 1', 6.4472, 3.4738, 1, 1, 1, 'fully_furnished', 'rent', 8500000, 'night', 'agent');
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, sale_price_minor, tenure, sale_status, listing_role)
  values (v_sale, lister_agent, 'DRAFT', 'Probe Four bedroom detached house, Lekki Phase 1', 'Detached on its own plot with a boys quarters and parking for three. Certificate of Occupancy in the seller name.', 'home', 'LA', 'Lagos', 'Lekki Phase 1', 6.4415, 3.4761, 4, 4, 5, 'unfurnished', 'sale', 25000000000, 'certificate_of_occupancy', 'available', 'agent');
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (v_rest, lister_agent, 'DRAFT', 'Probe Restaurant in Jabi', 'A working restaurant with a fitted kitchen and covered outdoor seating. Priced per head.', 'restaurant', 'FC', 'Abuja', 'Jabi', 9.0714, 7.4318, 0, 2, 4, 'fully_furnished', 'rent', 1800000, 'guest', 'agent');
  v_sale_owner := lister; v_rest_owner := lister;
  if v_rental is null or v_short is null or v_sale is null then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: fixtures missing (a rental, a nightly shortlet, a sale)';
  end if;

  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, case when listing_intent = 'sale' then 'sale' else 'letting' end, 'Probe Principal', 'approved', host, now(),
         'owner', 'call_back', host, now()
    from public.listings where id in (v_rental, v_short, v_sale, v_rest) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  -- Live, as the example listings it replaces were (16 November 2026).
  update public.listings set is_demo = false, status = 'PUBLISHED' where id in (v_rental, v_short, v_sale, v_rest);

  -- RENT: the booking a rent charge opens.
  perform set_config('vallo.rent_charge', 'true', true);
  insert into public.bookings (id, listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor)
  values (b_rent, v_rental, guest, start_day + 100, start_day + 101, 1, 200000, 200000, 200000);
  perform set_config('vallo.rent_charge', '', true);
  -- SHORTLET at a nightly rate.
  insert into public.bookings (id, listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor)
  values (b_short, v_short, guest, start_day + 110, start_day + 111, 1, 200000, 200000, 200000);
  insert into public.deal_agreements (id, kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms, status, decided_by, decided_at)
  values (a_rent, 'stay', v_rental, b_rent, guest, host, 200000, '{}'::jsonb, 'approved', host, now()),
         (a_short, 'stay', v_short, b_short, guest, host, 200000, '{}'::jsonb, 'approved', host, now());

  -- 1. Rent: escrow by default, card when chosen, escrow again.
  r := private.rail_for_booking(b_rent);
  if r.rail is distinct from 'escrow' or private.rail_for_agreement(a_rent) is distinct from 'escrow' then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: rent without a choice is not escrow (%)', r.rail;
  end if;
  if private.rail_options_for_agreement(a_rent) <> array['escrow', 'card'] then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: rent does not offer escrow and card';
  end if;
  update public.deal_agreements set payer_rail_choice = 'card', payer_rail_chosen_at = now() where id = a_rent;
  r := private.rail_for_booking(b_rent);
  if r.rail is distinct from 'direct' or r.policy_id is null or private.rail_for_agreement(a_rent) is distinct from 'direct' then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: rent with card chosen is not direct (%)', r.rail;
  end if;
  update public.deal_agreements set payer_rail_choice = 'escrow', payer_rail_chosen_at = now() where id = a_rent;
  if (private.rail_for_booking(b_rent)).rail is distinct from 'escrow' then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: rent with escrow chosen is not escrow';
  end if;

  -- 2. Shortlet at a nightly rate (ruling 4): no longer the hotel row.
  r := private.rail_for_booking(b_short);
  if r.rail is distinct from 'escrow' then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: a nightly shortlet is not escrow by default (%)', r.rail;
  end if;
  rv := private.agreement_review_required(a_short);
  if (rv ->> 'required')::boolean or rv ->> 'rail' is distinct from 'escrow' then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: escrow asked for a review: %', rv;
  end if;
  update public.deal_agreements set payer_rail_choice = 'card', payer_rail_chosen_at = now() where id = a_short;
  if (private.rail_for_booking(b_short)).rail is distinct from 'direct' then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: a nightly shortlet with card chosen is not direct';
  end if;
  rv := private.agreement_review_required(a_short);
  if rv ->> 'rail' is distinct from 'direct' then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: the gate did not read the card choice: %', rv;
  end if;

  -- 3. Sale: escrow only, even with card stored.
  insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at)
  values (v_sale, guest, v_sale_owner, now()) returning id into insp;
  insert into public.deal_agreements (kind, listing_id, inspection_id, renter_id, owner_id, amount_minor, terms,
                                      payer_rail_choice, payer_rail_chosen_at)
  values ('rent', v_sale, insp, guest, v_sale_owner, 900000000, '{"total_minor": 900000000}', 'card', now())
  returning id into a_sale;
  if private.rail_for_agreement(a_sale) is distinct from 'escrow' then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: a sale with card stored is not escrow';
  end if;
  if private.rail_options_for_agreement(a_sale) <> array['escrow'] then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: a sale offers more than escrow';
  end if;

  -- 4. Hotel room: card only, whatever is stored.
  update public.feature_flags set enabled = true where key = 'room_bookings';
  update public.feature_flags set enabled = false where key = 'stays_instant_pay';
  insert into public.businesses (owner_id, kind, name, slug, status, source)
  values (host, 'hotel', 'Probe POV03 Hotel', 'probe-pov03-' || gen_random_uuid(), 'PUBLISHED', 'first_party') returning id into biz;
  insert into public.accommodations (business_id, name, slug, status)
  values (biz, 'Probe POV03 Hotel', 'probe-pov03-a-' || gen_random_uuid(), 'PUBLISHED') returning id into acc;
  insert into public.room_types (accommodation_id, name, category, sleeps, units_total, base_rate_minor, status)
  values (acc, 'Probe double', 'double', 2, 4, 5000000, 'PUBLISHED') returning id into rt;
  select id into pol from public.cancellation_policies limit 1;
  insert into public.rate_plans (room_type_id, name, cancellation_policy_id, rate_minor, currency, min_stay_nights, active)
  values (rt, 'Probe room only', pol, 5000000, 'NGN', 1, true) returning id into rp;
  for dd in select generate_series(start_day, start_day + 2, interval '1 day')::date loop
    insert into public.room_inventory (room_type_id, date, units_open) values (rt, dd, 4);
  end loop;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated')::text, true);
  insert into public.bookings (guest_id, accommodation_id, room_type_id, rate_plan_id, rooms, check_in, check_out, adults)
  values (guest, acc, rt, rp, 1, start_day, start_day + 1, 2) returning id into b_room;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.deal_agreements (id, kind, accommodation_id, booking_id, renter_id, owner_id, amount_minor, terms, status,
                                      decided_by, decided_at, payer_rail_choice, payer_rail_chosen_at)
  select a_room, 'stay', acc, b_room, guest, host, b.total_minor, '{}'::jsonb, 'approved', host, now(), 'escrow', now()
    from public.bookings b where b.id = b_room;
  if (private.rail_for_booking(b_room)).rail is distinct from 'direct' or private.rail_for_agreement(a_room) is distinct from 'direct' then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: a hotel room with escrow stored is not card';
  end if;
  if private.rail_options_for_agreement(a_room) <> array['card'] then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: a hotel room offers more than card';
  end if;
  -- The fixture hold is let go so the next rooms stay under the guest's hold limit.
  update public.bookings set status = 'CANCELLED' where id = b_room;

  -- 4b. A room at each other business kind: the four hotel kinds are card
  --     only; a shortlet operator's room is escrow with the card choice.
  foreach k in array array['guest_house', 'resort', 'serviced_apartments', 'shortlet_operator'] loop
    insert into public.businesses (owner_id, kind, name, slug, status, source)
    values (host, k::public.business_kind, 'Probe POV03 ' || k, 'probe-pov03-' || replace(k, '_', '-') || '-' || gen_random_uuid(), 'PUBLISHED', 'first_party')
    returning id into biz_k;
    insert into public.accommodations (business_id, name, slug, status)
    values (biz_k, 'Probe POV03 ' || k, 'probe-pov03-a-' || replace(k, '_', '-') || '-' || gen_random_uuid(), 'PUBLISHED') returning id into acc_k;
    insert into public.room_types (accommodation_id, name, category, sleeps, units_total, base_rate_minor, status)
    values (acc_k, 'Probe double', 'double', 2, 4, 5000000, 'PUBLISHED') returning id into rt_k;
    insert into public.rate_plans (room_type_id, name, cancellation_policy_id, rate_minor, currency, min_stay_nights, active)
    values (rt_k, 'Probe room only', pol, 5000000, 'NGN', 1, true) returning id into rp_k;
    for dd in select generate_series(start_day, start_day + 2, interval '1 day')::date loop
      insert into public.room_inventory (room_type_id, date, units_open) values (rt_k, dd, 4);
    end loop;
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated')::text, true);
    insert into public.bookings (guest_id, accommodation_id, room_type_id, rate_plan_id, rooms, check_in, check_out, adults)
    values (guest, acc_k, rt_k, rp_k, 1, start_day, start_day + 1, 2) returning id into b_k;
    reset role;
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    a_k := gen_random_uuid();
    insert into public.deal_agreements (id, kind, accommodation_id, booking_id, renter_id, owner_id, amount_minor, terms, status,
                                        decided_by, decided_at)
    select a_k, 'stay', acc_k, b_k, guest, host, b.total_minor, '{}'::jsonb, 'approved', host, now()
      from public.bookings b where b.id = b_k;
    if k = 'shortlet_operator' then
      if (private.rail_for_booking(b_k)).rail is distinct from 'escrow'
         or private.rail_options_for_agreement(a_k) <> array['escrow', 'card'] then
        raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: a shortlet operator''s room is not escrow with the choice';
      end if;
      update public.deal_agreements set payer_rail_choice = 'card', payer_rail_chosen_at = now() where id = a_k;
      if (private.rail_for_booking(b_k)).rail is distinct from 'direct' then
        raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: a shortlet operator''s room with card chosen is not card';
      end if;
    else
      update public.deal_agreements set payer_rail_choice = 'escrow', payer_rail_chosen_at = now() where id = a_k;
      if (private.rail_for_booking(b_k)).rail is distinct from 'direct'
         or private.rail_options_for_agreement(a_k) <> array['card'] then
        raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: a % room is not card only', k;
      end if;
    end if;
    update public.bookings set status = 'CANCELLED' where id = b_k;
  end loop;

  -- 4c. An instant stay at the published price, approved by the system, that
  --     the payer moved to card is payable at once: only the fraud radar
  --     (or the incident switch) still asks a person.
  update public.deal_agreements
     set decided_by = null, payer_rail_choice = 'card', payer_rail_chosen_at = now(),
         terms = jsonb_build_object('instant_booking', true, 'priced_by', 'database')
   where id = a_short;
  rv := private.agreement_review_required(a_short);
  if (rv ->> 'required')::boolean or rv ->> 'rail' is distinct from 'direct'
     or exists (select 1 from jsonb_array_elements_text(rv -> 'reasons') x where x <> 'fraud_radar') then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: an instant stay on card was not payable at once: %', rv;
  end if;

  -- 5. Restaurant: card only.
  if v_rest is not null then
    begin
      insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at)
      values (v_rest, guest, v_rest_owner, now()) returning id into insp;
      insert into public.deal_agreements (kind, listing_id, inspection_id, renter_id, owner_id, amount_minor, terms)
      values ('rent', v_rest, insp, guest, v_rest_owner, 500000, '{}') returning id into a_rest;
    exception when others then
      raise notice 'PROBE_SKIP pov03 5: the restaurant fixture was refused: %', sqlerrm;
    end;
  end if;
  if a_rest is not null then
    opts := private.rail_options_for_agreement(a_rest);
    if opts <> array['card'] then
      raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: a restaurant offers %', opts;
    end if;
  else
    raise notice 'PROBE_SKIP pov03 5: no restaurant listing; resolve_payment_rail is checked in pov02';
  end if;

  -- 6. No member can call the helpers.
  if has_function_privilege('authenticated', 'private.rail_base_for_booking(uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.rail_options_for_agreement(uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.rail_base_for_accommodation(uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.agreement_review_required(uuid)', 'execute')
     or has_function_privilege('anon', 'private.rail_for_agreement(uuid)', 'execute') then
    raise exception 'PROBE_FAIL pov03-rail-resolution-honours-the-choice: a member can call a rail helper';
  end if;

  raise exception 'PROBE_OK pov03-rail-resolution-honours-the-choice';
end
$$;
