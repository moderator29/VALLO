-- VC1-VIDEO-CALLS: calls and review calls change state only through their
-- functions, only for the people on them, and only along legal moves.
-- Needs supabase/migrations/pending/vc1_video_calls.sql applied.
--
-- The fixture: a conversation between the QA member (guest) and the QA admin
-- (on the agent side), written as the owner. Both switches are set ON inside
-- this transaction; nothing here reads or asserts the live switch values
-- beyond "the migration seeded a row".
--
--  1. both switches have rows; with video_calls off, call_start refuses
--  2. no direct writes: members hold no INSERT/UPDATE on calls, cannot write a
--     call marker message, and cannot run the private transition or the
--     service-only provider functions; anon cannot start a call
--  3. no cold calls: the callee must have written in the thread
--  4. start rings the callee, notifies them at the agent-side thread with
--     ?call=, and a replayed tap returns the same call
--  5. the caller cannot answer their own call; the callee cannot join before
--     answering; answering twice is the same answer
--  6. provider webhooks are idempotent by event id; joins make it ACTIVE, a
--     leave makes it INTERRUPTED (not ended), a rejoin makes it ACTIVE again,
--     and an out-of-order leave older than the join changes nothing
--  7. hanging up ends it once; the conversation gets exactly one call marker,
--     and no "New message" notification for it
--  8. call_events cannot be edited or deleted, even by the owner
--  9. glare: calling back a person who is ringing you returns their call
-- 10. a ring past 45 s becomes MISSED on the next heartbeat, with a missed-call
--     notification
-- 11. a block refuses a call
-- 12. review calls: a member cannot request one; staff without the console
--     proof cannot either; a request notifies the subject, is audited, cannot
--     ring before the subject accepts, hides staff fields from the subject,
--     rings after acceptance, records attendance and an outcome, and its
--     entries are append-only and invisible to the subject
-- Everything is rolled back by the final raise.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  step_session constant text := '00000000-0000-4000-8000-00000000c0de';
  conv uuid;
  k1 uuid := gen_random_uuid();
  snap jsonb;
  snap2 jsonb;
  call1 uuid;
  call2 uuid;
  room text;
  id_member text;
  id_admin text;
  res jsonb;
  st text;
  n int;
  iv uuid;
  rev jsonb;
  rev_id uuid;
  rcall uuid;
  t0 timestamptz := now();
