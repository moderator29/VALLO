-- DB-05 STEP 1, the parts that still hold after step 2. The server files bank
-- and payout accounts (step 2, 20260924070810, and db-05-step2.sql, which
-- proves no client insert at all); here the OWNER's client may still choose
-- the default, but can never set a recipient_code, nor rewrite a payout
-- account's number or name; anon writes neither.
--
-- Rewritten 29 September 2026: this probe built its fixtures with the member's
-- own client insert, which step 2 revoked on purpose, so it failed with
-- "permission denied for table bank_accounts" before asserting anything. The
-- fixtures are now filed as the server files them (service_role).
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
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-db-05-member-' || member || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe DB-05 agent') returning id into agent;

  -- Fixtures, filed by the server.
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

  -- Control: the owner chooses the default.
  update public.bank_accounts set is_default = true where id = bid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-05: bank default rows=%', n; end if;

  -- A recipient chosen by the client is refused.
  begin
    update public.bank_accounts set recipient_code = 'RCP_forged_by_client' where id = bid;
    raise exception 'PROBE_FAIL db-05: client set a recipient_code';
  exception when insufficient_privilege then null; end;

  -- Payout accounts: default only.
  update public.payout_accounts set is_default = true where id = pid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-05: payout default rows=%', n; end if;
  begin
    update public.payout_accounts set account_number = '9876543210' where id = pid;
    raise exception 'PROBE_FAIL db-05: agent rewrote a payout account number';
  exception when insufficient_privilege then null; end;
  begin
    update public.payout_accounts set account_name = 'SOMEBODY ELSE ENTIRELY' where id = pid;
    raise exception 'PROBE_FAIL db-05: agent rewrote a payout account name';
  exception when insufficient_privilege then null; end;
  begin
    update public.payout_accounts set recipient_code = 'RCP_forged_by_client' where id = pid;
    raise exception 'PROBE_FAIL db-05: agent set a payout recipient_code';
  exception when insufficient_privilege then null; end;

  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    insert into public.bank_accounts (user_id, bank_code, bank_name, account_number, resolved_account_name, resolved_at)
    values (member, '058', 'GTBank', '0123456782', 'PROBE HOLDER', now());
    raise exception 'PROBE_FAIL db-05: anon filed a bank account';
  exception when insufficient_privilege then null; end;
  begin
    update public.bank_accounts set is_default = true where id = bid;
    raise exception 'PROBE_FAIL db-05: anon changed a bank account';
  exception when insufficient_privilege then null; end;

  raise exception 'PROBE_OK db-05';
end
$$;
