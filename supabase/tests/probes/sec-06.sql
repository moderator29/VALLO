-- SEC-06: a tenant preference by ethnicity, religion, marital status or gender
-- is HELD FOR REVIEW with the reason shown to the lister (review_notes), never
-- refused; ordinary listing copy is untouched. Runs against the live owner
-- write guard (a member cannot publish or edit a live listing), so the member
-- path proved here is DRAFT -> SUBMITTED. Rolls back always.
do $$
declare
  member constant uuid := gen_random_uuid(); -- a throwaway lister, see the 17 October 2026 note below
  admin  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  rec    record;
  agent  uuid;
  held   uuid;
  clean  uuid;
  st     text;
  note   text;
  n      int;
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
  -- A. The detector, positive and negative.
  for rec in select * from (values
    ('No Igbo tenants', true), ('Muslims only', true), ('Christians only please', true),
    ('Married couples only', true), ('No Hausa, no Fulani', true), ('Yoruba only', true),
    ('no bachelors', true), ('Ladies only, shared flat', true), ('Strictly no singles', true),
    ('only married couples', true), ('NO IGBOS', true), ('N0 1gbo', true),
    ('Igbo tenants not allowed', true), ('We prefer Yoruba tenants', true),
    ('Muslim tenants preferred', true), ('Strictly for married couples', true),
    ('no ig' || chr(8203) || 'bo', true), ('Girls only hostel', true),
    ('No Igbo allowed in this compound', true),
    ('Near the mosque', false), ('Close to the church and market', false),
    ('Igbo Efon, Lekki', false), ('No smoking, no pets', false), ('No agency fee', false),
    ('Only 2 units left', false), ('Benin, Edo State, no caution fee', false),
    ('No family land dispute', false), ('Family house, 4 bedrooms', false),
    ('Men''s salon downstairs', false), ('Yoruba-speaking caretaker on site', false),
    ('Muslim prayer room in the estate', false), ('no single room available', false),
    ('Spacious, no boys quarters, 24 hour power', false), ('No boys'' quarters', false),
    ('No ladies bar or club noise', false), ('only ladies hairdresser downstairs', false),
    ('no men allowed in the rooms after 10pm', false), ('no Igbo Efon traffic', false),
    ('perfect for couples', false), ('married couples welcome', false),
    ('singles and couples welcome', false), ('Christian neighbourhood', false),
    ('bachelor pad', false), ('Men only barbershop on the ground floor', false)
  ) as t(txt, want) loop
    if (private.discriminatory_phrase(rec.txt) is not null) <> rec.want then
      raise exception 'PROBE_FAIL sec-06: "%" gave %, expected %',
        rec.txt, private.discriminatory_phrase(rec.txt), rec.want;
    end if;
  end loop;

  -- The member as an ordinary approved agent, inside this transaction only.
  -- 17 October 2026: the QA member now holds a live agents row (one side per
  -- account), so inserting a second one failed on agents_user_id_key before
  -- anything was asserted. The lister is a throwaway account made here, an
  -- ordinary account with no agents row exactly as the QA member was when this
  -- probe was written, rolled back with everything else.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-sec-06-member-' || member || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe Agent')
  returning id into agent;

  -- (RETURNING needs the owner SELECT policy, which cannot see the row being
  -- inserted in the same statement; each row is read back as the owner.)
  clean := gen_random_uuid();
  held  := gen_random_uuid();

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);

  -- CONTROL: ordinary copy, including honest fee wording, is saved as written.
  insert into public.listings (id, agent_id, title, description, property_type, status)
  values (clean, agent, '2 bed flat near the mosque',
          'Quiet street, no boys quarters, 24 hour power. No caution fee before inspection.',
          'apartment', 'DRAFT');

  -- A preference is saved (not refused), stays a DRAFT, and carries the reason.
  insert into public.listings (id, agent_id, title, description, property_type, status)
  values (held, agent, 'Self contain in Surulere', 'No Igbo tenants. Water and light.', 'apartment', 'DRAFT');

  reset role;
  select status::text, review_notes into st, note from public.listings where id = clean;
  if st <> 'DRAFT' or note is not null then
    raise exception 'PROBE_FAIL sec-06: clean listing got status % note %', st, note;
  end if;
  select status::text, review_notes into st, note from public.listings where id = held;
  if st <> 'DRAFT' or note is null or note not like 'Held for review:%no igbo%' then
    raise exception 'PROBE_FAIL sec-06: preference listing got status % note %', st, note;
  end if;

  -- Rewording a draft clears the note the scanner wrote.
  set local role authenticated;
  update public.listings set description = 'Water and light. Everyone welcome.' where id = held;
  reset role;
  select review_notes into note from public.listings where id = held;
  if note is not null then
    raise exception 'PROBE_FAIL sec-06: reworded listing kept note %', note;
  end if;

  -- Submitting it with a preference: SUBMITTED, the note, one alert.
  set local role authenticated;
  update public.listings set description = 'Muslim tenants preferred.', status = 'SUBMITTED' where id = held;
  reset role;
  select status::text, review_notes into st, note from public.listings where id = held;
  if st <> 'SUBMITTED' or note not like 'Held for review:%' then
    raise exception 'PROBE_FAIL sec-06: submitted preference listing got % %', st, note;
  end if;
  select count(*) into n from public.risk_alerts
   where entity_type = 'listing' and entity_id = held::text and status = 'open';
  if n <> 1 then
    raise exception 'PROBE_FAIL sec-06: % open alerts for the held listing', n;
  end if;

  -- An admin, through their own authenticated client, is the reviewer: not
  -- held, and publishing clears the scanner's note.
  -- SCUML item 17 (live 29 Sep): an agent listing is published only on an
  -- approved mandate. It is filed here as the platform files it, outside the
  -- API role, and the admin's publish below is then the real review path.
  reset role;
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id = held and listing_role <> 'owner' and not private.listing_has_live_mandate(id);
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  update public.listings set status = 'PUBLISHED' where id = held;
  reset role;
  select status::text, review_notes into st, note from public.listings where id = held;
  if st <> 'PUBLISHED' or note is not null then
    raise exception 'PROBE_FAIL sec-06: admin publish became % with note %', st, note;
  end if;

  raise exception 'PROBE_OK sec-06';
end $$;
