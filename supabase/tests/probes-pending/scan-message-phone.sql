-- SCAN-MESSAGE-PHONE (migration 20261021104319_scan_message_ignores_phone_numbers, applied):
--  1. CONTROL: a ten-digit account number standing alone is flagged, masked
--  2. an eleven-digit mobile number and a +234 number are not flagged as one
-- Everything is rolled back by the final raise.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  tag text := substr(md5(random()::text), 1, 8);
  cid uuid;
  m1 uuid;
  m2 uuid;
  masked text;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'probe-smp-' || x.k || '-' || tag || '@example.invalid', '{}', '{}', now(), now()
    from (values (a, 'a'), (b, 'b')) as x(id, k);
  insert into public.conversations (guest_id, agent_id, context_kind) values (a, b, 'direct') returning id into cid;

  -- 1. CONTROL.
  insert into public.messages (conversation_id, sender_id, body)
  values (cid, a, 'Pay into 0123456789 today') returning id into m1;
  select f.matched into masked from public.message_flags f where f.message_id = m1 and f.reason = 'account_number';
  if masked is distinct from repeat('•', 6) || '6789' then
    raise exception 'PROBE_FAIL scan-message-phone 1: a standalone account number was flagged as %', coalesce(masked, 'nothing');
  end if;

  -- 2. Phone numbers.
  insert into public.messages (conversation_id, sender_id, body)
  values (cid, a, 'Call me on 08012345678 or +2348012345678') returning id into m2;
  if exists (select 1 from public.message_flags f where f.message_id = m2 and f.reason = 'account_number') then
    raise exception 'PROBE_FAIL scan-message-phone 2: a phone number was flagged as an account number';
  end if;

  raise exception 'PROBE_OK scan-message-phone';
end
$$;
