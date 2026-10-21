-- SUP-P2-01: firm_members must be readable through RLS without 42P17: by
-- staff (the admin supply desk's firm roster), by a member (their own row),
-- and by a principal (their firm's roster). A plain member sees nobody
-- else's row. A throwaway account and the QA admin are agents inside the
-- transaction; nothing is left behind.
do $$
declare
  member constant uuid := gen_random_uuid(); -- a throwaway agent, see the 17 October 2026 note below
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  agent uuid;
  principal_agent uuid;
  firm uuid;
  firm2 uuid;
  n int;
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
  -- 17 October 2026: the QA member now holds a live agents row (one side per
  -- account), so inserting a second one failed on agents_user_id_key before
  -- anything was asserted. The staff member is a throwaway account made here,
  -- an ordinary account with no agents row exactly as the QA member was when
  -- this probe was written. The QA admin's own agents row is reused if it has
  -- one: the counts below are per firm, and both firms are made here.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-sup-p2-01-member-' || member || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe SUP-P2-01 staff') returning id into agent;
  select id into principal_agent from public.agents where user_id = admin;
  if principal_agent is null then
    insert into public.agents (user_id, display_name) values (admin, 'Probe SUP-P2-01 principal') returning id into principal_agent;
  end if;
  insert into public.businesses (owner_id, kind, name, slug, status)
  values (admin, 'agency', 'Probe SUP-P2-01 firm', 'probe-sup-p2-01-' || gen_random_uuid(), 'DRAFT') returning id into firm;
  insert into public.firm_members (firm_id, agent_id, member_role, status)
  values (firm, principal_agent, 'principal', 'active'), (firm, agent, 'staff', 'active');
  -- A second firm where the NON-admin member is the principal, so the
  -- principal policy is proved on its own (the admin also passes as staff).
  insert into public.businesses (owner_id, kind, name, slug, status)
  values (member, 'agency', 'Probe SUP-P2-01 firm two', 'probe-sup-p2-01-b-' || gen_random_uuid(), 'DRAFT') returning id into firm2;
  insert into public.firm_members (firm_id, agent_id, member_role, status)
  values (firm2, agent, 'principal', 'active'), (firm2, principal_agent, 'staff', 'active');

  set local role authenticated;

  -- CONTROL: the admin's roster read (lib/admin/reads/supply.ts getFirmRosters).
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  begin
    select count(*) into n from public.firm_members where firm_id = firm;
  exception when others then
    raise exception 'PROBE_FAIL sup-p2-01: admin roster read: % %', sqlstate, sqlerrm;
  end;
  if n <> 2 then raise exception 'PROBE_FAIL sup-p2-01: admin/principal sees rows=% (want 2)', n; end if;

  -- A staff member sees their own row only.
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  begin
    select count(*) into n from public.firm_members where firm_id = firm;
  exception when others then
    raise exception 'PROBE_FAIL sup-p2-01: member read: % %', sqlstate, sqlerrm;
  end;
  if n <> 1 then raise exception 'PROBE_FAIL sup-p2-01: staff member sees rows=% (want 1)', n; end if;
  -- ...and, as a non-admin principal, the whole roster of their own firm.
  select count(*) into n from public.firm_members where firm_id = firm2;
  if n <> 2 then raise exception 'PROBE_FAIL sup-p2-01: non-admin principal sees rows=% (want 2)', n; end if;

  -- A stranger sees none of it.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  select count(*) into n from public.firm_members where firm_id in (firm, firm2);
  if n <> 0 then raise exception 'PROBE_FAIL sup-p2-01: stranger sees rows=%', n; end if;

  raise exception 'PROBE_OK sup-p2-01';
end
$$;
