-- DIRECT-MESSAGES: a member can message any other member from their profile
-- (founder, 9 October 2026). Needs direct_messages_kind and direct_messages_doors.
--  1. start_direct_conversation makes ONE direct chat per pair of people,
--     whoever starts it (the reverse order finds the same chat)
--  2. yourself, a stranger who does not exist, a person who blocked you, and a
--     signed-out caller are all refused; anon cannot call it
--  3. a direct chat names no listing, reservation, booking or business, and the
--     database refuses a second chat for the pair even when inserted directly
--  4. the message notification sends the other person to /messages/<id>, never
--     to the agent desk, in both directions
--  5. twenty new chats a day is the limit (listing, business and direct chats
--     share it), and the twenty-first is refused with 54000
--  6. no cold calls still holds (the caller waits until the other has written);
--     once they have, the call starts and the person rung is sent to the
--     member inbox, not the agent desk
--  7. "Ask me first" (contact_policy REQUEST, the default) holds in the
--     database: a new chat to such a person needs the starter to follow them
--     (trigger conversations_direct_contact_policy, 20261013085121); once the
--     starter follows, the chat opens. B and the twenty limit members say
--     "Anyone can message me" so sections 1 to 6 test their own rule.
-- Switches are set in this transaction only. Everything is rolled back.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  tag text := substr(md5(random()::text), 1, 8);
  cid uuid; cid2 uuid; call_row uuid; n int; href text; msg text; i int; u uuid; ok boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'probe-dm-' || x.k || '-' || tag || '@example.invalid', '{}', '{}', now(), now()
    from (values (a, 'a'), (b, 'b'), (c, 'c')) as x(id, k);
  /* A new account gets its profile from a trigger; "if missing" keeps this true either way. */
  insert into public.social_profiles (user_id, handle)
  select x.id, 'pdm' || x.k || tag from (values (a, 'a'), (b, 'b'), (c, 'c')) as x(id, k)
  on conflict (user_id) do nothing;
  update public.social_profiles set contact_policy = 'OPEN' where user_id in (b, c);

  -- 1 and 2. A opens a chat with B.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  cid := public.start_direct_conversation(b);
  if cid is null then raise exception 'PROBE_FAIL direct-messages 1: no chat was opened'; end if;
  if (select count(*) from public.conversations where id = cid and context_kind = 'direct'
        and guest_id = a and agent_id = b and listing_id is null and business_id is null) <> 1 then
    raise exception 'PROBE_FAIL direct-messages 1: the chat is not a direct chat from A to B';
  end if;
  if public.start_direct_conversation(b) is distinct from cid then
    raise exception 'PROBE_FAIL direct-messages 1: asking twice made a second chat';
  end if;

  ok := false;
  begin perform public.start_direct_conversation(a);
  exception when others then ok := sqlerrm = 'direct:invalid'; end;
  if not ok then raise exception 'PROBE_FAIL direct-messages 2: a member could open a chat with themself'; end if;
  ok := false;
  begin perform public.start_direct_conversation(gen_random_uuid());
  exception when others then ok := sqlerrm = 'direct:not_found'; end;
  if not ok then raise exception 'PROBE_FAIL direct-messages 2: a chat opened with nobody'; end if;

  -- B asks for A and finds the same chat.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  if public.start_direct_conversation(a) is distinct from cid then
    raise exception 'PROBE_FAIL direct-messages 1: the other person got a second chat';
  end if;
  reset role;

  -- 2. A block in either direction refuses the chat; signed out refuses; anon cannot call.
  insert into public.blocks (user_id, other_id) values (c, a);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false;
  begin perform public.start_direct_conversation(c);
  exception when others then ok := sqlerrm = 'direct:blocked'; end;
  reset role;
  if not ok then raise exception 'PROBE_FAIL direct-messages 2: a chat opened across a block'; end if;
  perform set_config('request.jwt.claims', '', true);
  ok := false;
  begin perform public.start_direct_conversation(b);
  exception when others then ok := sqlerrm = 'direct:signed_out'; end;
  if not ok then raise exception 'PROBE_FAIL direct-messages 2: a signed-out caller opened a chat'; end if;
  if has_function_privilege('anon', 'public.start_direct_conversation(uuid)', 'EXECUTE') then
    raise exception 'PROBE_FAIL direct-messages 2: anon can open a direct chat';
  end if;

  -- 3. The shape, and one chat per pair even when inserted by hand.
  ok := false;
  begin
    insert into public.conversations (guest_id, agent_id, context_kind, business_id) values (a, b, 'direct', gen_random_uuid());
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'PROBE_FAIL direct-messages 3: a direct chat was saved with a business on it'; end if;
  ok := false;
  begin
    insert into public.conversations (guest_id, agent_id, context_kind) values (b, a, 'direct');
  exception when unique_violation then ok := true; end;
  if not ok then raise exception 'PROBE_FAIL direct-messages 3: a second direct chat was saved for the same pair'; end if;

  -- 4. The notification goes to the member inbox, both ways.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages (conversation_id, sender_id, body) values (cid, a, 'hello from A');
  reset role;
  select n.href into href from public.notifications n where n.user_id = b and n.kind = 'message' order by n.created_at desc limit 1;
  if href is distinct from '/messages/' || cid::text then
    raise exception 'PROBE_FAIL direct-messages 4: the recipient is sent to % and not the member inbox', href;
  end if;

  -- 6. No cold calls: A cannot ring B before B has written.
  update public.feature_flags set enabled = true where key = 'video_calls';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false;
  begin perform public.call_start(cid, 'AUDIO');
  exception when others then ok := sqlerrm = 'call:not_engaged'; end;
  reset role;
  if not ok then raise exception 'PROBE_FAIL direct-messages 6: a call started before the other person had written'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages (conversation_id, sender_id, body) values (cid, b, 'hello from B');
  reset role;
  select n.href into href from public.notifications n where n.user_id = a and n.kind = 'message' order by n.created_at desc limit 1;
  if href is distinct from '/messages/' || cid::text then
    raise exception 'PROBE_FAIL direct-messages 4: the first person is sent to % and not the member inbox', href;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.call_start(cid, 'AUDIO');
  reset role;
  select id into call_row from public.calls where conversation_id = cid and initiator_id = a;
  if call_row is null then raise exception 'PROBE_FAIL direct-messages 6: the call did not start once the other person had written'; end if;
  if private.call_href(call_row, b, true) is distinct from '/messages/' || cid::text || '?call=' || call_row::text then
    raise exception 'PROBE_FAIL direct-messages 6: the person rung is sent to %', private.call_href(call_row, b, true);
  end if;

  -- 5. Twenty new chats a day: the twenty-first is refused.
  for i in 1..19 loop
    u := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'probe-dm-n' || i || '-' || tag || '@example.invalid', '{}', '{}', now(), now());
    insert into public.social_profiles (user_id, handle) values (u, 'pdmn' || i || tag) on conflict (user_id) do nothing;
    update public.social_profiles set contact_policy = 'OPEN' where user_id = u;
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.start_direct_conversation(u);
    reset role;
  end loop;
  u := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-dm-last-' || tag || '@example.invalid', '{}', '{}', now(), now());
  insert into public.social_profiles (user_id, handle) values (u, 'pdmlast' || tag) on conflict (user_id) do nothing;
  update public.social_profiles set contact_policy = 'OPEN' where user_id = u;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false;
  begin perform public.start_direct_conversation(u);
  exception when program_limit_exceeded then ok := true; end;
  reset role;
  if not ok then raise exception 'PROBE_FAIL direct-messages 5: the twenty-first new chat of the day was not refused'; end if;

  -- 7. Ask me first. C asks first (C's block is on A, not B); B opens
  -- nothing with C until B follows C, by the door or by a hand-written insert.
  update public.social_profiles set contact_policy = 'REQUEST' where user_id = c;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false;
  begin perform public.start_direct_conversation(c);
  exception when others then ok := sqlerrm = 'direct:follow_first'; end;
  reset role;
  if not ok then raise exception 'PROBE_FAIL direct-messages 7: a chat opened with an ask-first member the starter does not follow'; end if;
  set local role authenticated;
  ok := false;
  begin insert into public.conversations (guest_id, agent_id, context_kind) values (b, c, 'direct');
  exception when others then ok := true; end;
  reset role;
  if not ok then raise exception 'PROBE_FAIL direct-messages 7: a hand-written insert got round ask first'; end if;
  insert into public.follows (follower_id, followee_id) values (b, c);
  set local role authenticated;
  cid2 := public.start_direct_conversation(c);
  reset role;
  if cid2 is null then raise exception 'PROBE_FAIL direct-messages 7: following did not open the chat'; end if;

  raise exception 'PROBE_OK direct-messages';
end
$$;
