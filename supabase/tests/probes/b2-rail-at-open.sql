-- B2 RAIL AT OPEN (pending migration b2_rail_at_open): a hotel booking
-- resolves to the direct rail and its policy row; a rental booking resolves to
-- escrow, which a Paystack attempt cannot carry; an unknown booking resolves to
-- nothing; a charge Paystack already took for an unknown reference is still
-- recorded (the settlement exemption); the trigger is present and enabled and
-- the helper is not callable by an app role.
--
-- The trigger itself is exercised: transactions_00_payment_gate fires first
-- and needs an approved agreement, so the probe builds one per booking. Then:
-- an escrow booking with rail 'direct' is refused (42501 rail_at_open), a
-- hotel booking with the wrong policy is refused, and a hotel booking with a
-- null rail is stamped direct with the resolving policy.
--
-- Live fixtures: every hotel/rental listing is is_demo, and bookings refuse a
-- demo listing, so the probe clears is_demo on its two listings first. The
-- block always ends in a raise, so everything rolls back.
do $$
declare
  v_guest uuid;
  v_hotel uuid;
  v_rental uuid;
  lister constant uuid := gen_random_uuid();   -- the lister, filed below
  lister_agent uuid;
  b_hotel uuid := gen_random_uuid();
  b_rental uuid := gen_random_uuid();
  r record;
  hotel_policy uuid;
  rental_policy uuid;
  v_owner uuid;
  a_hotel uuid := gen_random_uuid();
  a_rental uuid := gen_random_uuid();
  t_row record;
  refused boolean;
