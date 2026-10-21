-- NO-SHOW-DISPUTE-SELF-REVIEW (pending migration
-- 20261021104357_no_show_dispute_never_decided_by_a_party.sql): an admin who
-- is a party to a viewing cannot decide the no-show dispute on it, and an
-- admin who is not a party can (the control). Fixture rows are laid down with
-- session_replication_role = replica; everything is rolled back by the final
-- raise.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  admin  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  staffer uuid;
  viewing uuid := gen_random_uuid();
  said text;
begin
  select u.id into staffer from auth.users u where u.id not in (member, admin) order by u.created_at limit 1;
  insert into public.user_roles (user_id, role) values (staffer, 'admin') on conflict do nothing;
  insert into public.user_roles (user_id, role) values (admin, 'admin') on conflict do nothing;

  set local session_replication_role = replica;
  insert into public.inspection_requests (id, listing_id, requester_id, lister_id, requested_at, slot_at, state)
  values (viewing, gen_random_uuid(), member, admin, now() - interval '1 day', now() - interval '1 day', 'CONFIRMED');
  insert into public.inspection_no_shows (inspection_id, reported_by, absent_id, absent_role, disputed_at)
  values (viewing, member, admin, 'lister', now());
  set local session_replication_role = origin;

  -- 1. The admin said to have stayed away cannot decide it.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', admin)::text, true);
  begin
    perform public.resolve_inspection_no_show(viewing, false);
    raise exception 'PROBE_FAIL no-show-dispute-self-review 1: a party decided its own dispute';
  exception when insufficient_privilege then null;
  end;
  reset role;
  if (select resolved_at from public.inspection_no_shows where inspection_id = viewing) is not null then
    raise exception 'PROBE_FAIL no-show-dispute-self-review 1: the dispute moved on a refused decision';
  end if;

  -- CONTROL: an admin who is not a party decides it.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', staffer)::text, true);
  said := public.resolve_inspection_no_show(viewing, true);
  reset role;
  if said is distinct from 'upheld' then
    raise exception 'PROBE_FAIL no-show-dispute-self-review control: % instead of upheld', said;
  end if;

  raise exception 'PROBE_OK no-show-dispute-self-review';
end
$$;
