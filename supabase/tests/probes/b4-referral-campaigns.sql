-- B4 referral campaigns, the delta on b4_referral_rewards_engine (D62, D63,
-- D64, REFERRAL_ARCHITECTURE.md). Also: the 700,000 naira cap row, the 75
-- percent alert, the pause (never a refusal) and its member-visible status,
-- and budget given back when a reward is reversed before payment. Carries
-- the still-valid checks of the b4 probe it replaces (policy rows frozen, a
-- zero reward refused, payouts off by default, ledger privileges).
-- every registry check on its own; campaigns refuse unknown keys and frozen
-- terms; the member cap and platform budget refuse the racer for the last
-- slot; the full lifecycle with its refusals; the reward frozen at
-- qualification; nothing available before the review window; paid only on a
-- webhook, idempotently; append-only books; network alone never flags a
-- cluster; grants. Everything is rolled back by the final raise.
do $$
declare
  lagos      date := (now() at time zone 'Africa/Lagos')::date;
  stay       constant uuid := gen_random_uuid();
  stay_host uuid := gen_random_uuid();   -- the stay's host, filed below
  stay_host_agent uuid;
  this_month date := date_trunc('month', now() at time zone 'Africa/Lagos')::date;
  far1       constant date := '2999-01-01';
  far2       constant date := '2999-02-01';
  far3       constant date := '2999-03-01';
  far4       constant date := '2999-04-01';
  referrer   uuid := gen_random_uuid();
  referred   uuid := gen_random_uuid();
  fresh      uuid := gen_random_uuid();
  ra uuid := gen_random_uuid(); rb uuid := gen_random_uuid(); rc uuid := gen_random_uuid(); rr uuid := gen_random_uuid();
  camp uuid; camp_old uuid; kind_free text; tg name; rate bigint; bk uuid; tx uuid;
  rid uuid; rid2 uuid; rid3 uuid; rid4 uuid; ca uuid; cb uuid; cc uuid;
  pid uuid; pref text; pid2 uuid; pref2 text;
  ok boolean; n int; bal bigint; res jsonb; st text; v text; amt bigint; u uuid; f text;
  phone_of text;