begin
  select id into v_guest from auth.users order by created_at limit 1;
  -- 16 November 2026: the example collection is gone from the live database (the
  -- Vallo Examples user e0000000-...-0001, its listings, hotels and threads; the
  -- agent row e0000000-...-0002 now belongs to a real account), and the founder
  -- does not want it back. This probe used to borrow it. It now files its own
  -- host for this transaction: a fresh auth user (the signup trigger makes the
  -- profile), an approved business agent, and fresh listings with the same facts
  -- as the example rows it borrowed: a guest house room in Port Harcourt listed
  -- as a hotel and let by the night (v_hotel) and a yearly rental in Yaba
  -- (v_rental). All of it is rolled back with the probe. Nothing asserted below
  -- changes.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (lister, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-b2-rail-at-open-host-' || lister || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (lister, 'Probe b2-rail-at-open host', 'business', 'APPROVED')
  returning id into lister_agent;
  v_hotel := gen_random_uuid();
  v_rental := gen_random_uuid();
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (v_hotel, lister_agent, 'DRAFT', 'Probe Guest house room in Old GRA', 'A room in a small guest house, let by the night, with a standby generator.', 'hotel', 'RI', 'Port Harcourt', 'Old GRA', 4.8109, 7.0035, 1, 1, 1, 'fully_furnished', 'rent', 4500000, 'night', 'agent');
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rent_amount_minor, rent_period, caution_deposit_minor, service_charge_minor, service_charge_period, agency_fee_minor, legal_fee_minor, agreement_fee_minor, total_move_in_cost_minor, minimum_tenancy_months, listing_role)
  values (v_rental, lister_agent, 'DRAFT', 'Probe Mini flat in Yaba', 'One room, its own kitchen and bathroom, on the first floor of a small block off Commercial Avenue.', 'rental', 'LA', 'Lagos', 'Yaba', 6.5095, 3.3711, 1, 1, 1, 'unfurnished', 'rent', 120000000, 'year', 24000000, 6000000, 'year', 12000000, 12000000, 6000000, 180000000, 12, 'agent');
  -- Published the way the platform publishes an agent listing: on an
  -- approved mandate (SCUML item 17), then PUBLISHED.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id in (v_hotel, v_rental) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set status = 'PUBLISHED', published_at = now() where id in (v_hotel, v_rental);
  if v_guest is null or v_hotel is null or v_rental is null then
    raise exception 'PROBE_FAIL b2-rail-at-open: fixtures missing (a user, a hotel listing, a rental listing)';
  end if;
  select id into v_owner from auth.users where id <> v_guest order by created_at limit 1;
  if v_owner is null then
    raise exception 'PROBE_FAIL b2-rail-at-open: fixtures missing (a second user for the agreement owner)';
  end if;

  -- SCUML item 17: an agent listing stops being an example only on an
  -- approved mandate, so the fixture files one as the platform would.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id in (v_hotel, v_rental) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);

  -- Rolled back with the block: bookings refuse a demo listing.
  update public.listings set is_demo = false where id in (v_hotel, v_rental);

  insert into public.bookings (id, listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor)
  values (b_hotel, v_hotel, v_guest, current_date + 400, current_date + 401, 1, 10000, 10000, 10000);
  -- A rental listing has no nightly rate, so it carries no stay booking
  -- (ESC-02). Its booking is the one the rent charge opens: the same
  -- vallo.rent_charge marker private.open_rent_charge sets, for this insert
  -- only, so the booking stays on the rental's own (escrow) rail.
  perform set_config('vallo.rent_charge', 'true', true);
  insert into public.bookings (id, listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor)
  values (b_rental, v_rental, v_guest, current_date + 410, current_date + 411, 1, 10000, 10000, 10000);
  perform set_config('vallo.rent_charge', '', true);

  r := private.rail_for_booking(b_hotel);
  if r.rail is distinct from 'direct' or r.policy_id is null then
    raise exception 'PROBE_FAIL b2-rail-at-open: a hotel booking should resolve direct, got %', r.rail;
  end if;
  hotel_policy := r.policy_id;
  if not exists (select 1 from public.payment_rail_policy p where p.id = hotel_policy and p.rail = 'direct') then
    raise exception 'PROBE_FAIL b2-rail-at-open: the resolved policy row is not a direct row';
  end if;

  r := private.rail_for_booking(b_rental);
  if r.rail is distinct from 'escrow' then
    raise exception 'PROBE_FAIL b2-rail-at-open: a rental booking should resolve escrow, got %', r.rail;
  end if;

  rental_policy := r.policy_id;

  r := private.rail_for_booking(gen_random_uuid());
  if r.rail is not null then
    raise exception 'PROBE_FAIL b2-rail-at-open: an unknown booking resolved a rail';
  end if;

  -- Approved agreements, so transactions_00_payment_gate lets the insert
  -- reach transactions_01_rail_at_open. Approved by a person (decided_by an
  -- admin): since D68d a system approval on the direct rail is payable only
  -- while no risk signal fires, and this probe is about the rail, not the
  -- review.
  insert into public.deal_agreements (id, kind, listing_id, booking_id, renter_id, owner_id, amount_minor, terms, status,
         decided_by, decided_at)
  values (a_hotel, 'stay', v_hotel, b_hotel, v_guest, v_owner, 10000, '{}'::jsonb, 'approved',
          '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()),
         (a_rental, 'stay', v_rental, b_rental, v_guest, v_owner, 10000, '{}'::jsonb, 'approved',
          '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now());

  -- 1. An escrow booking claiming the direct rail is refused.
  refused := false;
  begin
    insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, agreement_id,
      payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor, rail, rail_policy_id)
    values (b_rental, 'paystack', 'probe-b2-rail-esc-' || b_rental::text, 10000, 'NGN', 'PENDING', a_rental,
      'ACCT_probe', 'ACCT_probe', 9800, 0, 200, 'direct', rental_policy);
  exception when insufficient_privilege then
    if sqlerrm not like 'rail_at_open%' then
      raise exception 'PROBE_FAIL b2-rail-at-open: escrow refused by the wrong check: %', sqlerrm;
    end if;
    refused := true;
  end;
  if not refused then
    raise exception 'PROBE_FAIL b2-rail-at-open: an escrow booking opened a Paystack attempt';
  end if;

  -- 2. A hotel booking with the wrong policy is refused.
  refused := false;
  begin
    insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, agreement_id,
      payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor, rail, rail_policy_id)
    values (b_hotel, 'paystack', 'probe-b2-rail-pol-' || b_hotel::text, 10000, 'NGN', 'PENDING', a_hotel,
      'ACCT_probe', 'ACCT_probe', 9800, 0, 200, 'direct', rental_policy);
  exception when insufficient_privilege then
    if sqlerrm not like 'rail_at_open%' then
      raise exception 'PROBE_FAIL b2-rail-at-open: wrong policy refused by the wrong check: %', sqlerrm;
    end if;
    refused := true;
  end;
  if not refused then
    raise exception 'PROBE_FAIL b2-rail-at-open: a wrong rail_policy_id was accepted';
  end if;

  -- 3. A hotel booking with no rail is stamped direct with its policy.
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status, agreement_id,
    payee_subaccount_code, reserve_subaccount_code, lister_share_minor, guarantee_minor, commission_minor)
  values (b_hotel, 'paystack', 'probe-b2-rail-null-' || b_hotel::text, 10000, 'NGN', 'PENDING', a_hotel,
    'ACCT_probe', 'ACCT_probe', 9800, 0, 200)
  returning rail, rail_policy_id into t_row;
  if t_row.rail is distinct from 'direct' or t_row.rail_policy_id is distinct from hotel_policy then
    raise exception 'PROBE_FAIL b2-rail-at-open: a null-rail direct attempt was not stamped (%, %)', t_row.rail, t_row.rail_policy_id;
  end if;

  -- Money already taken is recorded, rail or not.
  perform set_config('vallo.recording_unknown_charge', 'on', true);
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status)
  values (b_rental, 'paystack', 'probe-b2-rail-' || b_rental::text, 10000, 'NGN', 'PENDING');
  perform set_config('vallo.recording_unknown_charge', '', true);

  if not exists (select 1 from pg_trigger where tgname = 'transactions_01_rail_at_open' and tgenabled = 'O' and not tgisinternal) then
    raise exception 'PROBE_FAIL b2-rail-at-open: trigger missing or disabled';
  end if;
  if has_function_privilege('authenticated', 'private.rail_for_booking(uuid)', 'execute')
     or has_function_privilege('anon', 'private.rail_for_booking(uuid)', 'execute')
     or has_function_privilege('anon', 'private.transactions_rail_at_open()', 'execute')
     or has_function_privilege('authenticated', 'private.transactions_rail_at_open()', 'execute') then
    raise exception 'PROBE_FAIL b2-rail-at-open: a member can call the helper';
  end if;

  raise exception 'PROBE_OK b2-rail-at-open';
end
$$;
