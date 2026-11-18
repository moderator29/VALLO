-- SEC-09: a member writing straight through PostgREST meets the same kind of
-- limit the server actions apply: the 61st message in ten minutes and the
-- 31st report in an hour are refused (54000); up to the limit every insert
-- lands; the service role is not counted.
--
-- 29 September 2026: the member's real activity counts toward the same
-- windows (public.rate_limits, fixed windows, committed by other writers), so
-- three real messages sent a minute before a run made the "sixty land"
-- control fail. The probe now reads what the member has already used in the
-- current windows (short and daily) and fills exactly the room left, then
-- proves the next insert is refused. now() is fixed for the transaction, so
-- the window cannot turn over mid-probe.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  convo uuid;
  i int;
  refused text;
  room int;

  -- What the member may still insert into a table right now: the smaller of
  -- the short window's and the day's remaining counts.
  function_room constant text := $q$
    select least(
      %1$s - coalesce((select r.count from public.rate_limits r where r.bucket = 'db:' || %3$L and r.subject = %5$L
                         and r.window_start = to_timestamp(floor(extract(epoch from now()) / %2$s) * %2$s)), 0),
      %4$s - coalesce((select r.count from public.rate_limits r where r.bucket = 'db:' || %3$L || ':day' and r.subject = %5$L
                         and r.window_start = to_timestamp(floor(extract(epoch from now()) / 86400) * 86400)), 0))
  $q$;
begin
  -- 16 November 2026: the threads this probe wrote into were on example
  -- listings, which are gone from the live database with the rest of the
  -- example collection. The member's thread is filed here instead, written as
  -- the service writes it (the QA admin as the counterpart, no listing), for
  -- this transaction only. Rolled back; nothing asserted below changes.
  insert into public.conversations (guest_id, agent_id) values (member, '03f3dd52-ea28-4852-9abe-e5b0a67c2a43')
  returning id into convo;
  if convo is null then raise exception 'PROBE_FAIL sec-09: the member has no conversation to write into'; end if;

  execute format(function_room, 60, 600, 'messages', 1000, member::text) into room;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);

  -- CONTROL: every message up to the limit lands (sixty, less what the
  -- member already sent in this window).
  for i in 1..room loop
    insert into public.messages (conversation_id, sender_id, body) values (convo, member, 'probe ' || i);
  end loop;

  -- REFUSAL: the sixty-first.
  refused := null;
  begin
    insert into public.messages (conversation_id, sender_id, body) values (convo, member, 'probe 61');
  exception when others then refused := sqlstate; end;
  if refused is distinct from '54000' then
    raise exception 'PROBE_FAIL sec-09: the 61st message in ten minutes was not refused (%)', coalesce(refused, 'inserted');
  end if;

  -- CONTROL then REFUSAL on reports: up to thirty an hour land, the next is refused.
  reset role;
  execute format(function_room, 30, 3600, 'reports', 100, member::text) into room;
  set local role authenticated;
  for i in 1..room loop
    insert into public.reports (reporter_id, target_type, target_id, reason)
    values (member, 'listing', gen_random_uuid()::text, 'probe');
  end loop;
  refused := null;
  begin
    insert into public.reports (reporter_id, target_type, target_id, reason)
    values (member, 'listing', gen_random_uuid()::text, 'probe');
  exception when others then refused := sqlstate; end;
  if refused is distinct from '54000' then
    raise exception 'PROBE_FAIL sec-09: the 31st report in an hour was not refused (%)', coalesce(refused, 'inserted');
  end if;

  -- CONTROL: the service role is not counted.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  insert into public.messages (conversation_id, sender_id, body) values (convo, member, 'probe by the service');

  raise exception 'PROBE_OK sec-09: members are limited at the table (messages 60/10 min, reports 30/h); the service role is not';
end;
$$;
