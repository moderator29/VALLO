-- NEW-A1-03: a stay the nightly job has recorded as COMPLETED is still a stay
-- that happened. Its guest can review it, it counts as one of the agent's
-- completed deals, and it earns the stay badges. A tenancy (a booking with a
-- rent_payments row) is not a stay: it is never reviewed as one and never
-- earns a stay badge. Controls: a CONFIRMED stay with a past check-out is
-- still reviewable and counted; a stay not finished, a cancelled one and a
-- no-show are refused. Both hold without the reviewer's own read of
-- rent_payments. Rolls back.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';   -- guest
  admin  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';   -- a tenant, here
  lister constant uuid := 'e0000000-0000-4000-8000-000000000001';
  stay   constant uuid := 'ed000000-0000-4000-8000-000000000003';
  stay2  constant uuid := 'ed000000-0000-4000-8000-000000000018';
  home   constant uuid := 'ed000000-0000-4000-8000-000000000004';
  lagos date := (now() at time zone 'Africa/Lagos')::date;
  done_bk uuid; open_bk uuid; ahead_bk uuid; gone_bk uuid; noshow_bk uuid; rent_bk uuid; insp uuid;
  deals_before int; deals_after int; n int; i int; refused text;
  ag uuid; r jsonb;
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
  update public.agents set is_demo = false where user_id = lister;
  delete from public.user_badges where user_id in (member, admin, lister) and badge_code in ('first_stay', 'ten_stays');
  select completed_deals into deals_before from public.agent_trust(lister);

  -- Past stays are written with the pricing trigger set aside, as the sweep
  -- would find them.
  alter table public.bookings disable trigger bookings_priced_by_the_listing;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos - 40, lagos - 38, 2, 1, 2, 2, 'CONFIRMED') returning id into done_bk;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos - 36, lagos - 34, 2, 1, 2, 2, 'CONFIRMED') returning id into open_bk;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay2, member, lagos, lagos + 2, 2, 1, 2, 2, 'CONFIRMED') returning id into ahead_bk;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos - 32, lagos - 30, 2, 1, 2, 2, 'CANCELLED') returning id into gone_bk;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, lagos - 28, lagos - 26, 2, 1, 2, 2, 'NO_SHOW') returning id into noshow_bk;
  -- Nine more finished stays at the lister's listing, for ten_stays.
  for i in 1..9 loop
    insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
    values (stay2, member, lagos - 100 + i * 3, lagos - 99 + i * 3, 1, 1, 1, 1, 'CONFIRMED');
  end loop;
  alter table public.bookings enable trigger bookings_priced_by_the_listing;

  -- The tenancy. 29 September 2026: a move-in charge now opens only on an
  -- approved deal agreement (rent_payments_00_needs_approved_agreement,
  -- Track A), so the fixture takes the platform's path instead of writing a
  -- bare rent_payments row: a one-kobo rental, the lister's yes to the
  -- inspection, a submitted report, agreement_open_rent_as, both parties'
  -- agreement_confirm_as, admin_decide_agreement, open_rent_charge; the
  -- charge is then moved back 24 days and confirmed as before. The tenant here
  -- is the QA admin, and nobody decides an agreement they are a party to, so
  -- the QA member holds the 'agreements' staff scope (with the handbook
  -- acknowledged) only for that decision and it is revoked straight after.
  -- Every assertion below is unchanged.
  update public.listings set listing_intent = 'rent', sale_status = null, rent_period = 'year',
         rent_amount_minor = 1, total_move_in_cost_minor = 1
   where id = home;
  insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at)
  values (home, admin, lister, now()) returning id into insp;
  update public.inspection_requests set state = 'CONFIRMED', slot_at = now() - interval '1 hour' where id = insp;
  insert into public.inspection_reports (inspection_id, author_id) values (insp, admin);
  insert into public.inspection_report_items (inspection_id, item, checked, checked_at)
  select insp, it, true, now()
    from unnest(array['exterior', 'interior', 'kitchen', 'bathrooms', 'utilities', 'appliances', 'safety', 'overall']) it;
  insert into public.inspection_report_photos (inspection_id, item, storage_path)
  select insp, 'overall', 'probe/new-a1-03/' || g || '.jpg'
    from generate_series(1, greatest(1, (select m.min_inspection_photos from public.money_policy m))) g;
  update public.inspection_reports set submitted_at = now() where inspection_id = insp;
  r := public.agreement_open_rent_as(admin, insp, lagos, null, null);
  if r ->> 'status' is distinct from 'ok' then raise exception 'PROBE_FAIL new-a1-03: fixture agreement not opened: %', r; end if;
  ag := (r ->> 'agreement_id')::uuid;
  -- D68d: with no risk signal an agreement is approved by the system the
  -- moment both parties confirm. This fixture walks the review path, so it
  -- turns on the documented kill switch (agreement_review_all) for this
  -- transaction only, which sends every agreement to review.
  insert into public.feature_flags (key, enabled) values ('agreement_review_all', true)
  on conflict (key) do update set enabled = true;
  r := public.agreement_confirm_as(admin, ag, 1);
  r := public.agreement_confirm_as(lister, ag, 1);
  if r ->> 'agreement_status' is distinct from 'in_review' then raise exception 'PROBE_FAIL new-a1-03: fixture agreement not submitted: %', r; end if;
  insert into public.staff_grants (user_id, scopes, note, granted_by)
  values (member, array['agreements']::public.staff_scope[], 'probe new-a1-03', admin)
  on conflict (user_id) do update set scopes = excluded.scopes, revoked_at = null, revoked_by = null, revoke_reason = null;
  insert into public.staff_handbook_acks (user_id, version)
  select member, private.staff_handbook_version()
   where not exists (select 1 from public.staff_handbook_acks a
                      where a.user_id = member and a.version = private.staff_handbook_version());
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  r := public.admin_decide_agreement(ag, 'approve', null);
  reset role;
  if r ->> 'agreement_status' is distinct from 'approved' then raise exception 'PROBE_FAIL new-a1-03: fixture agreement not approved: %', r; end if;
  update public.staff_grants set revoked_at = now(), revoked_by = admin, revoke_reason = 'probe new-a1-03' where user_id = member;
  r := public.open_rent_charge(admin, insp, lagos);
  if r ->> 'status' is distinct from 'ok' then raise exception 'PROBE_FAIL new-a1-03: fixture move-in charge not opened: %', r; end if;
  rent_bk := (r ->> 'booking_id')::uuid;
  alter table public.bookings disable trigger bookings_priced_by_the_listing;
  update public.bookings set check_in = lagos - 24, check_out = lagos - 23, status = 'CONFIRMED' where id = rent_bk;
  alter table public.bookings enable trigger bookings_priced_by_the_listing;

  -- What the nightly job does the morning after check-out.
  update public.bookings set status = 'COMPLETED'
   where guest_id = member and status = 'CONFIRMED' and check_out < lagos and id <> open_bk;

  -- Trust: every finished stay is a completed deal, COMPLETED or not.
  select completed_deals into deals_after from public.agent_trust(lister);
  if deals_after - deals_before < 11 then
    raise exception 'PROBE_FAIL new-a1-03: agent_trust counted % of 11 finished stays', deals_after - deals_before;
  end if;

  -- Badges: first_stay for the guest and ten_stays for the lister, from
  -- COMPLETED stays; nothing from a tenancy.
  perform private.sweep_badges();
  if not exists (select 1 from public.user_badges where user_id = member and badge_code = 'first_stay') then
    raise exception 'PROBE_FAIL new-a1-03: a completed stay earned no first_stay badge';
  end if;
  if not exists (select 1 from public.user_badges where user_id = lister and badge_code = 'ten_stays') then
    raise exception 'PROBE_FAIL new-a1-03: ten completed stays earned no ten_stays badge';
  end if;
  if exists (select 1 from public.user_badges where user_id = admin and badge_code = 'first_stay') then
    raise exception 'PROBE_FAIL new-a1-03: a tenancy earned a first_stay badge';
  end if;

  -- The review rule does not rest on the reviewer's own read of
  -- rent_payments: with that read taken away (no grant, no tenant policy), a
  -- stay is still reviewable and a tenancy still is not.
  if to_regprocedure('private.booking_is_tenancy(uuid)') is null
     or not has_function_privilege('authenticated', 'private.booking_is_tenancy(uuid)', 'EXECUTE') then
    raise exception 'PROBE_FAIL new-a1-03: reviews_insert_own cannot ask whether a booking is a tenancy';
  end if;
  -- D75 (d75b): a review is for a stay that was paid for. Each stay fixture is
  -- paid, recorded as the settlement path records a charge Paystack took, so
  -- every refusal below is refused for the reason it tests (dates, status,
  -- tenancy), not for being unpaid. Recorded after the badge and deal counts.
  perform set_config('vallo.recording_unknown_charge', 'on', true);
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, rail)
  select bk, 'paystack', 'probe-new-a1-03-' || bk::text, 2, 'NGN', 'SUCCESSFUL', 'direct'
    from unnest(array[done_bk, open_bk, ahead_bk, gone_bk, noshow_bk]) as bk;
  perform set_config('vallo.recording_unknown_charge', '', true);

  revoke select on public.rent_payments from authenticated;
  drop policy rent_payments_select_tenant on public.rent_payments;

  -- Reviews, as the guest through the API role.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  insert into public.reviews (listing_id, booking_id, author_id, rating, body)
  values (stay, done_bk, member, 5, null);
  insert into public.reviews (listing_id, booking_id, author_id, rating, body)
  values (stay, open_bk, member, 4, null);
  refused := null;
  begin
    insert into public.reviews (listing_id, booking_id, author_id, rating, body) values (stay2, ahead_bk, member, 5, null);
  exception when insufficient_privilege then refused := 'ahead'; end;
  if refused is null then raise exception 'PROBE_FAIL new-a1-03: a stay not yet finished was reviewed'; end if;
  refused := null;
  begin
    insert into public.reviews (listing_id, booking_id, author_id, rating, body) values (stay, gone_bk, member, 5, null);
  exception when insufficient_privilege then refused := 'cancelled'; end;
  if refused is null then raise exception 'PROBE_FAIL new-a1-03: a cancelled stay was reviewed'; end if;
  refused := null;
  begin
    insert into public.reviews (listing_id, booking_id, author_id, rating, body) values (stay, noshow_bk, member, 5, null);
  exception when insufficient_privilege then refused := 'no_show'; end;
  if refused is null then raise exception 'PROBE_FAIL new-a1-03: a no-show was reviewed'; end if;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  refused := null;
  begin
    insert into public.reviews (listing_id, booking_id, author_id, rating, body) values (home, rent_bk, admin, 5, null);
  exception when insufficient_privilege then refused := 'tenancy'; end;
  if refused is null then raise exception 'PROBE_FAIL new-a1-03: a tenancy was reviewed as a stay'; end if;
  reset role;

  select count(*) into n from public.reviews where booking_id in (done_bk, open_bk);
  if n <> 2 then raise exception 'PROBE_FAIL new-a1-03: % of 2 reviews stored', n; end if;

  raise exception 'PROBE_OK new-a1-03';
end
$$;
