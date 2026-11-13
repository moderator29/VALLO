-- Listing stats, end to end, on the local stub (run.sh first). Expects E2E_OK.
\set ON_ERROR_STOP 1
begin;
do $e2e$
declare
  L constant uuid := '00000000-0000-4000-8000-0000000000f1';
  X constant uuid := '00000000-0000-4000-8000-0000000000f2';
  LISTER constant uuid := '00000000-0000-4000-8000-00000000000a';
  MEMBER constant uuid := '00000000-0000-4000-8000-00000000000b';
  ADMIN constant uuid := '00000000-0000-4000-8000-00000000000c';
  OTHER constant uuid := '00000000-0000-4000-8000-00000000000d';
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v bigint; s integer; n integer; ok boolean;
begin
  /* The backfill: three V-73 opens became lifetime views; the one save is counted. */
  select views, saves into v, s from public.listing_counters where listing_id = L;
  if v <> 3 or s <> 1 then raise exception 'backfill: views % saves %', v, s; end if;

  /* One member, one guest: each counted once a day; the lister, staff and an internal account never. */
  if public.record_listing_view(L, MEMBER, null) is not true then raise exception 'member first open not counted'; end if;
  if public.record_listing_view(L, MEMBER, null) is not false then raise exception 'member counted twice'; end if;
  if public.record_listing_view(L, null, repeat('0', 64)) is not true then raise exception 'guest not counted'; end if;
  if public.record_listing_view(L, null, repeat('0', 64)) is not false then raise exception 'guest counted twice'; end if;
  if public.record_listing_view(L, null, repeat('1', 64)) is not true then raise exception 'second guest not counted'; end if;
  if public.record_listing_view(L, LISTER, null) is not false then raise exception 'lister counted'; end if;
  if public.record_listing_view(L, ADMIN, null) is not false then raise exception 'admin counted'; end if;
  insert into public.internal_accounts values (OTHER);
  if public.record_listing_view(L, OTHER, null) is not false then raise exception 'internal account counted'; end if;
  delete from public.internal_accounts where user_id = OTHER;
  insert into public.staff_grants (user_id, scopes) values (OTHER, '{support}');
  if public.record_listing_view(L, OTHER, null) is not false then raise exception 'staff grant counted'; end if;
  update public.staff_grants set revoked_at = now() where user_id = OTHER;
  if public.record_listing_view(L, X, null) is not false then raise exception 'nonsense viewer id counted'; end if;
  if public.record_listing_view(X, null, repeat('2', 64)) is not false then raise exception 'example counted'; end if;
  if public.record_listing_view(L, null, 'ABC') is not false then raise exception 'bad key counted'; end if;
  if public.record_listing_view(L, null, null) is not false then raise exception 'nobody counted'; end if;
  select opens into n from public.listing_daily_stats where listing_id = L and day = v_today;
  if n <> 3 then raise exception 'today opens %', n; end if;
  select views into v from public.listing_counters where listing_id = L;
  if v <> 6 then raise exception 'lifetime views %', v; end if;

  /* A V-73 style write to the rollup also reaches the lifetime counter. */
  update public.listing_daily_stats set opens = opens + 1 where listing_id = L and day = v_today;
  select views into v from public.listing_counters where listing_id = L;
  if v <> 7 then raise exception 'V-73 path did not reach lifetime views (%)', v; end if;

  /* Saves: public count moves both ways; the day's saves leave staff out. */
  insert into public.saved_items (user_id, listing_id) values (OTHER, L), (ADMIN, L);
  select saves into s from public.listing_counters where listing_id = L;
  if s <> 3 then raise exception 'saves after two saves %', s; end if;
  select saves into n from public.listing_daily_stats where listing_id = L and day = v_today;
  if n <> 1 then raise exception 'day saves counted staff (%)', n; end if;
  delete from public.saved_items where user_id = ADMIN and listing_id = L;
  select saves into s from public.listing_counters where listing_id = L;
  if s <> 2 then raise exception 'saves after unsave %', s; end if;

  /* Enquiries and viewing requests reach their day; staff and examples do not. */
  insert into public.conversations (guest_id, agent_id, listing_id) values (OTHER, '00000000-0000-4000-8000-0000000000a1', L),
    (ADMIN, '00000000-0000-4000-8000-0000000000a1', L), (OTHER, '00000000-0000-4000-8000-0000000000a1', X), (OTHER, '00000000-0000-4000-8000-0000000000a1', null);
  insert into public.inspection_requests (listing_id, requester_id) values (L, OTHER), (X, OTHER);
  select enquiries, viewings into n, s from public.listing_daily_stats where listing_id = L and day = v_today;
  if n <> 1 or s <> 1 then raise exception 'day enquiries % viewings %', n, s; end if;
  if exists (select 1 from public.listing_daily_stats where listing_id = X) then raise exception 'an example reached the rollup'; end if;

  /* A broken counter never refuses a save. */
  alter table public.listing_counters add constraint e2e_break check (saves < 0) not valid;
  insert into public.saved_items (user_id, listing_id) values (LISTER, L);
  alter table public.listing_counters drop constraint e2e_break;
  if not exists (select 1 from public.saved_items where user_id = LISTER and listing_id = L) then raise exception 'save refused by a statistic'; end if;

  /* The public read: anon reads a live listing, nothing for an example. */
  set local role anon;
  select count(*) into n from public.listing_public_stats(L);
  if n <> 1 then raise exception 'anon public read %', n; end if;
  select count(*) into n from public.listing_public_stats(X);
  if n <> 0 then raise exception 'example readable'; end if;
  begin
    perform public.record_listing_view(L, null, repeat('3', 64));
    raise exception 'anon could record';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.listing_counters;
    raise exception 'anon could read the counters';
  exception when insufficient_privilege then null; end;
  reset role;

  /* The lister reads their own, a member reads nothing, and neither reads the desk. */
  perform set_config('request.jwt.claim.sub', LISTER::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', LISTER, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.my_listing_stats();
  if n <> 1 then raise exception 'lister reads % rows (examples must be left out)', n; end if;
  select count(*) into n from public.admin_listing_stats_daily(7, null);
  if n <> 0 then raise exception 'lister read the desk'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub', MEMBER::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', MEMBER, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.my_listing_stats();
  if n <> 0 then raise exception 'member read a lister''s stats'; end if;
  select count(*) into n from public.admin_listing_stats_ranked(30, 'listing', 'views', 10);
  if n <> 0 then raise exception 'member read the ranked desk'; end if;
  reset role;

  /* An admin reads the desk: seven days, zeros included, the right sums. */
  perform set_config('request.jwt.claim.sub', ADMIN::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ADMIN, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*), sum(views), sum(saves) into n, v, s from public.admin_listing_stats_daily(7, null);
  if n <> 7 or v <> 7 or s <> 2 then raise exception 'admin daily rows % views % saves %', n, v, s; end if;
  select count(*) into n from public.admin_listing_stats_daily(90, L);
  if n <> 90 then raise exception 'admin daily for one listing %', n; end if;
  select views into v from public.admin_listing_stats_ranked(30, 'listing', 'views', 10) limit 1;
  if v <> 7 then raise exception 'ranked by listing views %', v; end if;
  select count(*) into n from public.admin_listing_stats_ranked(30, 'area', 'saves', 10);
  if n <> 1 then raise exception 'ranked by area %', n; end if;
  select label into ok from (select label = 'Ada Homes' as label from public.admin_listing_stats_ranked(30, 'lister', 'views', 10)) q;
  if not ok then raise exception 'ranked by lister label'; end if;
  select count(*) into n from public.admin_listing_stats_ranked(30, 'nonsense', 'views', 10);
  if n <> 0 then raise exception 'an unknown grouping answered'; end if;
  select views into v from public.admin_listing_stats_lifetime(L);
  if v <> 7 then raise exception 'lifetime read %', v; end if;
  reset role;

  /* The read-only analyst scope opens the desk; another scope does not. */
  update public.staff_grants set revoked_at = null, scopes = '{analyst}' where user_id = OTHER;
  insert into public.staff_handbook_acks values (OTHER, 'v1');
  perform set_config('request.jwt.claim.sub', OTHER::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', OTHER, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.admin_listing_stats_daily(7, null);
  if n <> 7 then raise exception 'analyst could not read the desk (%)', n; end if;
  reset role;
  update public.staff_grants set scopes = '{support}' where user_id = OTHER;
  set local role authenticated;
  select count(*) into n from public.admin_listing_stats_daily(7, null);
  if n <> 0 then raise exception 'support scope read the desk'; end if;
  reset role;

  /* The server's service role, after the app proved the scope. */
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select count(*) into n from public.admin_listing_stats_daily(30, null);
  if n <> 30 then raise exception 'service role desk read %', n; end if;
  if public.record_listing_view(L, null, repeat('4', 64)) is not true then raise exception 'service role could not record'; end if;
  reset role;

  /* Nothing in the marks is a person: no id and no key in plain. */
  if exists (select 1 from public.listing_view_marks where viewer_hash in (MEMBER::text, repeat('0', 64), 'g:' || repeat('0', 64))) then
    raise exception 'a raw viewer key is stored';
  end if;

  raise notice 'E2E_OK';
end
$e2e$;
rollback;
