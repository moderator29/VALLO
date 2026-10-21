-- ESC-04: a host records a no show only from 12:00 WAT the day after check-in,
-- never on a booking that carries a rent charge, and a no show's nights stay
-- booked and cannot be sold again until its check-out. Controls: a no show
-- after the grace is recorded; a confirmed stay on another listing is
-- unaffected. Rolls back.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';   -- guest
  lister constant uuid := 'e0000000-0000-4000-8000-000000000001';   -- host
  stay constant uuid := 'ed000000-0000-4000-8000-000000000003';
  stay2 constant uuid := 'ed000000-0000-4000-8000-000000000018';
  home constant uuid := 'ed000000-0000-4000-8000-000000000004';
  lagos date := (now() at time zone 'Africa/Lagos')::date;
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';    -- approves the agreement
  today_bk uuid; past_bk uuid; rent_bk uuid; insp uuid; ag uuid;
  r jsonb; n int;
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
                'ed000000-0000-4000-8000-000000000004',
                'ed000000-0000-4000-8000-000000000018')
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
