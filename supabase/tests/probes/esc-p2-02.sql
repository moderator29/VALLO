-- ESC-P2-02: a paid move-in charge (a one-night booking with a rent_payments
-- row) is not completed by the completion sweep and is not announced as a
-- finished stay. Control: a paid one-night stay in the same state is
-- completed. Rolls back.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  lister constant uuid := gen_random_uuid();   -- host, filed below
  lister_agent uuid;
  stay constant uuid := gen_random_uuid();
  home constant uuid := gen_random_uuid();
  lagos date := (now() at time zone 'Africa/Lagos')::date;
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';   -- approves the agreements
  tenancy uuid; night uuid; insp uuid; r jsonb; st text; n int;
  rent_ag uuid; stay_ag uuid; ag uuid;
begin
  -- 16 November 2026: the example collection is gone from the live database (the
  -- Vallo Examples user e0000000-...-0001, its listings, hotels and threads; the
  -- agent row e0000000-...-0002 now belongs to a real account), and the founder
  -- does not want it back. This probe used to borrow it. It now files its own
  -- host for this transaction: a fresh auth user (the signup trigger makes the
  -- profile), an approved business agent, and fresh listings with the same facts
  -- as the example rows it borrowed: a nightly shortlet in Lekki (stay) and the
  -- Lekki house for sale that the fixture turns into a one-kobo rental (home).
  -- All of it is rolled back with the probe. Nothing asserted below changes.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (lister, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-esc-p2-02-host-' || lister || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (lister, 'Probe esc-p2-02 host', 'business', 'APPROVED')
  returning id into lister_agent;
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (stay, lister_agent, 'DRAFT', 'Probe One bedroom serviced flat, Lekki Phase 1', 'Fully furnished with an inverter that carries the flat through the night. Let by the night.', 'shortlet', 'LA', 'Lagos', 'Lekki Phase 1', 6.4472, 3.4738, 1, 1, 1, 'fully_furnished', 'rent', 8500000, 'night', 'agent');
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
    from public.listings where id in (stay, home) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set is_demo = false, status = 'PUBLISHED' where id in (stay, home);
  -- 29 September 2026: a charge now opens only on an approved deal agreement
  -- (transactions_00_payment_gate and rent_payments_00_needs_approved_agreement,
  -- Track A), so the fixture takes the platform's path instead of writing
  -- SUCCESSFUL transactions and a bare rent_payments row. The tenancy: a
  -- one-kobo rental, the lister's yes to the inspection, a submitted report,
  -- agreement_open_rent_as, both parties' agreement_confirm_as, the QA
  -- admin's admin_decide_agreement, open_rent_charge. The stay: the host
  -- accepts a PENDING booking (bookings_open_stay_agreement draws up the
  -- agreement), both confirm, the admin approves. Each is then paid by a
  -- PENDING split charge settled through settle_booking_charge (no Paystack
  -- call), and both are moved back to three days ago with the stay pricing
  -- trigger set aside. Every assertion below is unchanged.
  -- 7 October 2026 (b2 rail at open): a Paystack charge must resolve to the
  -- direct rail, and a home is escrow. The tenancy is let as a registered
  -- business's apartment, which the rail policy settles direct, so its
  -- move-in charge can still be paid through settle_booking_charge.
  update public.listings set listing_intent = 'rent', sale_status = null, rent_period = 'year',
         rent_amount_minor = 1, total_move_in_cost_minor = 1, property_type = 'apartment'
   where id = home;
  insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at)
  values (home, member, lister, now()) returning id into insp;
  update public.inspection_requests set state = 'CONFIRMED', slot_at = now() - interval '1 hour' where id = insp;
  insert into public.inspection_reports (inspection_id, author_id) values (insp, member);
  insert into public.inspection_report_items (inspection_id, item, checked, checked_at)
  select insp, i, true, now()
    from unnest(array['exterior', 'interior', 'kitchen', 'bathrooms', 'utilities', 'appliances', 'safety', 'overall']) i;
  insert into public.inspection_report_photos (inspection_id, item, storage_path)
  select insp, 'overall', 'probe/esc-p2-02/' || g || '.jpg'
    from generate_series(1, greatest(1, (select m.min_inspection_photos from public.money_policy m))) g;
  update public.inspection_reports set submitted_at = now() where inspection_id = insp;
  r := public.agreement_open_rent_as(member, insp, lagos, null, null);
  if r ->> 'status' is distinct from 'ok' then raise exception 'PROBE_FAIL esc-p2-02: fixture rent agreement not opened: %', r; end if;
  rent_ag := (r ->> 'agreement_id')::uuid;

  alter table public.bookings disable trigger bookings_priced_by_the_listing;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos, lagos + 1, 1, 1, 1, 1, 'PENDING') returning id into night;
  update public.bookings set status = 'CONFIRMED' where id = night;
  alter table public.bookings enable trigger bookings_priced_by_the_listing;
  select id into stay_ag from public.deal_agreements where booking_id = night;
  if stay_ag is null then raise exception 'PROBE_FAIL esc-p2-02: fixture stay agreement not drawn up on acceptance'; end if;

  -- D68d: with no risk signal an agreement is approved by the system the
  -- moment both parties confirm. This fixture walks the review path, so it
  -- turns on the documented kill switch (agreement_review_all) for this
  -- transaction only, which sends every agreement to review.
  insert into public.feature_flags (key, enabled) values ('agreement_review_all', true)
  on conflict (key) do update set enabled = true;
  foreach ag in array array[rent_ag, stay_ag] loop
    r := public.agreement_confirm_as(member, ag, 1);
    r := public.agreement_confirm_as(lister, ag, 1);
    if r ->> 'agreement_status' is distinct from 'in_review' then raise exception 'PROBE_FAIL esc-p2-02: fixture agreement not submitted: %', r; end if;
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
    r := public.admin_decide_agreement(ag, 'approve', null);
    reset role;
    if r ->> 'agreement_status' is distinct from 'approved' then raise exception 'PROBE_FAIL esc-p2-02: fixture agreement not approved: %', r; end if;
  end loop;

  r := public.open_rent_charge(member, insp, lagos);
  if r ->> 'status' is distinct from 'ok' then raise exception 'PROBE_FAIL esc-p2-02: fixture move-in charge not opened: %', r; end if;
  tenancy := (r ->> 'booking_id')::uuid;

  -- 17 October 2026 (D73 as refined on 13 October, DECISIONS_2026-10-13.md
  -- row 21; pov02 and pov03): a registered business's apartment and a nightly
  -- shortlet are no longer settled direct by the policy; each is escrow unless
  -- the payer picks card, and a Paystack charge carries only the direct rail.
  -- The payer picks card on both agreements, as the pay page records it, so
  -- both are the direct-rail card charges this probe was written against.
  update public.deal_agreements set payer_rail_choice = 'card', payer_rail_chosen_at = now()
   where id in (rent_ag, stay_ag);

  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, status, agreement_id, payee_user_id,
         payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
  values (tenancy, 'paystack', 'probe-escp202-tenancy', 1, 'PENDING', rent_ag, lister, 'ACCT_probe', 'ACCT_probe_reserve', 1, 0, 0),
         (night, 'paystack', 'probe-escp202-night', 1, 'PENDING', stay_ag, lister, 'ACCT_probe', 'ACCT_probe_reserve', 1, 0, 0);
  r := public.settle_booking_charge('probe-escp202-tenancy', 1);
  if r ->> 'outcome' is distinct from 'settled' then raise exception 'PROBE_FAIL esc-p2-02: fixture move-in not settled: %', r; end if;
  r := public.settle_booking_charge('probe-escp202-night', 1);
  if r ->> 'outcome' is distinct from 'settled' then raise exception 'PROBE_FAIL esc-p2-02: fixture stay not settled: %', r; end if;

  -- Both moved into the past, set aside from the stay pricing trigger.
  alter table public.bookings disable trigger bookings_priced_by_the_listing;
  update public.bookings set check_in = lagos - 3, check_out = lagos - 2 where id in (tenancy, night);
  alter table public.bookings enable trigger bookings_priced_by_the_listing;

  -- The announcement first, while the tenancy is the only CONFIRMED booking
  -- that has ended: it must yield no post.
  delete from public.posts where author_kind = 'SYSTEM' and payload ->> 'reason' = 'stay_completed'
     and created_at > now() - interval '7 days';
  update public.bookings set status = 'CANCELLED' where id = night;
  n := private.announce_completed_stays();
  if n <> 0 then raise exception 'PROBE_FAIL esc-p2-02: a move-in was announced as a finished stay (% posts)', n; end if;
  -- Control: the same stay, confirmed, is announced.
  update public.bookings set status = 'CONFIRMED' where id = night;
  n := private.announce_completed_stays();
  if n <> 1 then raise exception 'PROBE_FAIL esc-p2-02: control stay was not announced (% posts)', n; end if;

  r := private.complete_ended_stays(500);
  select status::text into st from public.bookings where id = tenancy;
  if st <> 'CONFIRMED' then raise exception 'PROBE_FAIL esc-p2-02: a tenancy was completed the day after move-in (%)', st; end if;
  select status::text into st from public.bookings where id = night;
  if st <> 'COMPLETED' then raise exception 'PROBE_FAIL esc-p2-02: control stay is %', st; end if;

  raise exception 'PROBE_OK esc-p2-02';
end $$;
