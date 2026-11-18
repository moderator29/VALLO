-- SEC-13 / STORE-P2-02 / ESC-06 / MON-09 / STORE-12: the account purge erases
-- what it promises and never erases money. Two throwaway accounts, created and
-- purged inside this transaction; always rolls back. Also: an approved
-- agent's identification record is kept for the AML period, staff can match
-- a new account to an erased mailbox, and delivered emails are pruned.
--
-- 29 September 2026: "money on the account" was a wallet pot. Vallo no longer
-- holds money (Track A), so it is now what private.deletion_money_blockers
-- counts: a rent refund the account owes as a lister. The purge must still
-- park such an account, and leave the refund owed exactly as it was.
do $$
declare
  rich   constant uuid := 'a5ec1300-0000-4000-8000-00000000000a';
  clean  constant uuid := 'b5ec1300-0000-4000-8000-00000000000b';
  agent  constant uuid := 'c5ec1300-0000-4000-8000-00000000000c';
  again  constant uuid := 'd5ec1300-0000-4000-8000-00000000000d';
  admin  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  lone   constant uuid := 'e5ec1300-0000-4000-8000-00000000000e';
  req_l  uuid;
  req_a  uuid;
  app_c  uuid;
  app_a  uuid;
  o_old  uuid;
  o_new  uuid;
  o_fail uuid;
  bk     uuid;
  stay   constant uuid := gen_random_uuid();
  lister constant uuid := gen_random_uuid();   -- the stay's host, filed below
  lister_agent uuid;
  app_old uuid;
  app_m  uuid;
  due_j  jsonb;
  req_r  uuid;
  req_c  uuid;
  res    jsonb;
  st     text;
  due    timestamptz;
  n      int;
  canon  text;
  rule   text;