begin
  -- ------------------------------------------------------------ fixtures
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'probe-b4-' || x || '@example.invalid', '{}', '{}', now(), now()
    from unnest(array[referrer, referred, fresh, ra, rb, rc, rr]) x;

  -- ---------------------------------------------- carried from the b4 probe
  ok := false;
  begin
    update public.referral_policy set withdrawal_min_minor = 1 where id = (private.referral_policy_now()).id;
  exception when others then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a policy row was rewritten'; end if;
  ok := false;
  begin
    insert into public.referral_policy (reward_minor, member_monthly_cap, platform_monthly_budget_minor, withdrawal_min_minor,
                                        effective_from, reason)
    values (0, 1500, 0, 100000, now() + interval '100 years', 'probe: a zero reward row');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a zero-reward policy row was accepted'; end if;
  if not coalesce((private.referral_policy_now()).payouts_enabled, false) then
    res := public.rewards_payout_open(referrer, '058', '0123456789', 'PROBE NAME', 'RCP_probe');
    if res ->> 'status' <> 'not_available' then
      raise exception 'PROBE_FAIL b4-referral-campaigns: a payout opened while payouts are off (%)', res;
    end if;
  end if;
  -- THE NO-CAP PATH: a month with no cap ever set before it has no budget row,
  -- so nothing qualifies and (the same check) nothing pays.
  if private.referral_budget_period_ensure('1999-01-01') is not null
     or private.referral_reserve(gen_random_uuid(), referrer, '1999-01-01', 7000, 14000) is distinct from 'budget_paused' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a month with no cap reserved money';
  end if;
  if has_table_privilege('authenticated', 'public.rewards_ledger', 'INSERT')
     or has_table_privilege('authenticated', 'public.rewards_ledger', 'UPDATE')
     or has_column_privilege('authenticated', 'public.rewards_ledger', 'actor_id', 'SELECT')
     or has_column_privilege('authenticated', 'public.rewards_ledger', 'idempotency_key', 'SELECT')
     or has_table_privilege('service_role', 'public.rewards_ledger', 'TRUNCATE')
     or has_table_privilege('service_role', 'public.rewards_ledger', 'INSERT')
     or has_table_privilege('anon', 'public.rewards_ledger', 'SELECT')
     or has_table_privilege('authenticated', 'public.referral_policy', 'SELECT') then
    raise exception 'PROBE_FAIL b4-referral-campaigns: ledger or policy privileges are open';
  end if;

  -- A policy row for this transaction: payouts on, a 100 kobo minimum, a
  -- review threshold no fixture reaches, and a cluster threshold of 1 so
  -- that only the non-network rule can be what keeps a cluster unflagged.
  insert into public.referral_policy (reward_minor, member_monthly_cap, platform_monthly_budget_minor,
                                      withdrawal_min_minor, review_risk_score, cluster_flag_score, velocity_per_day,
                                      payouts_enabled, effective_from, reason)
  values (7000, 1500, 0, 100, 1000, 1, 1000, true, now(), 'probe: payouts on for this transaction only');

  -- D64: the decided cap row and the launch campaign landed.
  if not exists (select 1 from public.referral_budget_periods where period_month = '2026-10-01' and cap_minor = 70000000) then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the 700,000 naira cap row is missing';
  end if;
  if not exists (select 1 from public.referral_campaigns where slug = 'launch-d51' and reward_minor = 7000) then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the launch campaign is missing';
  end if;

  -- ===================================================== 1. THE REGISTRY
  if (select count(*) from public.referral_requirements) <> 8 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the registry does not hold the eight launch keys';
  end if;
  -- Each key, failing on a member who has done nothing, with its own reason.
  foreach v in array array['phone_verified','email_verified','onboarding_completed','meaningful_activity',
                           'business_profile_completed','business_verified','property_owner_verified','space_published'] loop
    if private.referral_requirement_check(v, fresh, null) is null then
      raise exception 'PROBE_FAIL b4-referral-campaigns: % passed for a member who did nothing', v;
    end if;
    if private.referral_requirement_check(v, fresh, null) like 'unknown_requirement%' then
      raise exception 'PROBE_FAIL b4-referral-campaigns: % has no dispatcher arm', v;
    end if;
  end loop;
  if private.referral_requirement_check('meaningful_activity_for_hotels', fresh, null) not like 'unknown_requirement%' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: an unregistered key resolved';
  end if;
  -- The registry is fixed.
  ok := false;
  begin
    update public.referral_requirements set description = 'probe rewrite of a fixed key' where key = 'phone_verified';
  exception when others then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a registry row was rewritten'; end if;

  -- phone_verified
  phone_of := '+2348' || lpad((floor(random() * 1e9))::bigint::text, 9, '0');
  insert into public.confirmed_phones (user_id, phone) values (fresh, phone_of);
  if private.referral_requirement_check('phone_verified', fresh, null) is not null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: phone_verified failed a confirmed phone';
  end if;
  -- email_verified
  update auth.users set email_confirmed_at = now() where id = fresh;
  if private.referral_requirement_check('email_verified', fresh, null) is not null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: email_verified failed a confirmed email';
  end if;
  -- onboarding_completed
  insert into public.profiles (id, first_name, terms_accepted_at, terms_version)
  values (fresh, 'Probe', now(), 'probe') on conflict (id) do update
     set first_name = 'Probe', terms_accepted_at = now(), terms_version = 'probe';
  if private.referral_requirement_check('onboarding_completed', fresh, null) is not null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: onboarding_completed failed a finished onboarding';
  end if;
  -- 16 November 2026: the example collection is gone from the live database (the
  -- Vallo Examples user e0000000-...-0001, its listings, hotels and threads; the
  -- agent row e0000000-...-0002 now belongs to a real account), and the founder
  -- does not want it back. This probe used to borrow it. It now files its own
  -- host for this transaction: a fresh auth user (the signup trigger makes the
  -- profile), an approved business agent, and fresh listings with the same facts
  -- as the example rows it borrowed: a nightly shortlet in Lekki (stay), listed
  -- by a fresh host of its own. All of it is rolled back with the probe. Nothing
  -- asserted below changes.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (stay_host, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-b4-referral-campaigns-host-' || stay_host || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (stay_host, 'Probe b4-referral-campaigns host', 'business', 'APPROVED')
  returning id into stay_host_agent;
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (stay, stay_host_agent, 'DRAFT', 'Probe One bedroom serviced flat, Lekki Phase 1', 'Fully furnished with an inverter that carries the flat through the night. Let by the night.', 'shortlet', 'LA', 'Lagos', 'Lekki Phase 1', 6.4472, 3.4738, 1, 1, 1, 'fully_furnished', 'rent', 8500000, 'night', 'agent');
  -- Published the way the platform publishes an agent listing: on an
  -- approved mandate (SCUML item 17), then PUBLISHED.
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id in (stay) and listing_role <> 'owner'
     and not private.listing_has_live_mandate(id);
  update public.listings set status = 'PUBLISHED', published_at = now() where id in (stay);
  -- meaningful_activity: a settled payment of their own (the chargebacks
  -- booking fixture: the seeded stay, its supply-proof gate lifted here only).
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings disable trigger %I', tg);
  end loop;
  update public.listings set is_demo = false where id = stay;
  for tg in select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and tgfoid = 'private.listing_supply_proof_gate'::regproc loop
    execute format('alter table public.listings enable trigger %I', tg);
  end loop;
  select rate_minor into rate from public.listings where id = stay;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, fresh, lagos + 40, lagos + 42, 2, rate, rate * 2, rate * 2, 'PENDING') returning id into bk;
  perform set_config('vallo.recording_unknown_charge', 'on', true);
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status)
  values (bk, 'paystack', 'b4-probe-' || gen_random_uuid(), 100000, 'NGN', 'SUCCESSFUL') returning id into tx;
  perform set_config('vallo.recording_unknown_charge', '', true);
  if private.referral_requirement_check('meaningful_activity', fresh, '{"action":"settled_payment"}') is not null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: meaningful_activity failed a settled payment';
  end if;
  if private.referral_requirement_check('meaningful_activity', fresh, '{"min_minor": 100001}') is null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: meaningful_activity ignored its min_minor parameter';
  end if;
  if private.referral_requirement_check('meaningful_activity', fresh, '{"action":"signed_up"}') <> 'unknown_activity_parameter' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: meaningful_activity accepted an undefined action';
  end if;
  -- business_profile_completed, business_verified, property_owner_verified,
  -- space_published: verified by their own records, which a probe cannot
  -- mint, so each is asserted against a member who holds one, where any does.
  select b.owner_id into u from public.businesses b where b.owner_id is not null and not b.is_demo
     and nullif(btrim(b.name), '') is not null and nullif(btrim(coalesce(b.phone, '')), '') is not null
     and nullif(btrim(coalesce(b.address, '')), '') is not null and b.state_code is not null and b.submitted_at is not null limit 1;
  if u is not null and private.referral_requirement_check('business_profile_completed', u, null) is not null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: business_profile_completed failed a complete business';
  end if;
  u := null;
  select b.owner_id into u from public.businesses b where b.owner_id is not null and not b.is_demo and b.verified limit 1;
  if u is not null and private.referral_requirement_check('business_verified', u, null) is not null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: business_verified failed a verified business';
  end if;
  u := null;
  select a.user_id into u from public.listings l join public.agents a on a.id = l.agent_id
   where not l.is_demo and l.listing_role = 'owner' and l.ownership_verified_at is not null limit 1;
  if u is not null and private.referral_requirement_check('property_owner_verified', u, null) is not null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: property_owner_verified failed accepted ownership';
  end if;
  u := null;
  select a.user_id into u from public.listings l join public.agents a on a.id = l.agent_id
   where not l.is_demo and l.status = 'PUBLISHED' and l.published_at is not null limit 1;
  if u is not null and private.referral_requirement_check('space_published', u, null) is not null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: space_published failed a published listing';
  end if;

  -- ====================================================== 2. CAMPAIGNS
  ok := false;
  begin
    insert into public.referral_campaigns (slug, kind, title, reward_minor, member_cap_minor, review_window, requirement_keys, starts_at, reason)
    values ('probe-unknown-key', 'consumer', 'Probe', 7000, 14000, interval '1 day', array['phone_verified','is_nice_person'], now(), 'probe: an unknown key');
  exception when sqlstate 'RM420' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a campaign with an unknown requirement key was saved'; end if;
  -- One reward per verified identity needs an anchor: a confirmed phone, or
  -- (D85, pending) a confirmed email. A campaign with neither is refused
  -- before and after D85.
  ok := false;
  begin
    insert into public.referral_campaigns (slug, kind, title, reward_minor, member_cap_minor, review_window, requirement_keys, starts_at, reason)
    values ('probe-no-phone', 'consumer', 'Probe', 7000, 14000, interval '1 day', array['onboarding_completed'], now(), 'probe: no identity key');
  exception when sqlstate 'RM421' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a campaign without an identity anchor was saved'; end if;
  ok := false;
  begin
    insert into public.referral_campaigns (slug, kind, title, reward_minor, member_cap_minor, review_window, requirement_keys,
                                           requirement_params, starts_at, reason)
    values ('probe-bad-params', 'consumer', 'Probe', 7000, 14000, interval '1 day', array['phone_verified','meaningful_activity'],
            '{"meaningful_activity": {"action": "anything at all"}}', now(), 'probe: an expression in a parameter');
  exception when sqlstate 'RM420' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a campaign with an undefined parameter was saved'; end if;
  ok := false;
  begin
    insert into public.referral_campaigns (slug, kind, title, reward_minor, member_cap_minor, review_window, requirement_keys, starts_at, reason)
    values ('probe-no-window', 'consumer', 'Probe', 7000, 14000, interval '0', array['phone_verified'], now(), 'probe: no review window');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a campaign without a review window was saved'; end if;

  -- The probe's own live campaign, on a kind nobody is running.
  select k into kind_free from unnest(array['consumer','business','supply']) k
   where not exists (select 1 from public.referral_campaigns c where c.kind = k and c.status = 'active') limit 1;
  if kind_free is null then raise exception 'PROBE_FAIL b4-referral-campaigns: every campaign kind is active; no room for the probe campaign'; end if;
  insert into public.referral_campaigns (slug, kind, title, reward_minor, member_cap_minor, review_window, requirement_keys,
                                         requirement_params, status, starts_at, reason)
  values ('probe-b4-' || left(gen_random_uuid()::text, 8), kind_free, 'Probe campaign', 7000, 14000, interval '3 days',
          array['phone_verified','email_verified','onboarding_completed','meaningful_activity'],
          '{"meaningful_activity": {"action": "settled_payment"}}', 'active', now() - interval '1 day', 'probe: the live campaign for this transaction')
  returning id into camp;
  insert into public.referral_campaigns (slug, kind, title, reward_minor, member_cap_minor, review_window, requirement_keys,
                                         status, starts_at, reason)
  values ('probe-b4-old-' || left(gen_random_uuid()::text, 8), kind_free, 'Probe ended campaign', 5000, 10000, interval '1 day',
          array['phone_verified'], 'draft', now() - interval '10 days', 'probe: a campaign that is not live')
  returning id into camp_old;
  update public.referral_campaigns set status = 'ended' where id = camp_old;
  ok := false;
  begin
    update public.referral_campaigns set reward_minor = 9999 where id = camp;
  exception when sqlstate 'RM422' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a live campaign''s reward was rewritten'; end if;

  -- ============================================= 3. CAPS AND THE BUDGET RACE
  insert into public.referral_budget_periods (period_month, cap_minor, reason) values (far1, 10000, 'probe: one slot of 7,000');
  v := private.referral_reserve(camp, ra, far1, 7000, 14000);
  if v is not null then raise exception 'PROBE_FAIL b4-referral-campaigns: the first reservation was refused (%)', v; end if;
  -- The racer for the last slot: 7,000 + 7,000 > 10,000.
  v := private.referral_reserve(camp, rb, far1, 7000, 14000);
  if v is distinct from 'budget_paused' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: two reservations both fitted into the last slot (%)', v;
  end if;
  if (select committed_minor from public.referral_budget_periods where period_month = far1) <> 7000 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the losing racer moved the committed total';
  end if;
  if exists (select 1 from public.referral_member_period_spend where member_id = rb and period_month = far1) then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the losing racer kept its member reservation';
  end if;
  -- The ceiling holds even against a direct write, and committed never falls.
  ok := false;
  begin
    update public.referral_budget_periods set committed_minor = 10001 where period_month = far1;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: the committed total passed the cap'; end if;
  ok := false;
  begin
    update public.referral_budget_periods set committed_minor = 0 where period_month = far1;
  exception when sqlstate 'RM412' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a committed total went down'; end if;
  -- The member cap: two rewards of 7,000 fit 14,000; a third does not, and
  -- the platform budget is untouched by the refusal.
  insert into public.referral_budget_periods (period_month, cap_minor, reason) values (far2, 100000000, 'probe: a wide budget');
  if private.referral_reserve(camp, ra, far2, 7000, 14000) is not null
     or private.referral_reserve(camp, ra, far2, 7000, 14000) is not null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the member cap refused rewards within it';
  end if;
  if private.referral_reserve(camp, ra, far2, 7000, 14000) is distinct from 'member_cap_reached' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a member went past the campaign cap';
  end if;
  if (select committed_minor from public.referral_budget_periods where period_month = far2) <> 14000 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a member-cap refusal still spent platform budget';
  end if;
  -- A new month carries the latest cap forward on first use.
  if private.referral_reserve(camp, rc, far3, 7000, 14000) is not null
     or (select cap_minor from public.referral_budget_periods where period_month = far3) <> 100000000 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a new month did not carry the cap forward';
  end if;
  -- 75 PERCENT: one high alert for the month, not one per qualification.
  insert into public.referral_budget_periods (period_month, cap_minor, reason) values (far4, 9000, 'probe: alert threshold');
  if private.referral_reserve(camp, ra, far4, 7000, 14000) is not null
     or private.referral_reserve(camp, rb, far4, 1000, 14000) is not null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: reservations under the cap were refused';
  end if;
  if (select count(*) from public.risk_alerts where entity_type = 'referral_budget_period' and entity_id = far4::text) <> 1
     or (select alerted_at from public.referral_budget_periods where period_month = far4) is null then
    raise exception 'PROBE_FAIL b4-referral-campaigns: crossing 75 percent did not raise exactly one alert';
  end if;
  if private.referral_reserve(camp, rc, far4, 7000, 14000) is distinct from 'budget_paused' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a full budget did not pause';
  end if;

  -- ====================================== 4. QUALIFICATION, END TO END
  insert into public.referral_budget_periods as b (period_month, cap_minor, reason)
  values (this_month, 1000000, 'probe: this month''s budget for this transaction')
  on conflict (period_month) do update set cap_minor = b.cap_minor + 1000000;
  update auth.users set email_confirmed_at = now() where id = referred;
  insert into public.profiles (id, first_name, terms_accepted_at, terms_version)
  values (referred, 'Probe', now(), 'probe') on conflict (id) do update
     set first_name = 'Probe', terms_accepted_at = now(), terms_version = 'probe';
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, referred, lagos + 50, lagos + 52, 2, rate, rate * 2, rate * 2, 'PENDING') returning id into bk;
  perform set_config('vallo.recording_unknown_charge', 'on', true);
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status)
  values (bk, 'paystack', 'b4-probe-' || gen_random_uuid(), 100000, 'NGN', 'SUCCESSFUL') returning id into tx;
  perform set_config('vallo.recording_unknown_charge', '', true);
  insert into public.referrals (referrer_id, referred_id, code, campaign_id) values (referrer, referred, 'PROBE1', camp) returning id into rid;
  -- Everything but the phone: attributed, blocked on the first failing key.
  v := private.referral_try_qualify(referred);
  select status, blocked_on into st, v from public.referrals where id = rid;
  if st <> 'attributed' or v <> 'phone_not_verified' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: without a phone the referral is % blocked on %', st, v;
  end if;
  -- The phone arrives: the trigger qualifies it into the review window.
  insert into public.confirmed_phones (user_id, phone) values (referred, '+2347' || lpad((floor(random() * 1e9))::bigint::text, 9, '0'));
  if (select status from public.referrals where id = rid) <> 'pending' then
    v := private.referral_try_qualify(referred);
  end if;
  select status, reward_minor into st, amt from public.referrals where id = rid;
  if st <> 'pending' or amt <> 7000 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a fully qualified referral is % with reward %', st, amt;
  end if;
  if not exists (select 1 from public.referrals where id = rid and review_until = qualified_at + interval '3 days'
                   and period_month = this_month and qualifying_tx_id = tx and blocked_on is null) then
    raise exception 'PROBE_FAIL b4-referral-campaigns: qualification did not freeze the window, period and payment';
  end if;
  if not exists (select 1 from public.referral_member_period_spend where campaign_id = camp and member_id = referrer
                   and period_month = this_month and committed_minor = 7000) then
    raise exception 'PROBE_FAIL b4-referral-campaigns: qualification reserved nothing against the member cap';
  end if;
  -- FROZEN: the amount never changes after qualification.
  ok := false;
  begin
    update public.referrals set reward_minor = 1 where id = rid;
  exception when sqlstate 'RM403' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a frozen reward was changed'; end if;
  ok := false;
  begin
    update public.referrals set review_until = now() - interval '1 day' where id = rid;
  exception when sqlstate 'RM403' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a review window was shortened after qualification'; end if;
  -- THE WINDOW: not available before it ends, by sweep or by hand.
  perform public.referral_release_due();
  if (select status from public.referrals where id = rid) <> 'pending' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the release sweep ignored the review window';
  end if;
  ok := false;
  begin
    update public.referrals set status = 'available' where id = rid;
  exception when sqlstate 'RM405' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a reward became available inside its review window'; end if;
  -- 100 PERCENT PAUSES, never refuses, never reaches back: fill this month to
  -- the brim, qualify another referral, then raise the cap and retry.
  update public.referral_budget_periods set cap_minor = committed_minor where period_month = this_month;
  if public.referral_programme_status() ->> 'status' <> 'paused' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a full budget still reads open to members';
  end if;
  update auth.users set email_confirmed_at = now() where id = rr;
  insert into public.profiles (id, first_name, terms_accepted_at, terms_version)
  values (rr, 'Probe', now(), 'probe') on conflict (id) do update
     set first_name = 'Probe', terms_accepted_at = now(), terms_version = 'probe';
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, rr, lagos + 60, lagos + 62, 2, rate, rate * 2, rate * 2, 'PENDING') returning id into bk;
  perform set_config('vallo.recording_unknown_charge', 'on', true);
  insert into public.transactions (booking_id, provider, provider_ref, amount_minor, currency, status)
  values (bk, 'paystack', 'b4-probe-' || gen_random_uuid(), 100000, 'NGN', 'SUCCESSFUL');
  perform set_config('vallo.recording_unknown_charge', '', true);
  -- Attributed under a campaign that has since ended: it qualifies under the
  -- live campaign of the same kind, at that campaign's reward.
  insert into public.referrals (referrer_id, referred_id, code, campaign_id) values (referrer, rr, 'PROBEP', camp_old) returning id into rid4;
  insert into public.confirmed_phones (user_id, phone) values (rr, '+2347' || lpad((floor(random() * 1e9))::bigint::text, 9, '0'));
  perform private.referral_try_qualify(rr);
  select status, blocked_on into st, v from public.referrals where id = rid4;
  if st <> 'attributed' or v <> 'budget_paused' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: past the cap a referral is % (%), not paused', st, v;
  end if;
  if (select status from public.referrals where id = rid) <> 'pending' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the pause reached back to a qualified reward';
  end if;
  update public.referral_budget_periods set cap_minor = cap_minor + 1000000 where period_month = this_month;
  perform private.referral_try_qualify(rr);
  if (select status from public.referrals where id = rid4) <> 'pending' or public.referral_programme_status() ->> 'status' <> 'open' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: raising the cap did not resume qualification';
  end if;
  if not exists (select 1 from public.referrals where id = rid4 and campaign_id = camp and reward_minor = 7000) then
    raise exception 'PROBE_FAIL b4-referral-campaigns: an ended campaign stranded its referral or set its reward';
  end if;
  -- REVERSED BEFORE PAYMENT GIVES THE BUDGET BACK, once, by a release row.
  select committed_minor into amt from public.referral_budget_periods where period_month = this_month;
  perform private.referral_reverse(rid4, 'probe: refunded before payment', null);
  perform private.referral_reverse(rid4, 'probe: refunded before payment', null);
  if (select committed_minor from public.referral_budget_periods where period_month = this_month) <> amt - 7000
     or (select count(*) from public.referral_budget_releases where referral_id = rid4) <> 1
     or (select committed_minor from public.referral_member_period_spend
          where campaign_id = camp and member_id = referrer and period_month = this_month) <> 7000 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a pre-payment reversal did not give its budget back exactly once';
  end if;
  ok := false;
  begin
    update public.referral_budget_releases set amount_minor = 1 where referral_id = rid4;
  exception when sqlstate 'RM402' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a budget release was rewritten'; end if;

  -- One reward per verified phone.
  ok := false;
  begin
    insert into public.referrals (referrer_id, referred_id, code, referred_phone_key)
    values (rr, gen_random_uuid(), 'PROBE2', (select referred_phone_key from public.referrals where id = rid));
  exception when unique_violation then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: one phone earned two referral rewards'; end if;

  -- ======================================== 5. THE LIFECYCLE, TRANSITIONS
  ok := false;
  begin
    insert into public.referrals (referrer_id, referred_id, code) values (rr, gen_random_uuid(), 'PROBE3') returning id into rid3;
    update public.referrals set status = 'paid' where id = rid3;
  exception when sqlstate 'RM403' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: attributed moved straight to paid'; end if;

  -- Rewards whose window has already passed (inserted qualified, as a
  -- referral from an earlier month would be).
  insert into public.referrals (referrer_id, referred_id, code, campaign_id, status, reward_minor, period_month,
                                qualified_at, review_until)
  values (referrer, gen_random_uuid(), 'PROBE4', camp, 'pending', 7000, this_month, now() - interval '5 days', now() - interval '2 days')
  returning id into rid2;
  insert into public.referrals (referrer_id, referred_id, code, campaign_id, status, reward_minor, period_month,
                                qualified_at, review_until)
  values (referrer, gen_random_uuid(), 'PROBE5', camp, 'pending', 7000, this_month, now() - interval '5 days', now() - interval '2 days')
  returning id into rid3;
  insert into public.referrals (referrer_id, referred_id, code, campaign_id, status, reward_minor, period_month,
                                qualified_at, review_until)
  values (rr, gen_random_uuid(), 'PROBE6', camp, 'pending', 7000, this_month, now() - interval '5 days', now() - interval '2 days')
  returning id into rid4;

  -- UNDER REVIEW is reversible: pending > under_review > approved > available.
  perform private.referral_move(rid3, 'under_review', 'probe: looked at by a person', null);
  ok := false;
  begin
    update public.referrals set status = 'available' where id = rid3;
  exception when sqlstate 'RM403' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: under_review skipped the decision'; end if;
  perform private.referral_move(rid3, 'approved', 'probe: cleared', null);
  -- And the other way: under_review > rejected > reversed, which is terminal.
  perform private.referral_move(rid4, 'under_review', 'probe: looked at by a person', null);
  perform private.referral_move(rid4, 'rejected', 'probe: refused on review', null);
  perform private.referral_reverse(rid4, 'probe: refused on review', null);
  ok := false;
  begin
    update public.referrals set status = 'pending' where id = rid4;
  exception when sqlstate 'RM403' then ok := true;
  end;
  if not ok or (select status from public.referrals where id = rid4) <> 'reversed' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a rejected reward was not terminally reversed';
  end if;

  perform public.referral_release_due();
  if (select status from public.referrals where id = rid2) <> 'available'
     or (select status from public.referrals where id = rid3) <> 'available' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: past-window rewards were not released';
  end if;
  select coalesce(sum(amount_minor), 0) into bal from public.rewards_ledger where member_id = referrer;
  if bal <> 14000 then raise exception 'PROBE_FAIL b4-referral-campaigns: the balance after release is %, not 14000', bal; end if;

  -- APPEND ONLY.
  ok := false;
  begin
    update public.rewards_ledger set amount_minor = 99999 where member_id = referrer;
  exception when sqlstate 'RM402' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a ledger entry was rewritten'; end if;
  ok := false;
  begin
    truncate public.rewards_ledger;
  exception when others then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: the ledger was truncated'; end if;
  ok := false;
  begin
    update public.referral_events set reason = 'probe rewrite' where referral_id = rid;
  exception when sqlstate 'RM402' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a referral event was rewritten'; end if;

  -- ======================================== 6. PAYOUT: SENT, THEN PAID BY WEBHOOK
  insert into public.confirmed_phones (user_id, phone) values (referrer, '+2349' || lpad((floor(random() * 1e9))::bigint::text, 9, '0'));
  res := public.rewards_payout_open(referrer, '058', '0123456789', 'PROBE NAME', 'RCP_probe');
  if res ->> 'status' not in ('processing', 'under_review') or (res ->> 'amount_minor')::bigint <> 14000 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the payout did not open for 14000 (%)', res;
  end if;
  pid := (res ->> 'payout_id')::uuid; pref := res ->> 'reference';
  if res ->> 'status' = 'under_review' then
    update public.rewards_payouts set status = 'processing' where id = pid;  -- as a staff release would
  end if;
  if (select count(*) from public.referrals where payout_id = pid and status = 'withdrawal_requested') <> 2 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the payout did not take both referrals';
  end if;
  if not public.rewards_payout_claim_send(pref) or public.rewards_payout_claim_send(pref) then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a payout was claimed for sending other than exactly once';
  end if;
  if (select status from public.rewards_payouts where id = pid) <> 'sent'
     or exists (select 1 from public.referrals where payout_id = pid and status <> 'sent') then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a claimed payout is not sent';
  end if;
  -- The transfer API saying success pays nothing.
  res := public.rewards_payout_settle(pref, 'paid', 'success');
  if (select status from public.rewards_payouts where id = pid) <> 'sent' or not coalesce((res ->> 'awaiting_webhook')::boolean, false) then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the API response marked a payout paid (%)', res;
  end if;
  ok := false;
  begin
    update public.rewards_payouts set status = 'paid' where id = pid;
  exception when sqlstate 'RM406' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a payout became paid without a webhook'; end if;
  ok := false;
  begin
    update public.referrals set status = 'paid' where id = rid2;
  exception when sqlstate 'RM406' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a referral became paid without a webhook'; end if;
  -- A webhook with the wrong amount is an incident, not a payment.
  res := public.rewards_payout_webhook(pref, 'transfer.success', 13999, 'TRF_probe');
  if res ->> 'outcome' <> 'amount_mismatch' or (select status from public.rewards_payouts where id = pid) <> 'sent' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a mismatched webhook was applied (%)', res;
  end if;
  -- The right webhook pays; the same webhook again pays once.
  res := public.rewards_payout_webhook(pref, 'transfer.success', 14000, 'TRF_probe');
  if res ->> 'status' <> 'paid' then raise exception 'PROBE_FAIL b4-referral-campaigns: the webhook did not pay (%)', res; end if;
  res := public.rewards_payout_webhook(pref, 'transfer.success', 14000, 'TRF_probe');
  if not (res ->> 'duplicate')::boolean then raise exception 'PROBE_FAIL b4-referral-campaigns: a repeated webhook was not idempotent'; end if;
  if (select count(*) from public.rewards_transfer_events where reference = pref and outcome = 'applied_paid') <> 1
     or (select count(*) from public.ledger_marketing_float where idempotency_key = 'rewards-paid:' || pref) <> 1 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: one transfer was paid or posted more than once';
  end if;
  if exists (select 1 from public.referrals where payout_id = pid and status <> 'paid') then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the webhook left a referral unpaid';
  end if;
  ok := false;
  begin
    update public.rewards_transfer_events set outcome = 'no_change' where reference = pref;
  exception when sqlstate 'RM402' then ok := true;
  end;
  if not ok then raise exception 'PROBE_FAIL b4-referral-campaigns: a webhook record was rewritten'; end if;
  -- Paid, then reversed: the loss stays visible, nothing is rewritten.
  perform private.referral_reverse(rid2, 'probe: chargeback after payment', null);
  if not exists (select 1 from public.rewards_ledger where referral_id = rid2 and kind = 'reward_reversed'
                   and amount_minor = -7000 and reason = 'probe: chargeback after payment') then
    raise exception 'PROBE_FAIL b4-referral-campaigns: the reversal entry is missing or carries no reason';
  end if;

  -- ======================================== 7. PAYOUT: TIMEOUT, THEN FAILED
  insert into public.referrals (referrer_id, referred_id, code, campaign_id, status, reward_minor, period_month,
                                qualified_at, review_until)
  values (rr, gen_random_uuid(), 'PROBE7', camp, 'pending', 7000, this_month, now() - interval '5 days', now() - interval '2 days')
  returning id into rid4;
  perform public.referral_release_due();
  res := public.rewards_payout_open(rr, '058', '0123456780', 'PROBE NAME', 'RCP_probe2');
  pid2 := (res ->> 'payout_id')::uuid; pref2 := res ->> 'reference';
  if pid2 is null then raise exception 'PROBE_FAIL b4-referral-campaigns: the second payout did not open (%)', res; end if;
  if res ->> 'status' = 'under_review' then update public.rewards_payouts set status = 'processing' where id = pid2; end if;
  perform public.rewards_payout_claim_send(pref2);
  res := public.rewards_payout_settle(pref2, 'unknown');
  select coalesce(sum(amount_minor), 0) into bal from public.rewards_ledger where member_id = rr;
  if (select status from public.rewards_payouts where id = pid2) <> 'unknown' or bal <> 0 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a timeout released money (balance %)', bal;
  end if;
  -- VERIFY NEVER RELEASES: a verify answer of failed, or a bare 'failed',
  -- holds the money and alerts staff.
  res := public.rewards_payout_settle(pref2, 'verify_failed', 'failed');
  res := public.rewards_payout_settle(pref2, 'failed', 'failed');
  select coalesce(sum(amount_minor), 0) into bal from public.rewards_ledger where member_id = rr;
  if (select status from public.rewards_payouts where id = pid2) <> 'unknown' or bal <> 0 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a verify answer released money (balance %)', bal;
  end if;
  if not exists (select 1 from public.risk_alerts where entity_type = 'rewards_payout' and entity_id = pref2 and severity = 'high') then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a verify failure raised no alert';
  end if;
  -- A failure webhook with the wrong amount is an incident, not a release.
  res := public.rewards_payout_webhook(pref2, 'transfer.failed', 6999);
  if res ->> 'outcome' <> 'amount_mismatch' or (select status from public.rewards_payouts where id = pid2) <> 'unknown' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a mismatched failure webhook was applied (%)', res;
  end if;
  res := public.rewards_payout_webhook(pref2, 'transfer.failed', 7000);
  res := public.rewards_payout_webhook(pref2, 'transfer.failed', 7000);
  select coalesce(sum(amount_minor), 0) into bal from public.rewards_ledger where member_id = rr;
  if bal <> 7000 or (select status from public.referrals where id = rid4) <> 'available' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a failed payout left balance % and status %', bal,
      (select status from public.referrals where id = rid4);
  end if;
  select count(*) into n from public.risk_alerts where entity_type = 'rewards_payout' and entity_id = pref2;
  res := public.rewards_payout_webhook(pref2, 'transfer.success', 7000);
  if res ->> 'outcome' <> 'conflict' or (select status from public.rewards_payouts where id = pid2) <> 'failed' then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a late success overturned a failed payout (%)', res;
  end if;
  if (select count(*) from public.risk_alerts where entity_type = 'rewards_payout' and entity_id = pref2 and severity = 'high') <> n + 1 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a webhook conflict raised no alert';
  end if;

  -- ================== 8. THE CLUSTER: NETWORK ALONE NEVER FLAGS (probe 5)
  insert into public.referrals (referrer_id, referred_id, code, campaign_id, status, reward_minor, period_month, qualified_at, review_until)
  values (rc, ra, 'PROBE8', camp, 'pending', 7000, this_month, now(), now() + interval '3 days') returning id into ca;
  insert into public.referrals (referrer_id, referred_id, code, campaign_id, status, reward_minor, period_month, qualified_at, review_until)
  values (rc, rb, 'PROBE8', camp, 'pending', 7000, this_month, now(), now() + interval '3 days') returning id into cb;
  insert into auth.sessions (id, user_id, ip, created_at, updated_at)
  select gen_random_uuid(), x, '198.51.100.7'::inet, now(), now() from unnest(array[rc, ra, rb]) x;
  perform public.referral_flag_clusters(5000);
  if exists (select 1 from public.referrals where id in (ca, cb) and status <> 'pending') then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a shared network alone flagged a cluster';
  end if;
  -- Add the strongest edge: two of them collect to one account.
  insert into public.rewards_payouts (member_id, amount_minor, reference, status, bank_code, account_last4, account_key, account_name)
  values (ra, 100, 'b4-probe-c1-' || gen_random_uuid(), 'failed', '058', '1111', 'probe-shared-account', 'PROBE'),
         (rb, 100, 'b4-probe-c2-' || gen_random_uuid(), 'failed', '058', '1111', 'probe-shared-account', 'PROBE');
  perform public.referral_flag_clusters(5000);
  if exists (select 1 from public.referrals where id in (ca, cb) and status <> 'under_review') then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a shared payout destination did not flag the cluster';
  end if;

  -- ============================================ 9. MEMBER VIEW AND GRANTS
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', rc)::text, true);
  if exists (select 1 from public.my_referrals(50) m where m.status not in ('invited','pending','available','sent','paid','not_rewarded'))
     or not exists (select 1 from public.my_referrals(50) m where m.id = ca and m.status = 'pending') then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a member saw an internal status';
  end if;
  if (public.my_rewards_summary() ->> 'pending_minor')::bigint <> 14000 then
    raise exception 'PROBE_FAIL b4-referral-campaigns: rewards under review are not shown as pending';
  end if;
  perform set_config('request.jwt.claims', '', true);

  foreach f in array array[
    'public.referral_release_due()', 'public.referral_qualify_pending(int)', 'public.referral_flag_clusters(int)',
    'public.my_rewards_summary()', 'public.my_referrals(int)',
    'public.rewards_payout_open(uuid,text,text,text,text)', 'public.rewards_payout_settle(text,text,text,text,text,text)',
    'public.rewards_payout_webhook(text,text,bigint,text,jsonb)', 'public.rewards_payout_claim_send(text)',
    'public.admin_referral_decide(uuid,text,text)', 'public.admin_referral_budget_set(date,bigint,text)',
    'public.referral_reverse_for_chargeback(uuid,text)', 'public.referral_programme_status()'] loop
    if has_function_privilege('anon', f, 'EXECUTE') then raise exception 'PROBE_FAIL b4-referral-campaigns: anon can run %', f; end if;
  end loop;
  foreach f in array array['public.rewards_payout_webhook(text,text,bigint,text,jsonb)',
                           'public.rewards_payout_settle(text,text,text,text,text,text)',
                           'public.rewards_payout_open(uuid,text,text,text,text)', 'public.referral_flag_clusters(int)'] loop
    if has_function_privilege('authenticated', f, 'EXECUTE') or not has_function_privilege('service_role', f, 'EXECUTE') then
      raise exception 'PROBE_FAIL b4-referral-campaigns: % is not service-role only', f;
    end if;
  end loop;
  foreach f in array array['public.referral_campaigns','public.referral_budget_periods','public.referral_member_period_spend',
                           'public.referral_requirements','public.referrals','public.rewards_ledger','public.rewards_transfer_events'] loop
    if has_table_privilege('service_role', f, 'TRUNCATE') or has_table_privilege('service_role', f, 'UPDATE')
       or has_table_privilege('authenticated', f, 'INSERT') or has_table_privilege('anon', f, 'SELECT') then
      raise exception 'PROBE_FAIL b4-referral-campaigns: an API role can write or truncate %', f;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.referrals', 'SELECT')
     or has_column_privilege('authenticated', 'public.rewards_payouts', 'risk_score', 'SELECT')
     or has_column_privilege('authenticated', 'public.rewards_payouts', 'account_key', 'SELECT') then
    raise exception 'PROBE_FAIL b4-referral-campaigns: a member can read referrals, risk or account keys';
  end if;

  raise exception 'PROBE_OK b4-referral-campaigns';
end $$;
