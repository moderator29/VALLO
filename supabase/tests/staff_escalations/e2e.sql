-- Staff escalations, end to end on the local stub: who may raise, where each
-- category lands, the fallback when a team is empty, the clock, every action
-- and who is told, the append-only timeline, the overdue job and the grants.
-- Ends with E2E_OK, or raises at the first thing that is wrong.
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(p uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', coalesce(p::text, ''), false) $$;
create or replace function pg_temp.told(p uuid) returns int language sql as
  $$ select count(*)::int from public.notices where uid = p $$;
create or replace function pg_temp.mailed(p uuid, p_event text) returns int language sql as
  $$ select count(*)::int from public.outbox where uid = p and template = 'staff.escalation' and payload ->> 'event' = p_event $$;

do $$
declare
  founder uuid := gen_random_uuid();
  coo     uuid := gen_random_uuid();
  fin     uuid := gen_random_uuid();
  fin2    uuid := gen_random_uuid();
  kyc     uuid := gen_random_uuid();
  comp    uuid := gen_random_uuid();
  noack   uuid := gen_random_uuid();
  adm     uuid := gen_random_uuid();
  member  uuid := gen_random_uuid();
  r jsonb; g jsonb; id1 uuid; id2 uuid; id3 uuid; id4 uuid; n int; ts timestamptz;
begin
  insert into auth.users (id) values (founder), (coo), (fin), (fin2), (kyc), (comp), (noack), (adm), (member);
  insert into public.profiles (id, first_name, display_name) values
    (founder, 'Femi', 'Femi Founder'), (coo, 'Chi', 'Chi Coo'), (fin, 'Funke', 'Funke Finance'), (fin2, 'Tolu', null),
    (kyc, 'Kemi', 'Kemi Kyc'), (comp, 'Chidi', 'Chidi Compliance'), (noack, 'Nna', 'Nna Noack'), (adm, 'Ade', 'Ade Admin');
  insert into public.user_roles values (founder, 'super_admin'), (adm, 'admin'), (member, 'user');
  insert into public.staff_grants (user_id, scopes, position) values
    (coo, '{listing_approval,moderation,support,agreements,operations}', 'coo'),
    (fin, '{finance}', 'finance_officer'), (fin2, '{finance,guarantee}', 'finance_officer'),
    (kyc, '{kyc_review}', 'kyc_reviewer'), (comp, '{kyc_review,compliance}', 'compliance_officer'),
    (noack, '{support}', 'support_agent');
  insert into public.staff_handbook_acks (user_id, version) values (coo, 'v1'), (fin, 'v1'), (fin2, 'v1'), (kyc, 'v1'), (comp, 'v1'), (noack, 'v0');

  -- 1. Who may raise.
  perform pg_temp.as_user(member);
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'The payer says the money left their bank.', 'Check the transfer.', '/admin/kyc') ->> 'status' <> 'forbidden' then
    raise exception 'E2E_FAIL a member raised an escalation'; end if;
  perform pg_temp.as_user(noack);
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'The payer says the money left their bank.', 'Check the transfer.', '/admin/support') ->> 'status' <> 'forbidden' then
    raise exception 'E2E_FAIL staff who have not acknowledged the handbook raised one'; end if;
  perform pg_temp.as_user(kyc);
  perform set_config('test.step_up', 'off', false);
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'The payer says the money left their bank.', 'Check the transfer.', '/admin/kyc') ->> 'status' <> 'forbidden' then
    raise exception 'E2E_FAIL a session without the security key raised one'; end if;
  perform set_config('test.step_up', 'on', false);

  -- 2. Bad input is refused, in words the app can map.
  if public.staff_escalation_raise('weather', 'high', 'A payment is stuck', 'The payer says the money left.', 'Check it.', '/admin/kyc') ->> 'status' <> 'invalid_category' then raise exception 'E2E_FAIL category'; end if;
  if public.staff_escalation_raise('money', 'soon', 'A payment is stuck', 'The payer says the money left.', 'Check it.', '/admin/kyc') ->> 'status' <> 'invalid_severity' then raise exception 'E2E_FAIL severity'; end if;
  if public.staff_escalation_raise('money', 'high', 'ab', 'The payer says the money left.', 'Check it.', '/admin/kyc') ->> 'status' <> 'title_length' then raise exception 'E2E_FAIL title'; end if;
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'short', 'Check it.', '/admin/kyc') ->> 'status' <> 'what_happened_length' then raise exception 'E2E_FAIL what happened'; end if;
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'The payer says the money left.', 'no', '/admin/kyc') ->> 'status' <> 'what_is_needed_length' then raise exception 'E2E_FAIL what is needed'; end if;
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'The payer says the money left.', 'Check it.', 'https://evil.example') ->> 'status' <> 'invalid_desk' then raise exception 'E2E_FAIL desk'; end if;
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'The payer says the money left.', 'Check it.', '/admin/kyc', 'https://evil.example/admin/x') ->> 'status' <> 'invalid_record' then raise exception 'E2E_FAIL record off site'; end if;
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'The payer says the money left.', 'Check it.', '/admin/kyc', '/admin/../settings') ->> 'status' <> 'invalid_record' then raise exception 'E2E_FAIL record dots'; end if;
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'The payer says the money left.', 'Check it.', '/admin/kyc', '/administrator') ->> 'status' <> 'invalid_record' then raise exception 'E2E_FAIL record prefix'; end if;
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'The payer says the money left.', 'Check it.', '/admin/kyc', null, null, 'nobody') ->> 'status' <> 'invalid_route' then raise exception 'E2E_FAIL route'; end if;
  -- An ID, bank or card number is linked, never pasted.
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'Their NIN is 12345678901 and it failed.', 'Check it.', '/admin/kyc') ->> 'status' <> 'personal_data' then raise exception 'E2E_FAIL an 11 digit run was accepted'; end if;
  if public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'The payer says the money left.', 'Pay account 0123456789 back.', '/admin/kyc') ->> 'status' <> 'personal_data' then raise exception 'E2E_FAIL a 10 digit run was accepted'; end if;
  if public.staff_escalation_raise('money', 'high', 'Card 4084 0840 8408 4081', 'The payer says the money left.', 'Check it.', '/admin/kyc') ->> 'status' <> 'personal_data' then raise exception 'E2E_FAIL a card number was accepted'; end if;
  if (select count(*) from public.staff_escalations) <> 0 then raise exception 'E2E_FAIL a refused raise left a row'; end if;

  -- 3. Money goes to finance, with a four hour clock; the team is told, in the
  --    app and by email; the super admin is not (it is not urgent).
  r := public.staff_escalation_raise('money', 'high', 'A payment is stuck', 'The payer says the money left their bank on 2026-11-14 and nothing shows.', 'Check the transfer with the partner.', '/admin/kyc', '/admin/kyc?person=abc', 'This page');
  if r ->> 'status' <> 'ok' or r ->> 'routed_to' <> 'finance' or (r ->> 'level')::int <> 0 then raise exception 'E2E_FAIL money route: %', r; end if;
  if r ->> 'reference' !~ '^ESC-[0-9]{6}$' then raise exception 'E2E_FAIL reference: %', r ->> 'reference'; end if;
  id1 := (r ->> 'id')::uuid;
  if abs(extract(epoch from ((r ->> 'due_at')::timestamptz - now())) - 4 * 3600) > 5 then raise exception 'E2E_FAIL the high clock is not four hours'; end if;
  if pg_temp.told(fin) <> 1 or pg_temp.told(fin2) <> 1 or pg_temp.told(founder) <> 0 or pg_temp.told(kyc) <> 0 or pg_temp.told(coo) <> 0 then raise exception 'E2E_FAIL who was told on raise'; end if;
  if pg_temp.mailed(fin, 'raised') <> 1 or pg_temp.mailed(fin2, 'raised') <> 1 then raise exception 'E2E_FAIL the team was not emailed'; end if;
  if (select href from public.notices where uid = fin) <> '/admin/escalations/' || id1::text then raise exception 'E2E_FAIL notice link'; end if;
  if (select count(*) from public.staff_escalation_events where escalation_id = id1 and kind = 'raised' and actor = kyc) <> 1 then raise exception 'E2E_FAIL no raised event'; end if;
  if (select count(*) from public.audit_log where action = 'staff_escalation.raise' and entity_id = id1::text and actor_id = kyc) <> 1 then raise exception 'E2E_FAIL no audit line'; end if;
  if (select metadata::text from public.audit_log where entity_id = id1::text limit 1) like '%money left%' then raise exception 'E2E_FAIL the audit line carries the free text'; end if;

  -- 4. Identity fraud: trust and safety is empty, so compliance; then the COO;
  --    then the super admin. Never an empty team.
  r := public.staff_escalation_raise('identity_fraud', 'normal', 'Two accounts, one face', 'The selfie on this check matches another account.', 'Decide whether to hold both.', '/admin/kyc');
  if r ->> 'routed_to' <> 'compliance' or r ->> 'intended' <> 'trust_safety' then raise exception 'E2E_FAIL identity fallback to compliance: %', r; end if;
  id2 := (r ->> 'id')::uuid;
  if (select detail ->> 'fallback' from public.staff_escalation_events where escalation_id = id2 and kind = 'raised') <> 'true' then raise exception 'E2E_FAIL the fallback is not on the timeline'; end if;
  update public.staff_grants set revoked_at = now() where user_id = comp;
  r := public.staff_escalation_raise('identity_fraud', 'normal', 'Two accounts, one face', 'The selfie on this check matches another account.', 'Decide whether to hold both.', '/admin/kyc');
  if r ->> 'routed_to' <> 'coo' or (r ->> 'level')::int <> 1 then raise exception 'E2E_FAIL identity fallback to the COO: %', r; end if;
  update public.staff_grants set revoked_at = now() where user_id = coo;
  r := public.staff_escalation_raise('safety', 'normal', 'A threat in a chat', 'A member wrote a threat to a lister in a chat.', 'Decide what to do with the account.', '/admin/queue');
  if r ->> 'routed_to' <> 'super_admin' or (r ->> 'level')::int <> 2 then raise exception 'E2E_FAIL fallback to the super admin: %', r; end if;
  update public.staff_grants set revoked_at = null where user_id in (comp, coo);
  -- The only other holder is the raiser: that is an empty team for them.
  update public.staff_grants set revoked_at = now() where user_id = fin2;
  perform pg_temp.as_user(fin);
  r := public.staff_escalation_raise('money', 'low', 'A fee question', 'A lister asks why the fee is higher this month.', 'Tell me what to answer.', '/admin/money');
  if r ->> 'routed_to' <> 'coo' then raise exception 'E2E_FAIL a raiser was routed to their own empty team: %', r; end if;
  update public.staff_grants set revoked_at = null where user_id = fin2;
  -- Policy and staff access.
  r := public.staff_escalation_raise('staff_access', 'low', 'Access for a new hire', 'A new reviewer starts on Monday.', 'Give them listing approval.', '/admin/money');
  if r ->> 'routed_to' <> 'super_admin' then raise exception 'E2E_FAIL staff access route'; end if;
  r := public.staff_escalation_raise('policy_decision', 'low', 'Refund outside the window', 'A member asks for a refund after the window closed.', 'Decide whether we make an exception.', '/admin/money');
  if r ->> 'routed_to' <> 'coo' then raise exception 'E2E_FAIL policy route'; end if;
  -- An explicit route is honoured when the team has people.
  r := public.staff_escalation_raise('other', 'low', 'A document question', 'A document looks edited but passes the check.', 'Look at it with me.', '/admin/money', null, null, 'kyc_review');
  if r ->> 'routed_to' <> 'kyc_review' then raise exception 'E2E_FAIL explicit route'; end if;

  -- 5. Urgent: one hour, and the super admin hears at once.
  perform pg_temp.as_user(kyc);
  n := pg_temp.told(founder);
  r := public.staff_escalation_raise('money', 'urgent', 'Money sent twice', 'A payout looks like it was sent twice to one lister.', 'Stop the second one now.', '/admin/payments');
  id3 := (r ->> 'id')::uuid;
  if abs(extract(epoch from ((r ->> 'due_at')::timestamptz - now())) - 3600) > 5 then raise exception 'E2E_FAIL the urgent clock is not one hour'; end if;
  if pg_temp.told(founder) <> n + 1 or pg_temp.mailed(founder, 'urgent') <> 1 then raise exception 'E2E_FAIL the super admin was not told of an urgent one'; end if;

  -- 6. Lists, counts and who may open one.
  perform pg_temp.as_user(fin);
  r := public.staff_escalation_list('for_me');
  if r ->> 'status' <> 'ok' or not exists (select 1 from jsonb_array_elements(r -> 'rows') x where (x ->> 'id')::uuid = id1 and (x ->> 'waiting_on_me')::boolean) then raise exception 'E2E_FAIL finance does not see what waits on it'; end if;
  if r -> 'rows' -> 0 ->> 'id' <> id3::text then raise exception 'E2E_FAIL the soonest due is not first'; end if;
  if public.staff_escalation_list('all') ->> 'status' <> 'forbidden' then raise exception 'E2E_FAIL a team member read every escalation'; end if;
  if (public.staff_escalation_counts() ->> 'waiting')::int <> 2 then raise exception 'E2E_FAIL finance count: %', public.staff_escalation_counts(); end if;
  if not (public.staff_escalation_counts() -> 'staffed') ? 'finance' or (public.staff_escalation_counts() -> 'staffed') ? 'trust_safety' then raise exception 'E2E_FAIL staffed routes'; end if;
  perform pg_temp.as_user(kyc);
  r := public.staff_escalation_list('mine');
  if jsonb_array_length(r -> 'rows') < 5 or (r -> 'rows' -> 0 ->> 'raised_by_me')::boolean is not true then raise exception 'E2E_FAIL the raiser list'; end if;
  -- Only the document question finance sent to the KYC team waits on them.
  if (public.staff_escalation_counts() ->> 'waiting')::int <> 1 then raise exception 'E2E_FAIL the raiser count: %', public.staff_escalation_counts(); end if;
  perform pg_temp.as_user(adm);
  if jsonb_array_length(public.staff_escalation_list('for_me') -> 'rows') <> 0 then raise exception 'E2E_FAIL the admin role alone is not a team'; end if;
  perform pg_temp.as_user(coo);
  if public.staff_escalation_list('all') ->> 'status' <> 'ok' then raise exception 'E2E_FAIL the COO cannot read all'; end if;
  perform pg_temp.as_user(founder);
  if jsonb_array_length(public.staff_escalation_list('all') -> 'rows') <> (select count(*) from public.staff_escalations) then raise exception 'E2E_FAIL the super admin does not see all'; end if;
  perform pg_temp.as_user(comp);
  if public.staff_escalation_get(id1) ->> 'status' <> 'not_found' then raise exception 'E2E_FAIL another team opened a money escalation'; end if;
  perform pg_temp.as_user(kyc);
  g := public.staff_escalation_get(id1);
  if g ->> 'status' <> 'ok' or (g -> 'viewer' ->> 'is_raiser')::boolean is not true or (g -> 'viewer' ->> 'is_handler')::boolean then raise exception 'E2E_FAIL the raiser view: %', g -> 'viewer'; end if;
  if g -> 'escalation' ->> 'record_url' <> '/admin/kyc?person=abc' or g -> 'escalation' ->> 'raised_by_name' <> 'Kemi Kyc' then raise exception 'E2E_FAIL the record'; end if;

  -- 7. Acknowledge, take it, hand it on, ask, answer.
  if public.staff_escalation_act(id1, 'acknowledge') ->> 'status' <> 'forbidden' then raise exception 'E2E_FAIL the raiser acknowledged their own'; end if;
  if public.staff_escalation_act(id1, 'resolve', 'I am closing my own escalation.') ->> 'status' <> 'forbidden' then raise exception 'E2E_FAIL the raiser resolved their own'; end if;
  perform pg_temp.as_user(fin);
  n := pg_temp.told(kyc);
  if public.staff_escalation_act(id1, 'acknowledge') ->> 'escalation_status' <> 'acknowledged' then raise exception 'E2E_FAIL acknowledge'; end if;
  if pg_temp.told(kyc) <> n + 1 or pg_temp.mailed(kyc, 'acknowledged') <> 1 then raise exception 'E2E_FAIL the raiser was not told of the acknowledgement'; end if;
  if public.staff_escalation_act(id1, 'acknowledge') ->> 'status' <> 'not_open' then raise exception 'E2E_FAIL acknowledged twice'; end if;
  if public.staff_escalation_act(id1, 'assign') ->> 'escalation_status' <> 'in_progress' then raise exception 'E2E_FAIL take it'; end if;
  if public.staff_escalation_act(id1, 'assign') ->> 'status' <> 'already' then raise exception 'E2E_FAIL taken twice'; end if;
  if public.staff_escalation_act(id1, 'assign', null, fin2::text) ->> 'status' <> 'forbidden' then raise exception 'E2E_FAIL a team member assigned a colleague'; end if;
  perform pg_temp.as_user(fin2);
  if exists (select 1 from jsonb_array_elements(public.staff_escalation_list('for_me') -> 'rows') x where (x ->> 'id')::uuid = id1) then raise exception 'E2E_FAIL a taken escalation still waits on the rest of the team'; end if;
  if public.staff_escalation_get(id1) ->> 'status' <> 'ok' then raise exception 'E2E_FAIL the team cannot open a taken escalation'; end if;
  perform pg_temp.as_user(coo);
  if public.staff_escalation_act(id1, 'assign', null, kyc::text) ->> 'status' <> 'invalid_target' then raise exception 'E2E_FAIL given to the raiser'; end if;
  if public.staff_escalation_act(id1, 'assign', null, comp::text) ->> 'status' <> 'invalid_target' then raise exception 'E2E_FAIL given to another team'; end if;
  if public.staff_escalation_act(id1, 'assign', null, 'not-a-person') ->> 'status' <> 'invalid_target' then raise exception 'E2E_FAIL given to nobody'; end if;
  n := pg_temp.told(fin2);
  if public.staff_escalation_act(id1, 'assign', null, fin2::text) ->> 'status' <> 'ok' then raise exception 'E2E_FAIL the COO could not hand it on'; end if;
  if pg_temp.told(fin2) <> n + 1 then raise exception 'E2E_FAIL the new owner was not told'; end if;
  g := public.staff_escalation_get(id1);
  if jsonb_array_length(g -> 'assignable') < 3 or g -> 'escalation' ->> 'assigned_to_name' <> 'Tolu' then raise exception 'E2E_FAIL assignable or the owner name: %', g -> 'assignable'; end if;
  perform pg_temp.as_user(fin2);
  if public.staff_escalation_act(id1, 'comment', 'Call me on 08031234567 about this.') ->> 'status' <> 'personal_data' then raise exception 'E2E_FAIL a number in a note'; end if;
  if public.staff_escalation_act(id1, 'comment', 'I am checking the partner dashboard now.') ->> 'status' <> 'ok' then raise exception 'E2E_FAIL comment'; end if;
  n := pg_temp.told(kyc);
  if public.staff_escalation_act(id1, 'ask_raiser', 'Which bank did the payer use?') ->> 'escalation_status' <> 'waiting_on_raiser' then raise exception 'E2E_FAIL ask'; end if;
  if pg_temp.told(kyc) <> n + 1 or pg_temp.mailed(kyc, 'asked') <> 1 then raise exception 'E2E_FAIL the raiser was not asked'; end if;
  if public.staff_escalation_act(id1, 'raiser_reply', 'It was me.') ->> 'status' <> 'forbidden' then raise exception 'E2E_FAIL somebody else answered for the raiser'; end if;
  perform pg_temp.as_user(kyc);
  if (public.staff_escalation_counts() ->> 'waiting')::int <> 2 then raise exception 'E2E_FAIL a question does not wait on the raiser'; end if;
  n := pg_temp.told(fin2);
  if public.staff_escalation_act(id1, 'raiser_reply', 'The payer used their own bank app.') ->> 'escalation_status' <> 'in_progress' then raise exception 'E2E_FAIL reply'; end if;
  if pg_temp.told(fin2) <> n + 1 or pg_temp.mailed(fin2, 'answered') <> 1 then raise exception 'E2E_FAIL the owner was not told of the answer'; end if;
  if public.staff_escalation_act(id1, 'raiser_reply', 'And again.') ->> 'status' <> 'not_waiting' then raise exception 'E2E_FAIL replied twice'; end if;

  -- 8. Send it to another team, with a reason.
  perform pg_temp.as_user(fin2);
  if public.staff_escalation_act(id1, 'reroute', 'short', 'compliance') ->> 'status' <> 'reason_needed' then raise exception 'E2E_FAIL reroute without a reason'; end if;
  if public.staff_escalation_act(id1, 'reroute', 'This is not a money question.', 'the_moon') ->> 'status' <> 'invalid_route' then raise exception 'E2E_FAIL reroute to nowhere'; end if;
  n := pg_temp.told(comp);
  r := public.staff_escalation_act(id1, 'reroute', 'This is a compliance question, not a money one.', 'compliance');
  if r ->> 'routed_to' <> 'compliance' or r ->> 'escalation_status' <> 'open' then raise exception 'E2E_FAIL reroute: %', r; end if;
  if pg_temp.told(comp) <> n + 1 or pg_temp.mailed(comp, 'rerouted') <> 1 then raise exception 'E2E_FAIL the new team was not told'; end if;
  if (select assigned_to from public.staff_escalations where id = id1) is not null then raise exception 'E2E_FAIL a rerouted escalation kept its old owner'; end if;
  if public.staff_escalation_get(id1) ->> 'status' <> 'not_found' then raise exception 'E2E_FAIL the old team still opens it'; end if;

  -- 9. Resolve with a closing note; the raiser is told; reopen within 14 days.
  perform pg_temp.as_user(comp);
  if public.staff_escalation_act(id1, 'resolve', 'done') ->> 'status' <> 'resolution_needed' then raise exception 'E2E_FAIL resolved without a closing note'; end if;
  n := pg_temp.told(kyc);
  if public.staff_escalation_act(id1, 'resolve', 'The transfer arrived an hour later. Nothing to report.') ->> 'escalation_status' <> 'resolved' then raise exception 'E2E_FAIL resolve'; end if;
  if pg_temp.told(kyc) <> n + 1 or pg_temp.mailed(kyc, 'resolved') <> 1 then raise exception 'E2E_FAIL the raiser was not told the outcome'; end if;
  if (select resolved_by from public.staff_escalations where id = id1) <> comp then raise exception 'E2E_FAIL resolved_by'; end if;
  if public.staff_escalation_act(id1, 'comment', 'One more thing.') ->> 'status' <> 'closed' then raise exception 'E2E_FAIL a note on a closed one'; end if;
  if public.staff_escalation_act(id1, 'reopen', 'I disagree with myself.') ->> 'status' <> 'forbidden' then raise exception 'E2E_FAIL a receiver reopened'; end if;
  perform pg_temp.as_user(kyc);
  if public.staff_escalation_act(id1, 'reopen', 'The payer says it still has not arrived.') ->> 'escalation_status' <> 'open' then raise exception 'E2E_FAIL reopen'; end if;
  if (select resolved_at from public.staff_escalations where id = id1) is not null then raise exception 'E2E_FAIL a reopened one still reads as closed'; end if;
  perform pg_temp.as_user(comp);
  if public.staff_escalation_act(id1, 'decline', 'no') ->> 'status' <> 'reason_needed' then raise exception 'E2E_FAIL declined without a reason'; end if;
  if public.staff_escalation_act(id1, 'decline', 'This belongs with the payment partner, not with us.') ->> 'escalation_status' <> 'declined' then raise exception 'E2E_FAIL decline'; end if;
  if pg_temp.mailed(kyc, 'declined') <> 1 then raise exception 'E2E_FAIL the raiser was not told of the decline'; end if;
  perform pg_temp.as_user(null);
  update public.staff_escalations set resolved_at = now() - interval '15 days' where id = id1;
  perform pg_temp.as_user(kyc);
  if public.staff_escalation_act(id1, 'reopen', 'It is back again after two weeks.') ->> 'status' <> 'too_late' then raise exception 'E2E_FAIL reopened after 14 days'; end if;
  if (select count(*) from public.audit_log where entity_id = id1::text) < 10 then raise exception 'E2E_FAIL the actions are not all in the audit log'; end if;

  -- 10. The timeline cannot be rewritten.
  perform pg_temp.as_user(null);
  begin
    update public.staff_escalation_events set body = 'edited' where escalation_id = id1;
    raise exception 'E2E_FAIL an event was edited';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.staff_escalation_events where escalation_id = id1;
    raise exception 'E2E_FAIL an event was removed';
  exception when sqlstate '55000' then null;
  end;

  -- 11. The overdue job: team to COO to super admin, then a daily reminder.
  perform pg_temp.as_user(kyc);
  if public.staff_escalation_bump_overdue() ->> 'status' <> 'forbidden' then raise exception 'E2E_FAIL a signed-in person ran the overdue job'; end if;
  r := public.staff_escalation_raise('listing', 'normal', 'Same flat listed twice', 'Two listers have the same flat with the same photos.', 'Decide which one stays.', '/admin/kyc');
  id4 := (r ->> 'id')::uuid;
  perform pg_temp.as_user(null);
  -- Nobody holds listing approval but the COO, who holds it as part of the bundle.
  if (select routed_to from public.staff_escalations where id = id4) <> 'listing_approval' then raise exception 'E2E_FAIL listing route'; end if;
  if (public.staff_escalation_bump_overdue() ->> 'bumped')::int <> 0 then raise exception 'E2E_FAIL something not yet due was moved up'; end if;
  update public.staff_escalations set due_at = now() - interval '1 minute' where status in ('open', 'acknowledged', 'in_progress') and id <> id4;
  update public.staff_escalations set due_at = now() - interval '1 minute', assigned_to = coo, status = 'in_progress' where id = id4;
  update public.staff_escalations set due_at = now() + interval '1 day' where id <> id4;
  n := pg_temp.told(coo);
  r := public.staff_escalation_bump_overdue();
  if (r ->> 'bumped')::int <> 1 then raise exception 'E2E_FAIL first bump: %', r; end if;
  select level, due_at into n, ts from public.staff_escalations where id = id4;
  if n <> 1 then raise exception 'E2E_FAIL not at the COO after one bump'; end if;
  if abs(extract(epoch from (ts - now())) - 12 * 3600) > 5 then raise exception 'E2E_FAIL the new window is not half the original'; end if;
  if (select assigned_to from public.staff_escalations where id = id4) is not null then raise exception 'E2E_FAIL an overdue owner kept it'; end if;
  if pg_temp.mailed(coo, 'bumped') <> 1 then raise exception 'E2E_FAIL the COO was not told of the bump'; end if;
  if (public.staff_escalation_bump_overdue() ->> 'bumped')::int <> 0 then raise exception 'E2E_FAIL bumped twice in one window'; end if;
  update public.staff_escalations set due_at = now() - interval '1 minute' where id = id4;
  n := pg_temp.told(founder);
  r := public.staff_escalation_bump_overdue();
  if (r ->> 'bumped')::int <> 1 or (select level from public.staff_escalations where id = id4) <> 2 then raise exception 'E2E_FAIL second bump: %', r; end if;
  if pg_temp.told(founder) <> n + 1 then raise exception 'E2E_FAIL the super admin was not told of the bump'; end if;
  -- At the top: no higher level, one reminder a day.
  update public.staff_escalations set due_at = now() - interval '1 minute' where id = id4;
  r := public.staff_escalation_bump_overdue();
  if (r ->> 'bumped')::int <> 0 or (r ->> 'reminded')::int <> 0 or (select level from public.staff_escalations where id = id4) <> 2 then raise exception 'E2E_FAIL reminded inside a day of the bump: %', r; end if;
  update public.staff_escalations set last_nudged_at = now() - interval '25 hours' where id = id4;
  r := public.staff_escalation_bump_overdue();
  if (r ->> 'reminded')::int <> 1 or pg_temp.mailed(founder, 'reminder') <> 1 then raise exception 'E2E_FAIL the daily reminder: %', r; end if;
  if (public.staff_escalation_bump_overdue() ->> 'reminded')::int <> 0 then raise exception 'E2E_FAIL reminded twice in a day'; end if;
  if (select count(*) from public.staff_escalation_events where escalation_id = id4 and kind = 'bumped' and actor is null) <> 3 then raise exception 'E2E_FAIL the bumps are not on the timeline'; end if;
  -- Urgent halves to thirty minutes, which is under the floor: one hour.
  update public.staff_escalations set due_at = now() - interval '1 minute' where id = id3;
  perform public.staff_escalation_bump_overdue();
  if abs(extract(epoch from ((select due_at from public.staff_escalations where id = id3) - now())) - 3600) > 5 then raise exception 'E2E_FAIL the one hour floor'; end if;
  -- With no COO the team's overdue work goes straight to the super admin.
  update public.staff_grants set revoked_at = now() where user_id = coo;
  update public.staff_escalations set due_at = now() - interval '1 minute', level = 0, last_nudged_at = null where id = id4;
  perform public.staff_escalation_bump_overdue();
  if (select level from public.staff_escalations where id = id4) <> 2 then raise exception 'E2E_FAIL no COO, and it did not reach the super admin'; end if;
  update public.staff_grants set revoked_at = null where user_id = coo;
  -- A question with the raiser is the raiser's clock: reminded, never moved up.
  perform pg_temp.as_user(founder);
  if public.staff_escalation_act(id4, 'ask_raiser', 'Which of the two went live first?') ->> 'status' <> 'ok' then raise exception 'E2E_FAIL the super admin could not ask'; end if;
  perform pg_temp.as_user(null);
  update public.staff_escalations set due_at = now() - interval '1 minute', last_nudged_at = now() - interval '2 days' where id = id4;
  n := pg_temp.told(kyc);
  r := public.staff_escalation_bump_overdue();
  if (r ->> 'nudged')::int <> 1 or (r ->> 'bumped')::int <> 0 or pg_temp.told(kyc) <> n + 1 then raise exception 'E2E_FAIL the raiser reminder: %', r; end if;
  if (select status from public.staff_escalations where id = id4) <> 'waiting_on_raiser' then raise exception 'E2E_FAIL a waiting question changed state'; end if;

  -- 12. A notice that fails never undoes the write it rides on.
  alter table public.notices rename to notices_gone;
  perform pg_temp.as_user(kyc);
  r := public.staff_escalation_raise('technical', 'low', 'A page will not load', 'The payments page shows an error since this morning.', 'Look at the logs.', '/admin/payments');
  if r ->> 'status' <> 'ok' then raise exception 'E2E_FAIL a failed notice refused the raise: %', r; end if;
  alter table public.notices_gone rename to notices;
  -- An account that closes leaves the record standing.
  perform pg_temp.as_user(null);
  delete from public.staff_grants where user_id = kyc;
  delete from auth.users where id = kyc;
  if (select count(*) from public.staff_escalations where id = id1 and raised_by is null) <> 1 then raise exception 'E2E_FAIL a closed account took its escalation with it'; end if;
  if (select count(*) from public.staff_escalation_events where escalation_id = id1 and actor = kyc) < 1 then raise exception 'E2E_FAIL the timeline lost its author'; end if;
  -- The raiser has left: a waiting question goes back to the people who hold it.
  update public.staff_escalations set due_at = now() - interval '1 minute', last_nudged_at = null where id = id4;
  perform public.staff_escalation_bump_overdue();
  if (select status from public.staff_escalations where id = id4) = 'waiting_on_raiser' then raise exception 'E2E_FAIL a question waits on somebody who has left'; end if;