begin
  -- 1. Seeded rows, and OFF refuses.
  if not exists (select 1 from public.feature_flags where key = 'video_calls')
     or not exists (select 1 from public.feature_flags where key = 'admin_review_calls') then
    raise exception 'PROBE_FAIL vc1-video-calls 1: a switch row is missing';
  end if;
  update public.feature_flags set enabled = false where key in ('video_calls', 'admin_review_calls');

  insert into public.conversations (guest_id, agent_id) values (member, admin) returning id into conv;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  begin
    perform public.call_start(conv, 'VIDEO', null);
    raise exception 'PROBE_FAIL vc1-video-calls 1: call_start ran with video_calls off';
  exception when others then
    if sqlerrm <> 'call:disabled' then raise exception 'PROBE_FAIL vc1-video-calls 1: %', sqlerrm; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.feature_flags set enabled = true where key in ('video_calls', 'admin_review_calls');

  -- 2. Grants.
  if has_table_privilege('authenticated', 'public.calls', 'INSERT')
     or has_table_privilege('authenticated', 'public.calls', 'UPDATE')
     or has_table_privilege('authenticated', 'public.call_participants', 'UPDATE')
     or has_table_privilege('authenticated', 'public.call_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.call_provider_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.call_reviews', 'UPDATE')
     or has_table_privilege('authenticated', 'public.call_review_entries', 'INSERT')
     or has_table_privilege('anon', 'public.calls', 'SELECT') then
    raise exception 'PROBE_FAIL vc1-video-calls 2: an API role can write a call table directly';
  end if;
  if has_function_privilege('authenticated', 'private.call_transition(uuid, text, uuid, text, text, jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.call_provider_event(text, text, text, text, text, timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.call_provider_presence(uuid, text[])', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.calls_sweep_service()', 'EXECUTE')
     or has_function_privilege('anon', 'public.call_start(uuid, text, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.call_join_check(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.call_start(uuid, text, uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.call_provider_event(text, text, text, text, text, timestamptz)', 'EXECUTE') then
    raise exception 'PROBE_FAIL vc1-video-calls 2: a call function has the wrong grant';
  end if;

  -- 3. No cold calls.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  begin
    perform public.call_start(conv, 'VIDEO', null);
    raise exception 'PROBE_FAIL vc1-video-calls 3: a call rang somebody who never wrote in the thread';
  exception when others then
    if sqlerrm <> 'call:not_engaged' then raise exception 'PROBE_FAIL vc1-video-calls 3: %', sqlerrm; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.messages (conversation_id, sender_id, body) values (conv, admin, 'Probe reply from the agent side.');

  -- 4. Start, ring, notify, replay.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  snap := public.call_start(conv, 'VIDEO', k1);
  call1 := (snap ->> 'id')::uuid;
  if snap ->> 'state' <> 'RINGING' or snap ->> 'role' <> 'CALLER' or (snap ->> 'is_initiator')::boolean is not true then
    raise exception 'PROBE_FAIL vc1-video-calls 4: start answered %', snap;
  end if;
  snap2 := public.call_start(conv, 'VIDEO', k1);
  if (snap2 ->> 'id')::uuid <> call1 or coalesce((snap2 ->> 'replayed')::boolean, false) is not true then
    raise exception 'PROBE_FAIL vc1-video-calls 4: a replayed tap made another call';
  end if;
  -- Direct writes, as the member.
  begin
    update public.calls set state = 'ACTIVE' where id = call1;
    raise exception 'PROBE_FAIL vc1-video-calls 2: a member updated a call';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.messages (conversation_id, sender_id, body, call_id) values (conv, member, 'Video call, 9 min', call1);
    raise exception 'PROBE_FAIL vc1-video-calls 2: a member wrote a call marker';
  exception when insufficient_privilege then null;
  end;
  -- The member sees their call through RLS.
  if not exists (select 1 from public.calls where id = call1) then
    raise exception 'PROBE_FAIL vc1-video-calls 4: the caller cannot read their own call';
  end if;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  if not exists (select 1 from public.notifications
                  where user_id = admin and title = 'Incoming video call'
                    and href = '/agent/messages/' || conv::text || '?call=' || call1::text) then
    raise exception 'PROBE_FAIL vc1-video-calls 4: the callee was not notified at their thread';
  end if;
  select provider_room into room from public.calls where id = call1;
  select provider_identity into id_member from public.call_participants where call_id = call1 and user_id = member;
  select provider_identity into id_admin from public.call_participants where call_id = call1 and user_id = admin;
  if room !~ '^vc_[0-9a-f]{32}$' or id_member !~ '^vp_[0-9a-f]{32}$' or position(member::text in room) > 0 then
    raise exception 'PROBE_FAIL vc1-video-calls 4: room % / identity % are not opaque', room, id_member;
  end if;

  -- 5. Who may answer and join.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  begin
    perform public.call_accept(call1);
    raise exception 'PROBE_FAIL vc1-video-calls 5: the caller answered their own call';
  exception when others then
    if sqlerrm <> 'call:not_yours_to_answer' then raise exception 'PROBE_FAIL vc1-video-calls 5: %', sqlerrm; end if;
  end;
  res := public.call_join_check(call1);
  if res ->> 'room' <> room or res ->> 'identity' <> id_member or res ->> 'state' <> 'RINGING' then
    raise exception 'PROBE_FAIL vc1-video-calls 5: the caller join answered %', res;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  begin
    perform public.call_join_check(call1);
    raise exception 'PROBE_FAIL vc1-video-calls 5: the callee got a join before answering';
  exception when others then
    if sqlerrm <> 'call:not_joinable' then raise exception 'PROBE_FAIL vc1-video-calls 5: %', sqlerrm; end if;
  end;
  snap := public.call_accept(call1);
  snap2 := public.call_accept(call1);
  if snap ->> 'state' <> 'ACCEPTED' or snap2 ->> 'state' <> 'ACCEPTED' then
    raise exception 'PROBE_FAIL vc1-video-calls 5: accept answered % then %', snap ->> 'state', snap2 ->> 'state';
  end if;
  res := public.call_join_check(call1);
  if res ->> 'state' <> 'CONNECTING' or res ->> 'identity' <> id_admin then
    raise exception 'PROBE_FAIL vc1-video-calls 5: the callee join answered %', res;
  end if;

  -- 6. Provider facts, as the service role.
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  res := public.call_provider_event('livekit', 'probe-ev-1', 'participant_joined', room, id_member, t0);
  if coalesce((res ->> 'duplicate')::boolean, true) then raise exception 'PROBE_FAIL vc1-video-calls 6: first event %', res; end if;
  res := public.call_provider_event('livekit', 'probe-ev-1', 'participant_joined', room, id_member, t0);
  if not coalesce((res ->> 'duplicate')::boolean, false) then raise exception 'PROBE_FAIL vc1-video-calls 6: a replayed webhook was applied'; end if;
  res := public.call_provider_event('livekit', 'probe-ev-2', 'participant_joined', room, id_admin, t0 + interval '1 second');
  select state into st from public.calls where id = call1;
  if st <> 'ACTIVE' then raise exception 'PROBE_FAIL vc1-video-calls 6: both joined and the call is %', st; end if;
  perform public.call_provider_event('livekit', 'probe-ev-3', 'participant_left', room, id_admin, t0 + interval '5 seconds');
  select state into st from public.calls where id = call1;
  if st <> 'INTERRUPTED' then raise exception 'PROBE_FAIL vc1-video-calls 6: a drop made the call %, not INTERRUPTED', st; end if;
  perform public.call_provider_event('livekit', 'probe-ev-4', 'participant_joined', room, id_admin, t0 + interval '8 seconds');
  res := public.call_provider_event('livekit', 'probe-ev-5', 'participant_left', room, id_admin, t0 + interval '6 seconds');
  select state into st from public.calls where id = call1;
  if st <> 'ACTIVE' or res ->> 'outcome' <> 'stale'
     or (select reconnect_count from public.calls where id = call1) <> 1 then
    raise exception 'PROBE_FAIL vc1-video-calls 6: after a rejoin and a stale leave the call is % (%)', st, res;
  end if;

  -- 7. Hang up, once; one marker; no "New message" for it.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  snap := public.call_end(call1);
  snap2 := public.call_end(call1);
  if snap ->> 'state' <> 'ENDED' or snap2 ->> 'state' <> 'ENDED' or snap ->> 'end_reason' <> 'hangup' then
    raise exception 'PROBE_FAIL vc1-video-calls 7: hang up answered % then %', snap, snap2 ->> 'state';
  end if;
  if (select count(*) from public.messages where call_id = call1) <> 1 then
    raise exception 'PROBE_FAIL vc1-video-calls 7: the thread does not hold exactly one marker';
  end if;
  if (select body from public.messages where call_id = call1) !~ '^Video call, ([0-9]+ min )?[0-9]+ s$' then
    raise exception 'PROBE_FAIL vc1-video-calls 7: the marker reads %', (select body from public.messages where call_id = call1);
  end if;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  if exists (select 1 from public.notifications n join public.messages m on m.call_id = call1
              where n.user_id = admin and n.title = 'New message' and n.body = m.body) then
    raise exception 'PROBE_FAIL vc1-video-calls 7: the call marker raised a New message notification';
  end if;
  if (select count(*) from public.call_events where call_id = call1 and event like 'state.%') < 4 then
    raise exception 'PROBE_FAIL vc1-video-calls 7: the transitions were not recorded';
  end if;

  -- 8. Append-only, even for the owner.
  begin
    update public.call_events set event = 'state.rewritten' where call_id = call1;
    raise exception 'PROBE_FAIL vc1-video-calls 8: a call event was edited';
  exception when others then
    if sqlerrm <> 'call:append_only' then raise exception 'PROBE_FAIL vc1-video-calls 8: %', sqlerrm; end if;
  end;
  begin
    delete from public.call_events where call_id = call1;
    raise exception 'PROBE_FAIL vc1-video-calls 8: a call event was deleted';
  exception when others then
    if sqlerrm <> 'call:append_only' then raise exception 'PROBE_FAIL vc1-video-calls 8: %', sqlerrm; end if;
  end;

  -- 9. Glare.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  snap := public.call_start(conv, 'AUDIO', null);
  call2 := (snap ->> 'id')::uuid;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  snap2 := public.call_start(conv, 'AUDIO', null);
  if (snap2 ->> 'id')::uuid <> call2 or coalesce((snap2 ->> 'glare')::boolean, false) is not true then
    raise exception 'PROBE_FAIL vc1-video-calls 9: calling back a ringing caller made a second call';
  end if;

  -- 10. The ring runs out.
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.calls set ring_expires_at = now() - interval '1 second' where id = call2;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  snap := public.call_heartbeat(call2);
  if snap ->> 'state' <> 'MISSED' or snap ->> 'end_reason' <> 'no_answer' then
    raise exception 'PROBE_FAIL vc1-video-calls 10: an unanswered ring is %', snap ->> 'state';
  end if;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  if not exists (select 1 from public.notifications where user_id = admin and title like 'Missed voice call%') then
    raise exception 'PROBE_FAIL vc1-video-calls 10: no missed-call notification';
  end if;

  -- 11. A block holds.
  insert into public.blocks (user_id, other_id) values (admin, member);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  begin
    perform public.call_start(conv, 'VIDEO', null);
    raise exception 'PROBE_FAIL vc1-video-calls 11: a blocked person rang through';
  exception when others then
    if sqlerrm <> 'call:blocked' then raise exception 'PROBE_FAIL vc1-video-calls 11: %', sqlerrm; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  delete from public.blocks where user_id = admin and other_id = member;

  -- 12. Review calls.
  insert into public.identity_verifications (subject_id, method, outcome) values (member, 'photo', 'mismatch') returning id into iv;
  insert into public.console_step_ups (user_id, session_id, expires_at)
  values (admin, step_session::uuid, now() + interval '1 hour')
  on conflict (user_id, session_id) do update set expires_at = excluded.expires_at;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  begin
    perform public.call_review_request('identity_verification', iv, 'A member asking for a review call', 'VIDEO', null);
    raise exception 'PROBE_FAIL vc1-video-calls 12: a member requested a review call';
  exception when others then
    if sqlerrm <> 'review:forbidden' then raise exception 'PROBE_FAIL vc1-video-calls 12: %', sqlerrm; end if;
  end;
  -- Staff without this session's console proof.
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  begin
    perform public.call_review_request('identity_verification', iv, 'Confirm the photo matches the person', 'VIDEO', null);
    raise exception 'PROBE_FAIL vc1-video-calls 12: staff without the console proof requested a review call';
  exception when others then
    if sqlerrm <> 'review:forbidden' then raise exception 'PROBE_FAIL vc1-video-calls 12: %', sqlerrm; end if;
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin, 'role', 'authenticated', 'session_id', step_session)::text, true);
  rev := public.call_review_request('identity_verification', iv, 'Confirm the photo matches the person', 'VIDEO', null);
  rev_id := (rev ->> 'id')::uuid;
  if rev ->> 'status' <> 'REQUESTED' or (rev ->> 'subject_id')::uuid <> member or rev ->> 'required_scope' <> 'kyc_review' then
    raise exception 'PROBE_FAIL vc1-video-calls 12: request answered %', rev;
  end if;
  begin
    perform public.call_review_start(rev_id);
    raise exception 'PROBE_FAIL vc1-video-calls 12: a review call rang before the subject accepted';
  exception when others then
    if sqlerrm <> 'review:not_accepted' then raise exception 'PROBE_FAIL vc1-video-calls 12: %', sqlerrm; end if;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.call_reviews where id = rev_id) then
    raise exception 'PROBE_FAIL vc1-video-calls 12: the subject can read the staff review row';
  end if;
  res := public.my_call_reviews();
  if jsonb_array_length(res) < 1 or (res -> 0) ? 'required_scope' or (res -> 0) ? 'requested_by'
     or (res -> 0) ->> 'requester_label' <> 'Vallo review team' then
    raise exception 'PROBE_FAIL vc1-video-calls 12: the subject view is %', res -> 0;
  end if;
  res := public.call_review_respond(rev_id, 'ACCEPT', null);
  if res ->> 'status' <> 'ACCEPTED' then raise exception 'PROBE_FAIL vc1-video-calls 12: accept answered %', res; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', admin, 'role', 'authenticated', 'session_id', step_session)::text, true);
  snap := public.call_review_start(rev_id);
  rcall := (snap ->> 'id')::uuid;
  if snap ->> 'state' <> 'RINGING' or snap ->> 'purpose' <> 'ADMIN_REVIEW' or snap ->> 'role' <> 'REVIEWER' then
    raise exception 'PROBE_FAIL vc1-video-calls 12: start answered %', snap;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  snap := public.call_accept(rcall);
  if snap ->> 'other_name' <> 'Vallo review team' then
    raise exception 'PROBE_FAIL vc1-video-calls 12: the subject sees the reviewer as %', snap ->> 'other_name';
  end if;
  res := public.call_join_check(rcall);
  if res ->> 'role' <> 'SUBJECT' then raise exception 'PROBE_FAIL vc1-video-calls 12: subject join %', res; end if;
  perform public.call_end(rcall);
  if exists (select 1 from public.call_review_entries where review_id = rev_id) then
    raise exception 'PROBE_FAIL vc1-video-calls 12: the subject can read review entries';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', admin, 'role', 'authenticated', 'session_id', step_session)::text, true);
  perform public.call_review_add_entry(rev_id, 'NOTE', 'Photo matches the person on the call.', null, null);
  begin
    perform public.call_review_complete(rev_id, 'FOLLOW_UP_REQUIRED', 'Needs a document.', null);
    raise exception 'PROBE_FAIL vc1-video-calls 12: a follow-up outcome was recorded without a date';
  exception when others then
    if sqlerrm <> 'review:follow_up_date_required' then raise exception 'PROBE_FAIL vc1-video-calls 12: %', sqlerrm; end if;
  end;
  rev := public.call_review_complete(rev_id, 'REVIEW_COMPLETED', 'Spoke on video; nothing further.', null);
  if rev ->> 'status' <> 'COMPLETED' or rev ->> 'outcome' <> 'REVIEW_COMPLETED' then
    raise exception 'PROBE_FAIL vc1-video-calls 12: complete answered %', rev;
  end if;
  select count(*) into n from public.call_review_entries where review_id = rev_id;
  if n < 3 then raise exception 'PROBE_FAIL vc1-video-calls 12: % review entries, expected attendance, note and outcome', n; end if;

  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  if (select count(*) from public.audit_log where entity_type = 'call_review' and entity_id = rev_id::text) < 4 then
    raise exception 'PROBE_FAIL vc1-video-calls 12: the review trail is incomplete';
  end if;
  begin
    update public.call_review_entries set body = 'rewritten' where review_id = rev_id;
    raise exception 'PROBE_FAIL vc1-video-calls 12: a review entry was edited';
  exception when others then
    if sqlerrm <> 'call:append_only' then raise exception 'PROBE_FAIL vc1-video-calls 12: %', sqlerrm; end if;
  end;

  raise exception 'PROBE_OK vc1-video-calls';
end;
$$;
