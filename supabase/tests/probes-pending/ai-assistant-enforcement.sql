-- AI-ASSISTANT-ENFORCEMENT (Phase 1). Needs the ai_assistant_enforcement migration
-- (docs/PENDING_ai_assistant_enforcement.sql.txt until it is applied and recorded).
--  1. a member starts OFF; a stranger's view of them is empty (row level security)
--  2. activation is refused without both acceptances, on a wrong version, and with a sensitive permission
--  3. activation grants discovery only; the sensitive ones are separate, deliberate grants
--  4. payment help needs a read permission, and goes when its last read permission is taken back
--  5. revoking bumps the grant epoch; deactivating revokes everything and keeps the audit
--  6. no member can write the settings, permissions or audit tables directly, or edit or delete audit rows
--  7. eight refused requests in ten minutes switch the assistant off and raise one alert
--  8. anon cannot call any of the functions
do $$
declare
  m constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  o constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  r jsonb;
  st jsonb;
  e1 int;
  e2 int;
  n int;
  i int;
begin
  -- 8. anon first, before any claim is set
  set local role anon;
  if has_function_privilege('anon', 'public.ai_assistant_state()', 'execute')
     or has_function_privilege('anon', 'public.ai_assistant_can(text)', 'execute')
     or has_function_privilege('anon', 'public.ai_assistant_activate(text,text,boolean,boolean,text[])', 'execute') then
    raise exception 'PROBE_FAIL 8: anon may execute an assistant function';
  end if;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', m), true);

  -- 1. starts OFF
  st := public.ai_assistant_state();
  if (st->>'enabled')::boolean is not false then raise exception 'PROBE_FAIL 1: a new member is not OFF'; end if;
  if public.ai_assistant_can('discovery') then raise exception 'PROBE_FAIL 1: discovery is allowed while OFF'; end if;

  -- 2. refusals
  r := public.ai_assistant_activate('2026-11-01', '2026-11-01', false, true, array['discovery']);
  if (r->>'ok')::boolean or r->>'reason' <> 'terms_not_accepted' then raise exception 'PROBE_FAIL 2a: %', r; end if;
  r := public.ai_assistant_activate('2026-11-01', '2026-11-01', true, false, array['discovery']);
  if (r->>'ok')::boolean then raise exception 'PROBE_FAIL 2b: privacy not accepted but activated'; end if;
  r := public.ai_assistant_activate('1999-01-01', '2026-11-01', true, true, array['discovery']);
  if (r->>'ok')::boolean or r->>'reason' <> 'version_mismatch' then raise exception 'PROBE_FAIL 2c: %', r; end if;
  r := public.ai_assistant_activate('2026-11-01', '2026-11-01', true, true, array['discovery', 'transactions']);
  if (r->>'ok')::boolean or r->>'reason' <> 'permission_not_grantable_here' then raise exception 'PROBE_FAIL 2d: %', r; end if;
  if (public.ai_assistant_state()->>'enabled')::boolean then raise exception 'PROBE_FAIL 2: a refused activation turned it on'; end if;

  -- 3. activation: discovery only
  r := public.ai_assistant_activate('2026-11-01', '2026-11-01', true, true, array['discovery']);
  if not (r->>'ok')::boolean then raise exception 'PROBE_FAIL 3 control: activation refused: %', r; end if;
  if not public.ai_assistant_can('discovery') then raise exception 'PROBE_FAIL 3: discovery not granted'; end if;
  if public.ai_assistant_can('transactions') or public.ai_assistant_can('wallet_balance') or public.ai_assistant_can('payment_assist') then
    raise exception 'PROBE_FAIL 3: a sensitive permission came with activation';
  end if;

  -- 4. payment help needs a read permission first
  r := public.ai_assistant_set_permission('payment_assist', true);
  if (r->>'ok')::boolean then raise exception 'PROBE_FAIL 4a: payment help granted with nothing to rest on'; end if;
  r := public.ai_assistant_set_permission('transactions', true);
  if not (r->>'ok')::boolean then raise exception 'PROBE_FAIL 4 control: %', r; end if;
  r := public.ai_assistant_set_permission('payment_assist', true);
  if not (r->>'ok')::boolean or not public.ai_assistant_can('payment_assist') then raise exception 'PROBE_FAIL 4b: %', r; end if;
  e1 := (public.ai_assistant_state()->>'grant_epoch')::int;
  perform public.ai_assistant_set_permission('transactions', false);
  if public.ai_assistant_can('transactions') or public.ai_assistant_can('payment_assist') then
    raise exception 'PROBE_FAIL 4c: payment help survived losing its last read permission';
  end if;
  e2 := (public.ai_assistant_state()->>'grant_epoch')::int;
  if e2 <= e1 then raise exception 'PROBE_FAIL 5a: revoking did not bump the epoch (% then %)', e1, e2; end if;

  -- 6. no direct writes
  begin
    insert into public.ai_assistant_permissions (user_id, permission) values (m, 'wallet_balance');
    raise exception 'PROBE_FAIL 6a: a member inserted a permission directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.ai_assistant_settings set enabled = true where user_id = m;
    raise exception 'PROBE_FAIL 6b: a member updated settings directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.ai_assistant_audit set outcome = 'ok' where user_id = m;
    raise exception 'PROBE_FAIL 6c: a member edited the audit';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.ai_assistant_audit where user_id = m;
    raise exception 'PROBE_FAIL 6d: a member deleted audit rows';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ai_assistant_audit (user_id, event) values (m, 'forged');
    raise exception 'PROBE_FAIL 6e: a member wrote an audit row directly';
  exception when insufficient_privilege then null; end;

  -- 1b. another member sees none of it
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', o), true);
  select count(*) into n from public.ai_assistant_settings where user_id = m;
  if n <> 0 then raise exception 'PROBE_FAIL 1b: another member can read these settings'; end if;
  select count(*) into n from public.ai_assistant_audit where user_id = m;
  if n <> 0 then raise exception 'PROBE_FAIL 1c: another member can read this audit'; end if;
  if public.ai_assistant_can('discovery') then raise exception 'PROBE_FAIL 1d: another member inherited a permission'; end if;

  -- 5. deactivate revokes everything and keeps the audit
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', m), true);
  e1 := (public.ai_assistant_state()->>'grant_epoch')::int;
  r := public.ai_assistant_deactivate();
  st := public.ai_assistant_state();
  if (st->>'enabled')::boolean or jsonb_array_length(st->'permissions') <> 0 then raise exception 'PROBE_FAIL 5b: permissions survived deactivation: %', st; end if;
  if (st->>'grant_epoch')::int <= e1 then raise exception 'PROBE_FAIL 5c: deactivation did not bump the epoch'; end if;
  if public.ai_assistant_can('discovery') then raise exception 'PROBE_FAIL 5d: discovery survived deactivation'; end if;
  select count(*) into n from public.ai_assistant_audit where user_id = m;
  if n = 0 then raise exception 'PROBE_FAIL 5e: the audit was lost'; end if;
  r := public.ai_assistant_set_permission('transactions', true);
  if (r->>'ok')::boolean then raise exception 'PROBE_FAIL 5f: a permission was granted while OFF'; end if;

  -- 7. eight refusals in ten minutes switch it off
  perform public.ai_assistant_activate('2026-11-01', '2026-11-01', true, true, array['discovery']);
  for i in 1..8 loop
    perform public.ai_assistant_audit_write('tool_denied', 'transactions', 'list_transactions', 'denied', '{}'::jsonb);
  end loop;
  if (public.ai_assistant_state()->>'enabled')::boolean then raise exception 'PROBE_FAIL 7a: eight refusals did not switch it off'; end if;
  reset role;
  select count(*) into n from public.risk_alerts where entity_type = 'ai_assistant' and entity_id = m::text;
  if n <> 1 then raise exception 'PROBE_FAIL 7b: expected one alert, found %', n; end if;

  raise exception 'PROBE_OK ai-assistant-enforcement';
end $$;