end $$;

-- 13. The grants, as the API roles see them.
do $$
declare
  fin uuid := (select user_id from public.staff_grants where position = 'finance_officer' and scopes = '{finance}');
begin
  perform set_config('request.jwt.claim.sub', fin::text, false);
  set role authenticated;
  begin
    perform 1 from public.staff_escalations limit 1;
    raise exception 'E2E_FAIL a signed-in person read the table directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.staff_escalation_events limit 1;
    raise exception 'E2E_FAIL a signed-in person read the timeline directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.staff_escalation_bump_overdue();
    raise exception 'E2E_FAIL a signed-in person ran the overdue job';
  exception when insufficient_privilege then null;
  end;
  -- The doors themselves work for staff on their own session.
  if public.staff_escalation_counts() ->> 'status' <> 'ok' then raise exception 'E2E_FAIL counts under the authenticated role'; end if;
  if public.staff_escalation_list('for_me') ->> 'status' <> 'ok' then raise exception 'E2E_FAIL list under the authenticated role'; end if;
  if public.staff_escalation_raise('other', 'low', 'A small question', 'I am not sure who decides this one.', 'Point me to the right desk.', '/admin/money') ->> 'status' <> 'ok' then raise exception 'E2E_FAIL raise under the authenticated role'; end if;
  reset role;
  set role anon;
  begin
    perform public.staff_escalation_counts();
    raise exception 'E2E_FAIL anon called a door';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  set role service_role;
  if public.staff_escalation_bump_overdue() ->> 'status' <> 'ok' then raise exception 'E2E_FAIL the service role cannot run the overdue job'; end if;
  reset role;
end $$;

do $$ begin raise notice 'E2E_OK'; end $$;
