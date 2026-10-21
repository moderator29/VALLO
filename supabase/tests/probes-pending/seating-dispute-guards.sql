-- SEATING-DISPUTE-GUARDS: staff decide a restaurant and diner disagreement
-- only when they are not a party to the table, and only while it is open.
-- Needs supabase/migrations/20261021104343_seating_dispute_guards.sql applied (it is).
--  1. control: staff who are no party decide an open dispute
--  2. a decided dispute is not decided again
--  3. a table nobody disputed is not overruled
--  4. staff who own the restaurant cannot decide it
--  5. staff who booked the table cannot decide it
-- Everything is rolled back by the final raise.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  staff  constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  biz_other uuid; biz_staff uuid; res1 uuid; res2 uuid; res3 uuid; res4 uuid; r jsonb;
  at timestamptz := now() - interval '1 day';
begin
  insert into public.businesses (owner_id, kind, name, slug, status, source)
  values (member, 'restaurant', 'Probe Dispute Grill', 'probe-dispute-' || gen_random_uuid(), 'PUBLISHED', 'first_party')
  returning id into biz_other;
  insert into public.businesses (owner_id, kind, name, slug, status, source)
  values (staff, 'restaurant', 'Probe Staff Grill', 'probe-dispute-staff-' || gen_random_uuid(), 'PUBLISHED', 'first_party')
  returning id into biz_staff;

  insert into public.reservations (business_id, guest_id, party_size, reserved_for, status)
  values (biz_other, member, 2, at, 'CONFIRMED') returning id into res1;
  insert into public.reservations (business_id, guest_id, party_size, reserved_for, status)
  values (biz_other, member, 2, at + interval '15 minutes', 'CONFIRMED') returning id into res2;
  insert into public.reservations (business_id, guest_id, party_size, reserved_for, status)
  values (biz_staff, member, 2, at, 'CONFIRMED') returning id into res3;
  insert into public.reservations (business_id, guest_id, party_size, reserved_for, status)
  values (biz_other, staff, 2, at + interval '30 minutes', 'CONFIRMED') returning id into res4;

  insert into public.reservation_seatings (reservation_id, business_id, check_in_code, disputed_at)
  values (res1, biz_other, '111111', now()), (res2, biz_other, '222222', null),
         (res3, biz_staff, '333333', now()), (res4, biz_other, '444444', now())
  on conflict (reservation_id) do update set disputed_at = excluded.disputed_at, dispute_resolved_at = null;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);

  -- 1.
  r := public.reservation_resolve_seating(res1, 'SEATED');
  if r ->> 'status' <> 'resolved' then
    raise exception 'PROBE_FAIL seating-dispute-guards 1: staff with no part could not decide an open dispute (%)', r;
  end if;
  -- 2.
  r := public.reservation_resolve_seating(res1, 'NO_SHOW');
  if r ->> 'status' <> 'not_disputed' then
    raise exception 'PROBE_FAIL seating-dispute-guards 2: a decided dispute was decided again (%)', r;
  end if;
  -- 3.
  r := public.reservation_resolve_seating(res2, 'NO_SHOW');
  if r ->> 'status' <> 'not_disputed' then
    raise exception 'PROBE_FAIL seating-dispute-guards 3: an undisputed table was overruled (%)', r;
  end if;
  -- 4.
  r := public.reservation_resolve_seating(res3, 'SEATED');
  if r ->> 'status' <> 'own_table' then
    raise exception 'PROBE_FAIL seating-dispute-guards 4: the owner decided their own restaurant''s table (%)', r;
  end if;
  -- 5.
  r := public.reservation_resolve_seating(res4, 'SEATED');
  if r ->> 'status' <> 'own_table' then
    raise exception 'PROBE_FAIL seating-dispute-guards 5: the diner decided their own table (%)', r;
  end if;

  raise exception 'PROBE_OK seating-dispute-guards';
end $$;
