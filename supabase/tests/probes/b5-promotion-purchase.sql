-- B5 promotion purchase (D60): price frozen at open from the dated row, never
-- the client; activation only by settle; settle idempotent on the reference;
-- amount and currency verified; revenue posted once to ledger_vallo_revenue
-- under 'promotion:<id>'; abandoned is not failed; members cannot open, mark or
-- settle; a member reads only their own purchases. Rolls back.
do $$
declare
  stranger constant uuid := gen_random_uuid();
  owner_id uuid;
  lid uuid;
  lister constant uuid := gen_random_uuid();   -- the lister, filed below
  lister_agent uuid;
  r jsonb; r2 jsonb; rm jsonb;
  ref text; ref2 text; refb text; pid uuid;
  n int; ok boolean; st text;
begin
  -- Prices: proposed, keyed on slug, in kobo.
  if (public.promotion_price_now('boost')).amount_minor is distinct from 250000
     or (public.promotion_price_now('spotlight')).amount_minor is distinct from 750000
     or (public.promotion_price_now('featured')).amount_minor is distinct from 2000000
     or (public.promotion_price_now('prime')).amount_minor is distinct from 5000000
     or (public.promotion_price_now('prime')).price_status is distinct from 'proposed' then
    raise exception 'PROBE_FAIL b5-promotion-purchase: the price rows are not the proposed 2,500 / 7,500 / 20,000 / 50,000 naira';
  end if;

  -- A price row is never rewritten.
  ok := false;
  begin
    update promotion.tier_prices set amount_minor = 1 where tier = 'boost';
  exception when others then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b5-promotion-purchase: a price row was rewritten'; end if;

  -- A real published listing and its lister (everything below rolls back).
  -- 16 November 2026: the example collection is gone from the live database (the
  -- Vallo Examples user e0000000-...-0001, its listings, hotels and threads; the
  -- agent row e0000000-...-0002 now belongs to a real account), and the founder
  -- does not want it back. This probe used to borrow it. It now files its own
  -- host for this transaction: a fresh auth user (the signup trigger makes the
  -- profile), an approved business agent, and fresh listings with the same facts
  -- as the example rows it borrowed: a three bedroom flat to rent in Lekki Phase
  -- 1 (lid). All of it is rolled back with the probe. Nothing asserted below
  -- changes.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (lister, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-b5-promotion-purchase-host-' || lister || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (lister, 'Probe b5-promotion-purchase host', 'business', 'APPROVED')
  returning id into lister_agent;
  lid := gen_random_uuid();
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rent_amount_minor, rent_period, caution_deposit_minor, service_charge_minor, service_charge_period, agency_fee_minor, legal_fee_minor, agreement_fee_minor, total_move_in_cost_minor, minimum_tenancy_months, listing_role)
  values (lid, lister_agent, 'DRAFT', 'Probe Three bedroom flat in Lekki Phase 1', 'Third floor of a six storey block on a quiet crescent. Fitted kitchen, en suite to two rooms, and a shared generator that runs to midnight.', 'apartment', 'LA', 'Lagos', 'Lekki Phase 1', 6.4441, 3.4712, 3, 3, 4, 'semi_furnished', 'rent', 850000000, 'year', 170000000, 45000000, 'year', 85000000, 85000000, 42500000, 1232500000, 12, 'agent');
  -- Published the way the platform publishes an agent listing: on an
  -- approved mandate (SCUML item 17), then PUBLISHED.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id in (lid) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set status = 'PUBLISHED', published_at = now() where id in (lid);
  select l.id, a.user_id into lid, owner_id
    from public.listings l join public.agents a on a.id = l.agent_id
   where l.id = lid and l.status = 'PUBLISHED'
     and not exists (select 1 from promotion.placements pl where pl.listing_id = l.id);
  if lid is null then raise exception 'PROBE_FAIL b5-promotion-purchase: no published listing to test against'; end if;

  -- Refusals.
  if (public.promotion_purchase_open(owner_id, lid, 'gold'))->>'reason' is distinct from 'unknown_tier' then
    raise exception 'PROBE_FAIL b5-promotion-purchase: an unknown tier opened';
  end if;
  if (public.promotion_purchase_open(stranger, lid, 'boost'))->>'reason' is distinct from 'not_your_listing' then
    raise exception 'PROBE_FAIL b5-promotion-purchase: a stranger opened a purchase on somebody else''s listing';
  end if;

  -- D60: a proposed price is never sold.
  if (public.promotion_purchase_open(owner_id, lid, 'boost'))->>'reason' is distinct from 'price_not_confirmed' then
    raise exception 'PROBE_FAIL b5-promotion-purchase: a purchase opened at a proposed price';
  end if;
  select count(*) into n from promotion.purchases where listing_id = lid;
  if n <> 0 then raise exception 'PROBE_FAIL b5-promotion-purchase: a refused open wrote a purchase'; end if;

  -- Confirm the same amounts as new dated rows (rolls back) so the rest can run.
  insert into promotion.tier_prices (tier, effective_from, amount_minor, duration_days, price_status, source)
  select p.tier, now(), p.amount_minor, p.duration_days, 'confirmed', 'probe'
    from unnest(array['boost', 'spotlight', 'featured']) t(tier)
    cross join lateral public.promotion_price_now(t.tier) p;

  -- Open: the amount is the dated row's.
  r := public.promotion_purchase_open(owner_id, lid, 'boost');
  if (r->>'ok')::boolean is not true or (r->>'amount_minor')::bigint <> 250000 or r->>'currency' <> 'NGN' then
    raise exception 'PROBE_FAIL b5-promotion-purchase: open did not freeze the boost price (%)', r;
  end if;
  ref := r->>'reference'; pid := (r->>'purchase_id')::uuid;
  if ref is distinct from 'rm-promo-' || pid::text then raise exception 'PROBE_FAIL b5-promotion-purchase: reference shape %', ref; end if;

  -- Frozen terms cannot move.
  ok := false;
  begin
    update promotion.purchases set amount_minor = 1 where id = pid;
  exception when others then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b5-promotion-purchase: a frozen price was changed'; end if;

  -- pending; a fresh checkout cannot be called abandoned; nor can mark reach paid.
  if not public.promotion_purchase_mark(ref, 'pending') then
    raise exception 'PROBE_FAIL b5-promotion-purchase: initialized did not move to pending';
  end if;
  if public.promotion_purchase_mark(ref, 'abandoned') then
    raise exception 'PROBE_FAIL b5-promotion-purchase: a checkout opened seconds ago was marked abandoned';
  end if;
  ok := false;
  begin
    perform public.promotion_purchase_mark(ref, 'paid');
  exception when others then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b5-promotion-purchase: mark reached paid'; end if;

  -- Not yet paid: no placement, no revenue.
  select count(*) into n from public.ledger_vallo_revenue where idempotency_key = 'promotion:' || pid::text;
  if n <> 0 then raise exception 'PROBE_FAIL b5-promotion-purchase: revenue before the webhook'; end if;

  -- One checkout in flight per listing+tier.
  if (public.promotion_purchase_open(owner_id, lid, 'boost'))->>'reason' is distinct from 'purchase_in_progress' then
    raise exception 'PROBE_FAIL b5-promotion-purchase: a second boost checkout opened while one was in flight';
  end if;
  -- After the hour a second checkout may open, so two paid boosts can exist (tested below).
  update promotion.purchases set created_at = now() - interval '2 hours' where id = pid;
  r2 := public.promotion_purchase_open(owner_id, lid, 'boost');
  if (r2->>'ok')::boolean is not true then raise exception 'PROBE_FAIL b5-promotion-purchase: an hour-old checkout still blocked (%)', r2; end if;
  refb := r2->>'reference';

  -- Settle with the wrong amount on a second purchase: mismatch, nothing activated.
  r2 := public.promotion_purchase_open(owner_id, lid, 'spotlight');
  ref2 := r2->>'reference';
  rm := public.promotion_purchase_settle(ref2, 1000, 'NGN');
  if rm->>'outcome' is distinct from 'mismatch' then raise exception 'PROBE_FAIL b5-promotion-purchase: short amount was not a mismatch (%)', rm; end if;
  select status into st from promotion.purchases where provider_reference = ref2;
  if st is distinct from 'mismatch' then raise exception 'PROBE_FAIL b5-promotion-purchase: mismatch status %', st; end if;
  select count(*) into n from public.ledger_vallo_revenue where idempotency_key = 'promotion:' || (r2->>'purchase_id');
  if n <> 0 then raise exception 'PROBE_FAIL b5-promotion-purchase: a mismatched charge was booked as revenue'; end if;
  if (public.promotion_purchase_settle(ref2, 750000, 'NGN'))->>'outcome' is distinct from 'mismatch' then
    raise exception 'PROBE_FAIL b5-promotion-purchase: a mismatched purchase activated on replay';
  end if;
  if (public.promotion_purchase_settle('rm-promo-' || gen_random_uuid()::text, 250000, 'NGN'))->>'outcome' is distinct from 'not_found' then
    raise exception 'PROBE_FAIL b5-promotion-purchase: an unknown reference was not not_found';
  end if;

  -- Wrong currency is a mismatch too (checked on the boost purchase without consuming it would be
  -- final, so it is tested on a third purchase).
  r2 := public.promotion_purchase_open(owner_id, lid, 'featured');
  if (public.promotion_purchase_settle(r2->>'reference', 2000000, 'USD'))->>'outcome' is distinct from 'mismatch' then
    raise exception 'PROBE_FAIL b5-promotion-purchase: a USD charge was accepted';
  end if;

  -- Settle: activates once.
  r := public.promotion_purchase_settle(ref, 250000, 'NGN');
  if r->>'outcome' is distinct from 'activated' then raise exception 'PROBE_FAIL b5-promotion-purchase: settle did not activate (%)', r; end if;
  select count(*) into n from promotion.placements
   where id = (r->>'placement_id')::uuid and listing_id = lid and tier = 'boost' and state = 'live'
     and label = 'Promoted' and ends_at = starts_at + interval '7 days';
  if n <> 1 then raise exception 'PROBE_FAIL b5-promotion-purchase: the placement is not a live 7 day labelled boost'; end if;
  select count(*) into n from public.ledger_vallo_revenue
   where idempotency_key = 'promotion:' || pid::text and event_type = 'FEE_CHARGED' and direction = 'in'
     and amount_minor = 250000 and currency = 'NGN' and provider = 'paystack' and provider_reference = ref;
  if n <> 1 then raise exception 'PROBE_FAIL b5-promotion-purchase: revenue not posted once as FEE_CHARGED in'; end if;

  -- Replay: nothing new.
  r2 := public.promotion_purchase_settle(ref, 250000, 'NGN');
  if r2->>'outcome' is distinct from 'duplicate' or r2->>'placement_id' is distinct from r->>'placement_id' then
    raise exception 'PROBE_FAIL b5-promotion-purchase: a replay was not a duplicate (%)', r2;
  end if;
  select count(*) into n from promotion.placements where listing_id = lid and tier = 'boost';
  if n <> 1 then raise exception 'PROBE_FAIL b5-promotion-purchase: a replay opened a second placement'; end if;
  select count(*) into n from public.ledger_vallo_revenue where idempotency_key = 'promotion:' || pid::text;
  if n <> 1 then raise exception 'PROBE_FAIL b5-promotion-purchase: a replay posted revenue twice'; end if;

  -- A second paid boost queues behind the first: never two at once.
  r2 := public.promotion_purchase_settle(refb, 250000, 'NGN');
  if r2->>'outcome' is distinct from 'activated' then raise exception 'PROBE_FAIL b5-promotion-purchase: the second boost did not settle (%)', r2; end if;
  select count(*) into n from promotion.placements a join promotion.placements b
    on a.listing_id = b.listing_id and a.tier = b.tier and a.id < b.id
   where a.listing_id = lid and a.tier = 'boost'
     and tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at);
  if n <> 0 then raise exception 'PROBE_FAIL b5-promotion-purchase: two paid boosts overlap'; end if;
  select count(*) into n from promotion.placements q join promotion.placements f on f.id = (r->>'placement_id')::uuid
   where q.id = (r2->>'placement_id')::uuid and q.state = 'scheduled' and q.starts_at = f.ends_at
     and q.ends_at = q.starts_at + interval '7 days';
  if n <> 1 then raise exception 'PROBE_FAIL b5-promotion-purchase: the second boost is not scheduled to start when the first ends'; end if;

  -- Paid is final; a late failure cannot unpick it.
  if public.promotion_purchase_mark(ref, 'failed') then
    raise exception 'PROBE_FAIL b5-promotion-purchase: a late charge.failed moved a paid purchase';
  end if;
  -- One active boost per listing.
  if (public.promotion_purchase_open(owner_id, lid, 'boost'))->>'reason' is distinct from 'already_active' then
    raise exception 'PROBE_FAIL b5-promotion-purchase: a second active boost opened';
  end if;

  -- Members: no direct access, no money doors, own rows only through the reader.
  if has_function_privilege('authenticated', 'public.promotion_purchase_settle(text,bigint,text)', 'execute')
     or has_function_privilege('authenticated', 'public.promotion_purchase_open(uuid,uuid,text)', 'execute')
     or has_function_privilege('anon', 'public.promotion_my_purchases()', 'execute')
     or has_schema_privilege('authenticated', 'promotion', 'usage') then
    raise exception 'PROBE_FAIL b5-promotion-purchase: a member can reach a promotion money door';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.promotion_my_purchases() where listing_id = lid;
  if n <> 4 then raise exception 'PROBE_FAIL b5-promotion-purchase: the lister sees % of their 4 purchases', n; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  select count(*) into n from public.promotion_my_purchases();
  if n <> 0 then raise exception 'PROBE_FAIL b5-promotion-purchase: a stranger sees % purchases', n; end if;
  reset role;

  raise exception 'PROBE_OK b5-promotion-purchase';
end $$;