begin
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
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (rich,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'probe.rich.sec13@gmail.com', '', now(), now(), now(), '{}'::jsonb, '{"first_name":"Probe","surname":"Rich"}'::jsonb),
    (clean, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'Probe.Clean.SEC13+x@gmail.com', '', now(), now(), now(), '{}'::jsonb, '{"first_name":"Probe","surname":"Clean"}'::jsonb),
    (agent, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'probe.agent.sec13@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{"first_name":"Probe","surname":"Agent"}'::jsonb);

  -- The clean account applied to be an agent and was rejected: nothing kept.
  insert into public.agent_applications (user_id, status, full_name, phone, id_type, id_number, bank_name, account_number)
  values (clean, 'REJECTED', 'Probe Clean', '08000000000', 'nin', '12345678901', 'Probe Bank', '0123456789')
  returning id into app_c;
  insert into public.agent_documents (application_id, uploader_id, kind, storage_path)
  values (app_c, clean, 'identity', clean::text || '/probe-id.jpg');

  -- The agent account was approved: its identification record is kept.
  insert into public.agent_applications (user_id, status, full_name, phone, email, residential_address, id_type, id_number, bank_name, account_number, account_name)
  values (agent, 'APPROVED', 'Probe Agent', '08000000001', 'probe.agent.sec13@example.invalid', '1 Probe Road', 'nin', '10987654321', 'Probe Bank', '9876543210', 'Probe Agent')
  returning id into app_a;
  insert into public.agent_documents (application_id, uploader_id, kind, storage_path)
  values (app_a, agent, 'identity', agent::text || '/probe-id.jpg');
  insert into public.agents (user_id, display_name) values (agent, 'Probe Agent');
  -- The same agent was rejected once before: that application keeps nothing.
  insert into public.agent_applications (user_id, status, full_name, id_type, id_number)
  values (agent, 'REJECTED', 'Probe Agent Earlier', 'nin', '55555555555')
  returning id into app_old;

  -- 16 November 2026: the example collection is gone from the live database (the
  -- Vallo Examples user e0000000-...-0001, its listings, hotels and threads; the
  -- agent row e0000000-...-0002 now belongs to a real account), and the founder
  -- does not want it back. This probe used to borrow it. It now files its own
  -- host for this transaction: a fresh auth user (the signup trigger makes the
  -- profile), an approved business agent, and fresh listings with the same facts
  -- as the example rows it borrowed: a nightly shortlet in Lekki (stay), which
  -- carries the far-future booking the refund hangs on. All of it is rolled back
  -- with the probe. Nothing asserted below changes.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (lister, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-sec-13-host-' || lister || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name, type, status) values (lister, 'Probe sec-13 host', 'business', 'APPROVED')
  returning id into lister_agent;
  insert into public.listings (id, agent_id, status, title, description, property_type, state_code, city, area, latitude, longitude, bedrooms, bathrooms, toilets, furnished, listing_intent, rate_minor, rate_period, listing_role)
  values (stay, lister_agent, 'DRAFT', 'Probe One bedroom serviced flat, Lekki Phase 1', 'Fully furnished with an inverter that carries the flat through the night. Let by the night.', 'shortlet', 'LA', 'Lagos', 'Lekki Phase 1', 6.4472, 3.4738, 1, 1, 1, 'fully_furnished', 'rent', 8500000, 'night', 'agent');
  -- The rich account owes a guest a rent refund, as a lister: money the
  -- platform must not let a deletion erase. The booking it hangs on is a
  -- far-future stay on an example listing made live for this transaction
  -- (an agent listing goes live only on an approved mandate, SCUML item 17).
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', admin, now(), 'owner', 'call_back', admin, now()
    from public.listings where id = stay and listing_role <> 'owner' and not private.listing_has_live_mandate(id);
  update public.listings set is_demo = false, status = 'PUBLISHED' where id = stay;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, nights, price_per_night_minor, subtotal_minor, total_minor, status)
  values (stay, member, (now() at time zone 'Africa/Lagos')::date + 300, (now() at time zone 'Africa/Lagos')::date + 302,
          2, 125000, 250000, 250000, 'CONFIRMED')
  returning id into bk;
  insert into public.rent_refunds_owed (booking_id, lister_id, amount_minor) values (bk, rich, 250000);

  -- The clean account has device and behavioural rows the purge used to leave.
  insert into public.push_tokens (user_id, platform, token, p256dh, auth)
  values (clean, 'web', 'https://web.push.apple.com/PROBE-sec13-' || gen_random_uuid(), 'k', 'a');
  insert into public.known_devices (user_id, fingerprint, device_words) values (clean, 'probe-fp', 'probe words');
  insert into public.email_outbox (dedupe_key, template, user_id) values ('probe-sec13-' || gen_random_uuid(), 'probe', clean);
  insert into public.price_check_events (user_id, check_id, stage) values (clean, gen_random_uuid(), 'start');
  insert into public.price_check_watches (user_id, lat, lng, property_type, listing_intent)
  values (clean, 6.5, 3.4,
          (select enum_range(null::public.property_type))[1],
          (select enum_range(null::public.listing_intent))[1]);

  select email_canonical into canon from public.account_identities where user_id = clean;
  if canon is distinct from 'probecleansec13@gmail.com' then
    raise exception 'PROBE_FAIL sec-13: setup canonical was %', canon;
  end if;

  -- The screen's question sees the refund owed (the service role asks it).
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  res := public.account_deletion_blockers(rich);
  if not (res ->> 'blocked')::boolean or (res ->> 'rent_refunds_owed_minor')::bigint <> 250000 then
    raise exception 'PROBE_FAIL sec-13: blockers did not see the refund owed: %', res;
  end if;
  res := public.account_deletion_blockers(clean);
  if (res ->> 'blocked')::boolean then
    raise exception 'PROBE_FAIL sec-13: a clean account reads blocked: %', res;
  end if;
  perform set_config('request.jwt.claims', '', true);

  -- A member may still only ask about themself.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', clean, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  begin
    perform public.account_deletion_blockers(rich);
    raise exception 'PROBE_FAIL sec-13: a member read somebody else''s blockers';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- Both deletions are due (the grace window is over).
  insert into public.account_deletion_requests (user_id, purge_after) values (rich, now() - interval '1 minute') returning id into req_r;
  insert into public.account_deletion_requests (user_id, purge_after) values (clean, now() - interval '1 minute') returning id into req_c;

  -- 1. Money on the account: parked, nothing erased, alert opened.
  res := public.purge_account_rows(req_r);
  if (res ->> 'purged')::boolean is true or res ->> 'reason' <> 'held_money' then
    raise exception 'PROBE_FAIL sec-13: the account owing a refund was purged: %', res;
  end if;
  select status, purge_after into st, due from public.account_deletion_requests where id = req_r;
  if st <> 'SCHEDULED' or due <= now() + interval '6 days' then
    raise exception 'PROBE_FAIL sec-13: parked request is % due %', st, due;
  end if;
  if (select display_name from public.profiles where id = rich) = 'Deleted account' then
    raise exception 'PROBE_FAIL sec-13: the parked account was scrubbed';
  end if;
  if not exists (select 1 from public.rent_refunds_owed r
                  where r.booking_id = bk and r.lister_id = rich and r.amount_minor = 250000 and r.cleared_at is null) then
    raise exception 'PROBE_FAIL sec-13: the refund owed changed';
  end if;
  select count(*) into n from public.risk_alerts
   where entity_type = 'account_deletion_request' and entity_id = req_r::text and status = 'open' and severity = 'high';
  if n <> 1 then raise exception 'PROBE_FAIL sec-13: % alerts for the parked deletion', n; end if;
  -- Not due any more, so the job does not pick it up again tomorrow.
  if exists (select 1 from jsonb_array_elements((public.due_account_purges(100)) -> 'requests') e
              where e ->> 'request_id' = req_r::text) then
    raise exception 'PROBE_FAIL sec-13: the parked request is still due';
  end if;

  -- 2. The clean account: purged, and the rows the purge used to leave are gone.
  res := public.purge_account_rows(req_c);
  if (res ->> 'purged')::boolean is not true then
    raise exception 'PROBE_FAIL sec-13: the clean account was not purged: %', res;
  end if;
  if exists (select 1 from public.push_tokens where user_id = clean)
     or exists (select 1 from public.known_devices where user_id = clean)
     or exists (select 1 from public.email_outbox where user_id = clean)
     or exists (select 1 from public.price_check_events where user_id = clean)
     or exists (select 1 from public.price_check_watches where user_id = clean) then
    raise exception 'PROBE_FAIL sec-13: device or behavioural rows survived the purge';
  end if;
  select email_canonical, canonical_rule into canon, rule from public.account_identities where user_id = clean;
  if canon is null or canon not like 'erased:%' or rule <> 'erased' or canon like '%probe%' then
    raise exception 'PROBE_FAIL sec-13: identity after purge is % / %', canon, rule;
  end if;
  if canon <> private.erased_identity_hash('probecleansec13@gmail.com') then
    raise exception 'PROBE_FAIL sec-13: the kept hash is not the keyed hash of the mailbox';
  end if;
  -- A later write to the address (the API scrub) does not put plaintext back.
  update auth.users set email = 'deleted+again@deleted.invalid' where id = clean;
  select email_canonical into canon from public.account_identities where user_id = clean;
  if canon not like 'erased:%' then
    raise exception 'PROBE_FAIL sec-13: the auth trigger overwrote the erased identity with %', canon;
  end if;

  -- The rejected applicant's identification is gone.
  if exists (select 1 from public.agent_documents where uploader_id = clean) then
    raise exception 'PROBE_FAIL sec-13: a rejected applicant''s document survived';
  end if;
  if (select id_number is not null or full_name is not null or kyc_retain_until is not null
        from public.agent_applications where id = app_c) then
    raise exception 'PROBE_FAIL sec-13: a rejected applicant''s ID number or name survived';
  end if;

  -- 3. The approved agent: purged, identification record kept for five years.
  insert into public.account_deletion_requests (user_id, purge_after) values (agent, now() - interval '1 minute') returning id into req_a;
  res := public.purge_account_rows(req_a);
  if (res ->> 'purged')::boolean is not true or (res -> 'counts' ->> 'kyc_retained')::boolean is not true then
    raise exception 'PROBE_FAIL sec-13: the approved agent was not purged with retention: %', res;
  end if;
  if res -> 'storage' ? 'agent-documents' then
    raise exception 'PROBE_FAIL sec-13: the retained identity files were listed for deletion';
  end if;
  if not exists (select 1 from public.agent_documents where uploader_id = agent) then
    raise exception 'PROBE_FAIL sec-13: the approved agent''s document was destroyed';
  end if;
  if not exists (select 1 from public.agent_applications
                  where id = app_a and id_number = '10987654321' and full_name = 'Probe Agent'
                    and account_number = '9876543210' and phone is null and email is null
                    and kyc_retain_until > now() + interval '4 years 11 months') then
    raise exception 'PROBE_FAIL sec-13: the approved agent''s record was not kept as scheduled';
  end if;
  if (select id_number is not null or full_name is not null or kyc_retain_until is not null
        from public.agent_applications where id = app_old) then
    raise exception 'PROBE_FAIL sec-13: the agent''s earlier rejected application was kept';
  end if;

  -- 3b. Five years on, the retained record is destroyed, and only the
  -- service role can do it.
  update public.agent_applications set kyc_retain_until = now() - interval '1 minute' where id = app_a;
  -- Not before the deletion has finished.
  if (public.destroy_expired_kyc(agent) ->> 'destroyed')::boolean then
    raise exception 'PROBE_FAIL sec-13: a record was destroyed before its account''s purge finished';
  end if;
  update public.account_deletion_requests set status = 'PURGED' where id = req_a;
  due_j := public.due_kyc_destructions(500);
  if not exists (select 1 from jsonb_array_elements(due_j -> 'users') u
                  where u ->> 'user_id' = agent::text
                    and u -> 'paths' ? (agent::text || '/probe-id.jpg')) then
    raise exception 'PROBE_FAIL sec-13: the expired record is not listed with its file: %', due_j;
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  begin
    perform public.destroy_expired_kyc(agent);
    raise exception 'PROBE_FAIL sec-13: a signed-in caller destroyed a retained record';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  res := public.destroy_expired_kyc(agent);
  if (res ->> 'destroyed')::boolean is not true
     or exists (select 1 from public.agent_documents where uploader_id = agent)
     or exists (select 1 from public.agent_applications
                 where user_id = agent and (id_number is not null or full_name is not null or kyc_retain_until is not null))
     or not exists (select 1 from public.audit_log where action = 'account.kyc.destroyed' and entity_id = agent::text) then
    raise exception 'PROBE_FAIL sec-13: the expired record was not destroyed: %', res;
  end if;

  -- 3c. A member cannot schedule the destruction of their own record: the
  -- applicant guard forces kyc_retain_until on insert and on update.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  insert into public.agent_applications (user_id, status, kyc_retain_until)
  values (member, 'DRAFT', now() - interval '1 day') returning id into app_m;
  update public.agent_applications set kyc_retain_until = now() - interval '1 day' where id = app_m;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if (select kyc_retain_until from public.agent_applications where id = app_m) is not null then
    raise exception 'PROBE_FAIL sec-13: a member set kyc_retain_until';
  end if;
  if (public.destroy_expired_kyc(member) ->> 'destroyed')::boolean then
    raise exception 'PROBE_FAIL sec-13: a live member''s record was destroyed';
  end if;

  -- 4. Staff can see that a new account uses an erased mailbox; a member cannot ask.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (again, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probecleansec13@gmail.com', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  select count(*) into n from public.admin_erased_identity_matches() m
   where m.user_id = again and m.erased_user_id = clean;
  if n <> 1 then
    raise exception 'PROBE_FAIL sec-13: staff could not match the new account to the erased mailbox';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  begin
    perform public.admin_erased_identity_matches();
    raise exception 'PROBE_FAIL sec-13: a member read the erased-mailbox matches';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if not exists (select 1 from public.audit_log where action = 'account.erased_identity.matched' and actor_id = admin) then
    raise exception 'PROBE_FAIL sec-13: the staff match was not audited';
  end if;

  -- 5. Delivered emails are pruned after 90 days; failed ones wait for a person.
  insert into public.email_outbox (dedupe_key, template, user_id, status, settled_at)
  values ('probe-sec13-old-' || gen_random_uuid(), 'probe', member, 'SENT', now() - interval '91 days') returning id into o_old;
  insert into public.email_outbox (dedupe_key, template, user_id, status, settled_at)
  values ('probe-sec13-new-' || gen_random_uuid(), 'probe', member, 'SENT', now() - interval '1 day') returning id into o_new;
  insert into public.email_outbox (dedupe_key, template, user_id, status, settled_at)
  values ('probe-sec13-fail-' || gen_random_uuid(), 'probe', member, 'FAILED', now() - interval '400 days') returning id into o_fail;
  perform private.purge_email_outbox();
  if exists (select 1 from public.email_outbox where id = o_old)
     or not exists (select 1 from public.email_outbox where id = o_new)
     or not exists (select 1 from public.email_outbox where id = o_fail) then
    raise exception 'PROBE_FAIL sec-13: the outbox prune did not keep 90 days of delivered mail and every failure';
  end if;

  -- 6. An agents row without an approved or suspended application keeps
  -- nothing: retention keys on the approved application only.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (lone, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe.lone.sec13@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);
  insert into public.agents (user_id, display_name) values (lone, 'Probe Lone');
  insert into public.agent_applications (user_id, status, full_name, id_type, id_number)
  values (lone, 'REJECTED', 'Probe Lone', 'nin', '44444444444');
  insert into public.agent_documents (uploader_id, kind, storage_path) values (lone, 'identity', lone::text || '/id.jpg');
  insert into public.account_deletion_requests (user_id, purge_after) values (lone, now() - interval '1 minute') returning id into req_l;
  res := public.purge_account_rows(req_l);
  if (res ->> 'purged')::boolean is not true or (res -> 'counts' ->> 'kyc_retained')::boolean is not false
     or not (res -> 'storage' ? 'agent-documents')
     or exists (select 1 from public.agent_documents where uploader_id = lone)
     or exists (select 1 from public.agent_applications where user_id = lone and (id_number is not null or kyc_retain_until is not null)) then
    raise exception 'PROBE_FAIL sec-13: an agents row without an approved application was kept: %', res;
  end if;

  raise exception 'PROBE_OK sec-13';
end $$;
