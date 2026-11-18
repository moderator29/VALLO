-- SEC-05 / STORE-P2-01: the objectionable-content matcher, case by case, and
-- the scanner on every surface a member writes to. Rolls back always.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  admin  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  rec    record;
  got    text;
  area   uuid;
  conv   uuid;
  sid    uuid;
  pid    uuid;
  st     text;
  hr     text;
  n      int;
  refused boolean;
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
  --------------------------------------------------------------------------
  -- A. The matcher. Expected verdict per string: hold / flag / clean.
  --------------------------------------------------------------------------
  for rec in select * from (values
    -- must hold
    ('NIGGER', 'hold'),
    ('n1gger', 'hold'),
    ('n i g g e r', 'hold'),
    ('n.i.g.g.e.r', 'hold'),
    ('Ñyamiri people everywhere', 'hold'),
    ('nyamiri', 'hold'),
    ('chi1d porn', 'hold'),
    ('childporn for sale', 'hold'),
    ('call  girl available', 'hold'),
    ('Please pay to inspect', 'hold'),
    ('whatsapp  me  directly', 'hold'),
    ('whatsapp me directly!!', 'hold'),
    ('lolicon pictures', 'hold'),
    ('I will kill you', 'hold'),
    ('i go kill you', 'hold'),
    ('f4ggot', 'hold'),
    -- zero-width, look-alike letters, stretched letters, trailing symbols
    ('nig' || chr(8203) || 'ger', 'hold'),
    ('n' || chr(1110) || 'gger', 'hold'),
    ('nigg' || chr(1077) || 'r', 'hold'),
    ('c' || chr(1072) || 'll girl', 'hold'),
    ('i will k' || chr(1110) || 'll you', 'hold'),
    ('niiiigger', 'hold'),
    ('nigggger', 'hold'),
    ('kafirrr', 'hold'),
    ('n!gg@', 'hold'),
    -- must only flag (real names, places, idioms, landmarks)
    ('Coon Street', 'flag'),
    ('I will deal with you if you break the tap', 'flag'),
    ('Call me on WhatsApp for inspection', 'flag'),
    ('Paki shop by the junction', 'flag'),
    ('Alhaji Sambo, landlord', 'flag'),
    ('Spic and span, newly painted', 'flag'),
    ('Opposite Western Union, Allen Avenue', 'flag'),
    -- must stay clean
    ('Mrs Loli Adeyemi, landlady', 'clean'),
    ('Scunthorpe road', 'clean'),
    ('Pakistan embassy', 'clean'),
    ('spice market', 'clean'),
    ('raccoon', 'clean'),
    ('Lolita Estate', 'clean'),
    ('Kafiru Street, Kano', 'clean'),
    ('3 bedroom flat, N450,000 per year', 'clean'),
    ('Flat 1B, Block C, Igbo Efon, Lekki', 'clean'),
    ('Wog Estate', 'flag'),
    ('Near the mosque and the church', 'clean'),
    ('Chief Chukwuemeka Okonkwo', 'clean'),
    ('Oluwaseun Adebayo', 'clean'),
    ('Babajide, Garki, Abuja', 'clean'),
    ('Spacious 2 bed in Yaba, 24 hour power', 'clean'),
    ('Hi!! Lovely place', 'clean'),
    ('Book it now!!!', 'clean'),
    ('Sooo good', 'clean'),
    ('abeg make una come check am', 'clean'),
    ('this price go kill you', 'clean'),
    ('G R A Ikeja', 'clean'),
    ('Sabon Gari, Kano', 'clean')
  ) as t(txt, want) loop
    got := (private.content_verdict(rec.txt)).verdict;
    if got is distinct from rec.want then
      raise exception 'PROBE_FAIL sec-05: "%" gave %, expected %', rec.txt, got, rec.want;
    end if;
  end loop;

  select id into area from public.areas where status = 'ACTIVE' limit 1;

  --------------------------------------------------------------------------
  -- B. Surfaces, as the member through the API role.
  --------------------------------------------------------------------------
  -- 16 November 2026: the threads this probe wrote into were on example
  -- listings, which are gone from the live database with the rest of the
  -- example collection. The member's thread for the messages below is filed
  -- here instead, written as the service writes it (the QA admin as the
  -- counterpart, no listing), for this transaction only. Rolled back;
  -- nothing asserted below changes.
  perform set_config('request.jwt.claims', '', true);
  insert into public.conversations (guest_id, agent_id) values (member, '03f3dd52-ea28-4852-9abe-e5b0a67c2a43')
  returning id into conv;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);

  -- CONTROL: a clean post goes live.
  insert into public.posts (author_id, author_kind, body, status)
  values (member, 'USER', 'Lovely evening in Yaba, the new garden is open.', 'LIVE')
  returning id, status::text into pid, st;
  if st <> 'LIVE' then raise exception 'PROBE_FAIL sec-05: clean post was %', st; end if;

  insert into public.posts (author_id, author_kind, body, status)
  values (member, 'USER', 'n i g g e r', 'LIVE') returning status::text into st;
  if st <> 'HELD' then raise exception 'PROBE_FAIL sec-05: spaced slur post was %', st; end if;

  -- Stories and story comments.
  insert into public.stories (author_id, image_path, headline, status)
  values (member, member::text || '/probe.jpg', 'Sunset at Tarkwa Bay', 'LIVE')
  returning id, status::text into sid, st;
  if st <> 'LIVE' then raise exception 'PROBE_FAIL sec-05: clean story was %', st; end if;

  insert into public.stories (author_id, image_path, headline, status)
  values (member, member::text || '/probe2.jpg', 'call girls in Lekki', 'LIVE')
  returning status::text into st;
  if st <> 'HELD' then raise exception 'PROBE_FAIL sec-05: slur story was %', st; end if;

  insert into public.story_comments (story_id, author_id, body, status)
  values (sid, member, 'Beautiful view', 'LIVE') returning status::text into st;
  if st <> 'LIVE' then raise exception 'PROBE_FAIL sec-05: clean comment was %', st; end if;

  insert into public.story_comments (story_id, author_id, body, status)
  values (sid, member, 'you f4ggot', 'LIVE') returning status::text, hold_reason into st, hr;
  if st <> 'HELD' or hr is null then raise exception 'PROBE_FAIL sec-05: slur comment was %', st; end if;

  -- Names: refused for the member (RM004); a real name that used to
  -- over-catch goes through.
  update public.profiles set nickname = 'Loli' where id = member;
  refused := false;
  begin
    update public.profiles set nickname = 'n1gger' where id = member;
  exception when sqlstate 'RM004' then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL sec-05: slur nickname accepted'; end if;

  -- Handles.
  refused := false;
  begin
    update public.social_profiles set handle = 'kike_boss' where user_id = member;
  exception when sqlstate 'RM004' then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL sec-05: slur handle accepted'; end if;

  -- Bio.
  update public.social_profiles set bio = 'call  girl, DM me' where user_id = member
  returning bio_status::text into st;
  if st <> 'HELD' then raise exception 'PROBE_FAIL sec-05: slur bio was %', st; end if;

  -- Messages: delivered, and the desk is told.
  if conv is null then raise exception 'PROBE_FAIL sec-05: the member has no conversation to write in'; end if;
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (conv, member, 'I will kill you') returning id into pid;
    reset role;
    select count(*) into n from public.risk_alerts
     where entity_type = 'message' and entity_id = pid::text;
    if n <> 1 then raise exception 'PROBE_FAIL sec-05: abusive message raised % alerts', n; end if;
  end;

  reset role;

  --------------------------------------------------------------------------
  -- C. Reviews, host replies and events. A review needs a finished booking
  -- and an event needs a thirty-day-old host, neither of which a probe can
  -- make, so the live scanner functions are attached to scratch tables of the
  -- same shape (dropped with the rollback). Reviews and replies have no held
  -- state: refused with RM004. Events hold.
  --------------------------------------------------------------------------
  create temp table probe_reviews (id uuid default gen_random_uuid(), body text) on commit drop;
  create trigger probe_reviews_scan after insert or update on probe_reviews
    for each row execute function private.scan_review();
  insert into probe_reviews (body) values ('Clean, quiet, the landlady Mrs Loli was kind.');
  refused := false;
  begin
    insert into probe_reviews (body) values ('the host is a n1gger');
  exception when sqlstate 'RM004' then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL sec-05: slur review accepted'; end if;
  -- A review warning people about a scam is published, never refused.
  insert into probe_reviews (body) values ('The agent asked for an inspection fee before viewing. No caution fee before inspection here, and we never pay to inspect.');
  insert into probe_reviews (body) values ('Gift card shop next door; use opay or transfer to the landlord.');

  create temp table probe_replies (review_id uuid default gen_random_uuid(), body text) on commit drop;
  create trigger probe_replies_scan after insert or update on probe_replies
    for each row execute function private.scan_review_response();
  insert into probe_replies (body) values ('Thank you, come again.');
  refused := false;
  begin
    insert into probe_replies (body) values ('I will kill you');
  exception when sqlstate 'RM004' then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL sec-05: threatening reply accepted'; end if;
  insert into probe_replies (body) values ('We never ask anyone to pay to inspect.');

  create temp table probe_events (id uuid default gen_random_uuid(), title text, blurb text,
    status text default 'LIVE', hold_reason text) on commit drop;
  create trigger probe_events_scan before insert or update on probe_events
    for each row execute function private.scan_event();
  insert into probe_events (title, blurb) values ('Estate clean-up', 'Saturday morning')
  returning status into st;
  if st <> 'LIVE' then raise exception 'PROBE_FAIL sec-05: clean event was %', st; end if;
  insert into probe_events (title, blurb) values ('Party', 'call girls available')
  returning status into st;
  if st <> 'HELD' then raise exception 'PROBE_FAIL sec-05: slur event was %', st; end if;

  -- A name that arrives from anything but a member's own request (sign-up
  -- metadata through the auth trigger) is not refused, so sign-up cannot
  -- break; the public name becomes "Member" instead.
  update public.profiles set nickname = 'n1gger' where id = member
  returning display_name into st;
  if st <> 'Member' then raise exception 'PROBE_FAIL sec-05: server-side slur name shown as %', st; end if;

  raise exception 'PROBE_OK sec-05';
end $$;
