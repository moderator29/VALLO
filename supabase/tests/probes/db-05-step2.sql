-- DB-05 STEP 2 probe. Step 2 was applied on 2026-09-24, after the release deployed,
-- as 20260924070810_db05_step2_bank_and_payout_accounts_are_filed_by_the_server.sql; PROBE_OK against live that day.
-- A member's or agent's own client files no bank or payout account; the
-- service role does; the owner still chooses the default and removes.
do $$
declare
  member constant uuid := gen_random_uuid(); -- a throwaway lister, see the 17 October 2026 note below
  agent uuid;
  bid uuid;
  pid uuid;
  n int;
begin
  -- 17 October 2026: the QA member now holds a live agents row (one side per
  -- account), so inserting a second one failed on agents_user_id_key before
  -- anything was asserted. The lister is a throwaway account made here, an
  -- ordinary account with no agents row exactly as the QA member was when this
  -- probe was written, rolled back with everything else.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-db-05-step2-member-' || member || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe DB-05 agent') returning id into agent;

  -- Control: the server's insert.
  set local role service_role;
  insert into public.bank_accounts (user_id, bank_code, bank_name, account_number, resolved_account_name, resolved_at)
  values (member, '058', 'GTBank', '0123456789', 'PROBE HOLDER', now())
  returning id into bid;
  insert into public.payout_accounts (agent_id, bank_name, bank_code, account_number, account_name)
  values (agent, 'GTBank', '058', '0123456789', 'PROBE HOLDER')
  returning id into pid;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  begin
    insert into public.bank_accounts (user_id, bank_code, bank_name, account_number, resolved_account_name, resolved_at)
    values (member, '058', 'GTBank', '0123456780', 'SOMEBODY ELSE ENTIRELY', now());
    raise exception 'PROBE_FAIL db-05 step 2: client filed a bank account';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.payout_accounts (agent_id, bank_name, bank_code, account_number, account_name)
    values (agent, 'GTBank', '058', '0123456780', 'SOMEBODY ELSE ENTIRELY');
    raise exception 'PROBE_FAIL db-05 step 2: agent filed a payout account';
  exception when insufficient_privilege then null; end;

  update public.bank_accounts set is_default = true where id = bid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-05 step 2: bank default rows=%', n; end if;
  update public.payout_accounts set is_default = true where id = pid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-05 step 2: payout default rows=%', n; end if;
  delete from public.payout_accounts where id = pid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-05 step 2: payout remove rows=%', n; end if;

  raise exception 'PROBE_OK db-05-step2';
end
$$;
