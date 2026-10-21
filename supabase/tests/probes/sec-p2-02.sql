-- SEC-P2-02: a member opens a listing thread only as its guest, only with the
-- lister of a published listing, and at most 20 new listing threads a day.
-- Reservation and booking threads, and service-role writes, are unchanged.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  admin_id constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  l_id uuid;
  lister uuid;
  other_listing uuid;
  i int;
  refused text;
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
  -- 17 October 2026: on the live database the example collection's agents row
  -- (e0000000-...-0002) no longer belongs to the example lister but to the QA
  -- member, so no published listing had a lister other than the member or the
  -- admin ("no published listing to test against"). The fixture gives the row
  -- back to the example lister and points twenty example listings at it, kept
  -- published as examples, for this transaction only, so the lister this
  -- probe needs exists again. Nothing asserted below changes. Rolled back.
  update public.agents set user_id = 'e0000000-0000-4000-8000-000000000001'
   where id = 'e0000000-0000-4000-8000-000000000002'
     and user_id is distinct from 'e0000000-0000-4000-8000-000000000001'
     and not exists (select 1 from public.agents x where x.user_id = 'e0000000-0000-4000-8000-000000000001');
  update public.listings set agent_id = 'e0000000-0000-4000-8000-000000000002'
   where id in ('ed000000-0000-4000-8000-000000000001',
                'ed000000-0000-4000-8000-000000000002',
                'ed000000-0000-4000-8000-000000000003',
                'ed000000-0000-4000-8000-000000000004',
                'ed000000-0000-4000-8000-000000000005',
                'ed000000-0000-4000-8000-000000000006',
                'ed000000-0000-4000-8000-000000000007',
                'ed000000-0000-4000-8000-000000000008',
                'ed000000-0000-4000-8000-000000000009',
                'ed000000-0000-4000-8000-000000000010',
                'ed000000-0000-4000-8000-000000000011',
                'ed000000-0000-4000-8000-000000000012',
                'ed000000-0000-4000-8000-000000000013',
                'ed000000-0000-4000-8000-000000000014',
                'ed000000-0000-4000-8000-000000000015',
                'ed000000-0000-4000-8000-000000000016',
                'ed000000-0000-4000-8000-000000000017',
                'ed000000-0000-4000-8000-000000000018',
                'ed000000-0000-4000-8000-000000000019',
                'ed000000-0000-4000-8000-000000000020')
     and agent_id is distinct from 'e0000000-0000-4000-8000-000000000002';
  update public.listings set status = 'PUBLISHED'
   where id in ('ed000000-0000-4000-8000-000000000001',
                'ed000000-0000-4000-8000-000000000002',
                'ed000000-0000-4000-8000-000000000003',
                'ed000000-0000-4000-8000-000000000004',
                'ed000000-0000-4000-8000-000000000005',
                'ed000000-0000-4000-8000-000000000006',
                'ed000000-0000-4000-8000-000000000007',
                'ed000000-0000-4000-8000-000000000008',
                'ed000000-0000-4000-8000-000000000009',
                'ed000000-0000-4000-8000-000000000010',
                'ed000000-0000-4000-8000-000000000011',
                'ed000000-0000-4000-8000-000000000012',
                'ed000000-0000-4000-8000-000000000013',
                'ed000000-0000-4000-8000-000000000014',
                'ed000000-0000-4000-8000-000000000015',
                'ed000000-0000-4000-8000-000000000016',
                'ed000000-0000-4000-8000-000000000017',
                'ed000000-0000-4000-8000-000000000018',
                'ed000000-0000-4000-8000-000000000019',
                'ed000000-0000-4000-8000-000000000020')
     and is_demo and status is distinct from 'PUBLISHED';
  -- A published listing the member has no thread on, and a second published
  -- listing by a different lister (or no second lister: the mismatch then
  -- uses the admin as a counterpart who lists nothing).
  select l.id, a.user_id into l_id, lister
    from public.listings l join public.agents a on a.id = l.agent_id
   where l.status = 'PUBLISHED' and a.user_id not in (member, admin_id)
     and not exists (select 1 from public.conversations c where c.guest_id = member and c.listing_id = l.id)
   limit 1;
  if l_id is null then raise exception 'PROBE_FAIL sec-p2-02: no published listing to test against'; end if;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);

  -- CONTROL: what startConversation writes still succeeds.
  insert into public.conversations (guest_id, agent_id, listing_id) values (member, lister, l_id);

  -- REFUSAL 1: a thread with an arbitrary user and no listing (the audit's T2).
  refused := null;
  begin
    insert into public.conversations (guest_id, agent_id) values (member, admin_id);
  exception when others then refused := sqlstate; end;
  if refused is distinct from '23514' then raise exception 'PROBE_FAIL sec-p2-02: a thread with an arbitrary user and no listing was created (%)', coalesce(refused, 'created'); end if;

  -- REFUSAL 2: a real listing, but the counterpart is not its lister.
  refused := null;
  begin
    insert into public.conversations (guest_id, agent_id, listing_id) values (member, admin_id, l_id);
  exception when others then refused := sqlstate; end;
  if refused is distinct from '23514' then raise exception 'PROBE_FAIL sec-p2-02: a thread on a listing was opened with someone who does not list it (%)', coalesce(refused, 'created'); end if;

  -- REFUSAL 3: the lister cannot open a listing thread on a guest's behalf.
  perform set_config('request.jwt.claims', json_build_object('sub', lister, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  refused := null;
  begin
    insert into public.conversations (guest_id, agent_id, listing_id) values (admin_id, lister, l_id);
  exception when others then refused := sqlstate; end;
  if refused is distinct from '23514' then raise exception 'PROBE_FAIL sec-p2-02: a lister opened a thread in a guest''s name (%)', coalesce(refused, 'created'); end if;

  -- REFUSAL 4: the daily limit. Nineteen more listing threads today (written
  -- as the service would, so they are not themselves checked) make 20; the
  -- 21st, as the member, is refused.
  reset role;
  perform set_config('request.jwt.claims', '', true);
  for i in 1..19 loop
    insert into public.conversations (guest_id, agent_id) values (member, admin_id);
  end loop;
  select l.id into other_listing
    from public.listings l join public.agents a on a.id = l.agent_id
   where l.status = 'PUBLISHED' and a.user_id = lister and l.id <> l_id
     and not exists (select 1 from public.conversations c where c.guest_id = member and c.listing_id = l.id)
   limit 1;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  if other_listing is null then
    raise exception 'PROBE_FAIL sec-p2-02: no second published listing by the same lister, so the daily limit cannot be tested';
  end if;
  refused := null;
  begin
    insert into public.conversations (guest_id, agent_id, listing_id) values (member, lister, other_listing);
  exception when others then refused := sqlstate; end;
  if refused is distinct from '54000' then
    raise exception 'PROBE_FAIL sec-p2-02: the 21st listing thread today was not refused by the daily limit (%)', coalesce(refused, 'created');
  end if;

  raise exception 'PROBE_OK sec-p2-02: listing threads need the published listing''s lister and the caller as guest (23514), and the 21st in a day is refused (54000)';
end;
$$;
