-- ESC-04: a host records a no show only from 12:00 WAT the day after check-in,
-- never on a booking that carries a rent charge, and a no show's nights stay
-- booked and cannot be sold again until its check-out. Controls: a no show
-- after the grace is recorded; a confirmed stay on another listing is
-- unaffected. Rolls back.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';   -- guest
  lister constant uuid := gen_random_uuid();   -- host, filed below
  lister_agent uuid;
  stay constant uuid := gen_random_uuid();
  stay2 constant uuid := gen_random_uuid();
  home constant uuid := gen_random_uuid();
  lagos date := (now() at time zone 'Africa/Lagos')::date;
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';    -- approves the agreement
  today_bk uuid; past_bk uuid; rent_bk uuid; insp uuid; ag uuid;
  r jsonb; n int;
begin
  -- 16 November 2026: the example collection is gone from the live database (the
  -- Vallo Examples user e0000000-...-0001, its listings, hotels and threads; the
  -- agent row e0000000-...-0002 now belongs to a real account), and the founder
  -- does not want it back. This probe used to borrow it. It now files its own
  -- host for this transaction: a fresh auth user (the signup trigger makes the
  -- profile), an approved business agent, and fresh listings with the same facts
  -- as the example rows it borrowed: a nightly shortlet in Lekki (stay), one in
  -- Wuse 2 (stay2), and the Lekki house for sale that the rent charge turns into
  -- a one-kobo rental (home). All of it is rolled back with the probe. Nothing
  -- asserted below changes.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (lister, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-esc-04-host-' || lister || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (lister, 'Probe esc-04 host', 'business', 'APPROVED')
  returning id into lister_agent;
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (stay, lister_agent, 'DRAFT', 'Probe One bedroom serviced flat, Lekki Phase 1', 'Fully furnished with an inverter that carries the flat through the night. Let by the night.', 'shortlet', 'LA', 'Lagos', 'Lekki Phase 1', 6.4472, 3.4738, 1, 1, 1, 'fully_furnished', 'rent', 8500000, 'night', 'agent');
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (stay2, lister_agent, 'DRAFT', 'Probe One bedroom serviced flat in Wuse 2', 'Furnished and let by the night, with a standby generator for the block.', 'shortlet', 'FC', 'Abuja', 'Wuse 2', 9.0812, 7.4668, 1, 1, 1, 'fully_furnished', 'rent', 7000000, 'night', 'agent');
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, sale_price_minor, tenure, sale_status, listing_role)
  values (home, lister_agent, 'DRAFT', 'Probe Four bedroom detached house, Lekki Phase 1', 'Detached on its own plot with a boys quarters and parking for three. Certificate of Occupancy in the seller name.', 'home', 'LA', 'Lagos', 'Lekki Phase 1', 6.4415, 3.4761, 4, 4, 5, 'unfurnished', 'sale', 25000000000, 'certificate_of_occupancy', 'available', 'agent');
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
    from public.listings where id in (stay, stay2, home) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set is_demo = false, status = 'PUBLISHED' where id in (stay, stay2, home);

  -- Check-in today: too early, even at the door.
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay2, member, lagos, lagos + 2, 2, 1, 2, 2, 'CONFIRMED') returning id into today_bk;
  r := private.record_booking_no_show(today_bk, lister, 'probe');
  if r ->> 'outcome' <> 'too_early' then raise exception 'PROBE_FAIL esc-04: a no show on check-in day was %', r; end if;

  -- Check-in two days ago: recorded, and the nights stay held.
  -- Bookings cannot be made in the past, so these are moved back with the
  -- pricing trigger set aside.
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos + 200, lagos + 205, 5, 1, 5, 5, 'CONFIRMED') returning id into past_bk;
  alter table public.bookings disable trigger bookings_priced_by_the_listing;
  update public.bookings set check_in = lagos - 2, check_out = lagos + 3 where id = past_bk;
  alter table public.bookings enable trigger bookings_priced_by_the_listing;
  insert into public.availability (listing_id, date, status)
  select stay, d::date, 'booked' from generate_series(lagos - 2, lagos + 2, interval '1 day') d
  on conflict do nothing;
  r := private.record_booking_no_show(past_bk, lister, 'probe');
  if r ->> 'outcome' <> 'recorded' then raise exception 'PROBE_FAIL esc-04: a no show after the grace was %', r; end if;
  select count(*) into n from public.availability where listing_id = stay and status = 'booked' and date between lagos and lagos + 2;
  if n <> 3 then raise exception 'PROBE_FAIL esc-04: the no show gave back % of 3 nights ahead', 3 - n; end if;
  begin
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
    values (stay, member, lagos + 1, lagos + 2, 1, 1, 1, 1, 'PENDING');
    raise exception 'PROBE_FAIL esc-04: a no show''s night was sold again';
  exception when exclusion_violation then null; end;

  -- A rent charge is never a host's no show.
  -- 29 September 2026: a move-in charge now opens only on an approved deal
  -- agreement (rent_payments_00_needs_approved_agreement, Track A), so the
  -- fixture takes the platform's path: a one-kobo rental, the lister's yes to
  -- the inspection, a submitted report (eight items, the policy's photos),
  -- agreement_open_rent_as, both parties' agreement_confirm_as, the QA admin's
  -- admin_decide_agreement, then open_rent_charge. The charge is then moved
  -- back and confirmed as before. The assertion is unchanged.
  update public.listings set listing_intent = 'rent', sale_status = null, rent_period = 'year',
         rent_amount_minor = 1, total_move_in_cost_minor = 1
   where id = home;
  insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at)
  values (home, member, lister, now()) returning id into insp;
  update public.inspection_requests set state = 'CONFIRMED', slot_at = now() - interval '1 hour' where id = insp;
  insert into public.inspection_reports (inspection_id, author_id) values (insp, member);
  insert into public.inspection_report_items (inspection_id, item, checked, checked_at)
  select insp, i, true, now()
    from unnest(array['exterior', 'interior', 'kitchen', 'bathrooms', 'utilities', 'appliances', 'safety', 'overall']) i;
  insert into public.inspection_report_photos (inspection_id, item, storage_path)
  select insp, 'overall', 'probe/esc-04/' || g || '.jpg'
    from generate_series(1, greatest(1, (select m.min_inspection_photos from public.money_policy m))) g;
  update public.inspection_reports set submitted_at = now() where inspection_id = insp;
  r := public.agreement_open_rent_as(member, insp, lagos, null, null);
  if r ->> 'status' is distinct from 'ok' then raise exception 'PROBE_FAIL esc-04: fixture agreement not opened: %', r; end if;
  ag := (r ->> 'agreement_id')::uuid;
  -- D68d: with no risk signal an agreement is approved by the system the
  -- moment both parties confirm. This fixture walks the review path, so it
  -- turns on the documented kill switch (agreement_review_all) for this
  -- transaction only, which sends every agreement to review.
  insert into public.feature_flags (key, enabled) values ('agreement_review_all', true)
  on conflict (key) do update set enabled = true;
  r := public.agreement_confirm_as(member, ag, 1);
  r := public.agreement_confirm_as(lister, ag, 1);
  if r ->> 'agreement_status' is distinct from 'in_review' then raise exception 'PROBE_FAIL esc-04: fixture agreement not submitted: %', r; end if;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  r := public.admin_decide_agreement(ag, 'approve', null);
  reset role;
  if r ->> 'agreement_status' is distinct from 'approved' then raise exception 'PROBE_FAIL esc-04: fixture agreement not approved: %', r; end if;
  r := public.open_rent_charge(member, insp, lagos);
  if r ->> 'status' is distinct from 'ok' then raise exception 'PROBE_FAIL esc-04: fixture move-in charge not opened: %', r; end if;
  rent_bk := (r ->> 'booking_id')::uuid;
  -- A move-in charge is written by open_rent_charge, not priced as a stay.
  alter table public.bookings disable trigger bookings_priced_by_the_listing;
  update public.bookings set check_in = lagos - 3, check_out = lagos - 2, status = 'CONFIRMED' where id = rent_bk;
  alter table public.bookings enable trigger bookings_priced_by_the_listing;
  r := private.record_booking_no_show(rent_bk, lister, 'probe');
  if r ->> 'outcome' <> 'rent_charge' then raise exception 'PROBE_FAIL esc-04: a move-in charge was %', r; end if;

  raise exception 'PROBE_OK esc-04';
end $$;
