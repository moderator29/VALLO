/*
 * LISTING SHARES, AND EXAMPLE LISTINGS COUNTED (founder, 14 November 2026:
 * "the views count in listings and shares count ... you didn't design the
 * frontend I didn't see it").
 *
 * WHY HE SAW NOTHING. Read from live on 14 November 2026: 64 published
 * listings, all 64 examples. listing_stats_2026-11-13.sql (applied) counts
 * and answers real listings only, so no card and no listing page had a figure
 * to draw. listing_counters held 43 rows, every one with 0 views.
 *
 * WHAT THIS FILE CHANGES (read against live first; every name below exists
 * there as written):
 *
 *   1. public.listing_counters.shares and public.listing_daily_stats.shares,
 *      both integer, default 0.
 *   2. public.listing_view_marks_kind_check allows 's' (a share) beside
 *      'i' and 'o', so a share is once per person per listing per Lagos day
 *      by the same primary key and the same daily salt as a view, and is
 *      purged by the same hourly job (private.purge_view_marks).
 *   3. public.record_listing_view no longer turns an example away. Nothing
 *      else in it changes. The Analytics desk still leaves examples out: its
 *      three functions join real listings only and are not touched here.
 *   4. public.record_listing_share: new. Same guards as a view (a real
 *      account or a well formed guest key; not staff, not an internal
 *      account, not the lister; a published listing). Service role only.
 *   5. public.listing_public_stats and public.listing_public_stats_many now
 *      answer an example too and return shares. Their result type changes,
 *      so they are dropped and created again inside this transaction; the
 *      grants are restored (anon, authenticated, service_role). The app
 *      reads views and saves by name and treats a missing shares as "not
 *      known", so the app works before and after this file.
 *
 * NOT CHANGED: my_listing_stats, the admin functions, the triggers, the
 * purge. No row is deleted. No figure is invented: every count starts from
 * what the table already holds, and shares start at 0.
 *
 * Safe to run twice. One transaction: a failed read-back undoes all of it.
 * Run listing_stats_2026-11-13.sql first (it is applied on live).
 */

begin;

do $$
begin
  if to_regclass('public.listing_counters') is null
     or to_regclass('public.listing_daily_stats') is null
     or to_regclass('public.listing_view_marks') is null
     or to_regprocedure('public.record_listing_view(uuid,uuid,text)') is null then
    raise exception 'listing shares: listing_stats_2026-11-13.sql is not applied here; run it first';
  end if;
end;
$$;

/* ------------------------------------------------------------ 1. columns */

alter table public.listing_counters
  add column if not exists shares integer not null default 0 check (shares >= 0);
alter table public.listing_daily_stats
  add column if not exists shares integer not null default 0 check (shares >= 0);

comment on column public.listing_counters.shares is
  'Listing stats (14 Nov 2026): lifetime shares of this listing, one per person per Lagos day, written by record_listing_share.';

/* --------------------------------------------------- 2. the mark for a share */

alter table public.listing_view_marks drop constraint if exists listing_view_marks_kind_check;
alter table public.listing_view_marks
  add constraint listing_view_marks_kind_check check (kind in ('i', 'o', 's'));

/* ------------------------------------------ 3. a view of an example counts */

create or replace function public.record_listing_view(p_listing uuid, p_viewer uuid default null, p_guest text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_salt bytea;
  v_who text;
  v_target uuid;
  v_inserted integer;
begin
  if p_listing is null then
    return false;
  end if;
  if p_viewer is null and (p_guest is null or p_guest !~ '^[0-9a-f]{64}$') then
    return false;
  end if;
  /* A member is a real account; staff and internal accounts reading the
     catalogue are not viewers. */
  if p_viewer is not null and (
       not exists (select 1 from auth.users u where u.id = p_viewer)
       or private.listing_stats_internal(p_viewer)) then
    return false;
  end if;

  /* Published, and not the viewer's own. An example is counted too
     (14 November 2026): the people opening it are real. */
  select l.id into v_target
    from public.listings l
    join public.agents a on a.id = l.agent_id
    left join public.agents aa on aa.id = l.assigned_agent_id
   where l.id = p_listing
     and l.status = 'PUBLISHED'
     and (p_viewer is null or (a.user_id is distinct from p_viewer and aa.user_id is distinct from p_viewer));
  if v_target is null then
    return false;
  end if;

  insert into private.listing_view_salts (day, salt) values (v_today, extensions.gen_random_bytes(32))
  on conflict (day) do nothing;
  select vs.salt into v_salt from private.listing_view_salts vs where vs.day = v_today;
  v_who := encode(
    extensions.hmac(
      convert_to(case when p_viewer is not null then p_viewer::text else 'g:' || p_guest end, 'UTF8'),
      v_salt,
      'sha256'),
    'hex');

  insert into public.listing_view_marks (listing_id, day, kind, viewer_hash)
  values (v_target, v_today, 'o', v_who)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  insert into public.listing_daily_stats (listing_id, day, opens)
  values (v_target, v_today, 1)
  on conflict (listing_id, day) do update
    set opens = public.listing_daily_stats.opens + 1;
  return true;
end;
$$;

comment on function public.record_listing_view(uuid, uuid, text) is
  'Listing stats (13 Nov 2026): one open of one published listing (examples included since 14 Nov 2026) by a member (id) or a guest (a 64-hex key the server derives, never an address), counted once per viewer per listing per Lagos day under the V-73 daily salt. Staff, internal accounts and the lister are not counted. Service role only.';

revoke execute on function public.record_listing_view(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_listing_view(uuid, uuid, text) to service_role;

/* --------------------------------------------------------------- 4. a share */

create or replace function public.record_listing_share(p_listing uuid, p_viewer uuid default null, p_guest text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_salt bytea;
  v_who text;
  v_target uuid;
  v_inserted integer;
begin
  if p_listing is null then
    return false;
  end if;
  if p_viewer is null and (p_guest is null or p_guest !~ '^[0-9a-f]{64}$') then
    return false;
  end if;
  /* A member is a real account; staff and internal accounts reading the
     catalogue are not viewers. */
  if p_viewer is not null and (
       not exists (select 1 from auth.users u where u.id = p_viewer)
       or private.listing_stats_internal(p_viewer)) then
    return false;
  end if;

  /* Published, and not the sharer's own. */
  select l.id into v_target
    from public.listings l
    join public.agents a on a.id = l.agent_id
    left join public.agents aa on aa.id = l.assigned_agent_id
   where l.id = p_listing
     and l.status = 'PUBLISHED'
     and (p_viewer is null or (a.user_id is distinct from p_viewer and aa.user_id is distinct from p_viewer));
  if v_target is null then
    return false;
  end if;

  insert into private.listing_view_salts (day, salt) values (v_today, extensions.gen_random_bytes(32))
  on conflict (day) do nothing;
  select vs.salt into v_salt from private.listing_view_salts vs where vs.day = v_today;
  v_who := encode(
    extensions.hmac(
      convert_to(case when p_viewer is not null then p_viewer::text else 'g:' || p_guest end, 'UTF8'),
      v_salt,
      'sha256'),
    'hex');

  insert into public.listing_view_marks (listing_id, day, kind, viewer_hash)
  values (v_target, v_today, 's', v_who)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  insert into public.listing_daily_stats (listing_id, day, shares)
  values (v_target, v_today, 1)
  on conflict (listing_id, day) do update
    set shares = public.listing_daily_stats.shares + 1;
  insert into public.listing_counters (listing_id, shares)
  values (v_target, 1)
  on conflict (listing_id) do update
    set shares = public.listing_counters.shares + 1,
        updated_at = now();
  return true;
end;
$$;

comment on function public.record_listing_share(uuid, uuid, text) is
  'Listing stats (14 Nov 2026): one share of one published listing by a member (id) or a guest (a 64-hex key the server derives, never an address), counted once per person per listing per Lagos day under the V-73 daily salt, as mark kind s. Staff, internal accounts and the lister are not counted. Service role only.';

revoke execute on function public.record_listing_share(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_listing_share(uuid, uuid, text) to service_role;

/* ------------------------------------------------------------- 5. the reads */

drop function if exists public.listing_public_stats(uuid);
create function public.listing_public_stats(p_listing uuid)
returns table (views bigint, saves integer, shares integer)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(c.views, 0)::bigint, coalesce(c.saves, 0)::integer, coalesce(c.shares, 0)::integer
    from public.listings l
    left join public.listing_counters c on c.listing_id = l.id
   where l.id = p_listing
     and l.status = 'PUBLISHED';
$$;
revoke execute on function public.listing_public_stats(uuid) from public;
grant execute on function public.listing_public_stats(uuid) to anon, authenticated, service_role;

drop function if exists public.listing_public_stats_many(uuid[]);
create function public.listing_public_stats_many(p_ids uuid[])
returns table (listing_id uuid, views bigint, saves integer, shares integer)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, coalesce(c.views, 0)::bigint, coalesce(c.saves, 0)::integer, coalesce(c.shares, 0)::integer
    from unnest(coalesce(p_ids[1:60], array[]::uuid[])) as w(id)
    join public.listings l on l.id = w.id
    left join public.listing_counters c on c.listing_id = l.id
   where l.status = 'PUBLISHED';
$$;
revoke execute on function public.listing_public_stats_many(uuid[]) from public;
grant execute on function public.listing_public_stats_many(uuid[]) to anon, authenticated, service_role;

comment on function public.listing_public_stats(uuid) is
  'Listing stats: lifetime views, current saves and lifetime shares of one published listing, examples included since 14 Nov 2026. No person is in it.';
comment on function public.listing_public_stats_many(uuid[]) is
  'Listing stats: the same three numbers for up to 60 published listings in one call (a page of cards).';

/* --------------------------------------------- 6. read-back, and the probe */

do $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_l uuid;
  v_lister uuid;
  v_guest text := repeat('ab', 32);
  v_views0 bigint; v_views1 bigint;
  v_shares0 integer; v_shares1 integer;
  v_first boolean; v_second boolean; v_own boolean;
  v_s1 boolean; v_s2 boolean; v_sown boolean;
  v_rows integer;
  v_read integer;
begin
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and column_name = 'shares'
         and table_name in ('listing_counters', 'listing_daily_stats')) <> 2 then
    raise exception 'listing shares read-back: a shares column is missing';
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.listing_view_marks'::regclass
                    and conname = 'listing_view_marks_kind_check'
                    and pg_get_constraintdef(oid) like '%''s''%') then
    raise exception 'listing shares read-back: the mark for a share is not allowed';
  end if;
  if has_function_privilege('anon', 'public.record_listing_share(uuid,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.record_listing_share(uuid,uuid,text)', 'execute')
     or has_function_privilege('anon', 'public.record_listing_view(uuid,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.record_listing_view(uuid,uuid,text)', 'execute') then
    raise exception 'listing shares read-back: a recorder can be called from a browser';
  end if;
  if not has_function_privilege('service_role', 'public.record_listing_share(uuid,uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.record_listing_view(uuid,uuid,text)', 'execute') then
    raise exception 'listing shares read-back: the server cannot call a recorder';
  end if;
  if not has_function_privilege('anon', 'public.listing_public_stats(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.listing_public_stats(uuid)', 'execute')
     or not has_function_privilege('anon', 'public.listing_public_stats_many(uuid[])', 'execute')
     or not has_function_privilege('authenticated', 'public.listing_public_stats_many(uuid[])', 'execute') then
    raise exception 'listing shares read-back: the public reads lost their grants';
  end if;
  if has_table_privilege('anon', 'public.listing_counters', 'select')
     or has_table_privilege('authenticated', 'public.listing_counters', 'select') then
    raise exception 'listing shares read-back: the counters table can be read directly';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('record_listing_view', 'record_listing_share', 'listing_public_stats', 'listing_public_stats_many')
       and (not p.prosecdef or position('search_path=' in coalesce(array_to_string(p.proconfig, ','), '')) = 0)
  ) then
    raise exception 'listing shares read-back: a function is not security definer with a fixed search_path';
  end if;

  /* The behaviour, in a subtransaction that is always rolled back: nothing
     this probe counts is kept. */
  begin
    select l.id, a.user_id into v_l, v_lister
      from public.listings l join public.agents a on a.id = l.agent_id
     where l.status = 'PUBLISHED'
     order by l.id limit 1;
    if v_l is null then
      raise exception 'probe_fixture_missing';
    end if;

    select coalesce((select views from public.listing_counters where listing_id = v_l), 0) into v_views0;
    select coalesce((select shares from public.listing_counters where listing_id = v_l), 0) into v_shares0;

    v_first  := public.record_listing_view(v_l, null, v_guest);
    v_second := public.record_listing_view(v_l, null, v_guest);
    v_own    := case when v_lister is null then false else public.record_listing_view(v_l, v_lister, null) end;
    select coalesce((select views from public.listing_counters where listing_id = v_l), 0) into v_views1;
    if v_first is not true or v_second is not false or v_views1 <> v_views0 + 1 then
      raise exception 'probe: one guest opening twice should count once (first %, second %, views % to %)',
        v_first, v_second, v_views0, v_views1;
    end if;
    if v_own is not false then
      raise exception 'probe: the lister''s own open was counted';
    end if;

    v_s1   := public.record_listing_share(v_l, null, v_guest);
    v_s2   := public.record_listing_share(v_l, null, v_guest);
    v_sown := case when v_lister is null then false else public.record_listing_share(v_l, v_lister, null) end;
    select coalesce((select shares from public.listing_counters where listing_id = v_l), 0) into v_shares1;
    if v_s1 is not true or v_s2 is not false or v_shares1 <> v_shares0 + 1 then
      raise exception 'probe: one guest sharing twice should count once (first %, second %, shares % to %)',
        v_s1, v_s2, v_shares0, v_shares1;
    end if;
    if v_sown is not false then
      raise exception 'probe: the lister''s own share was counted';
    end if;
    if public.record_listing_share(v_l, null, 'not-a-key') is not false
       or public.record_listing_share(gen_random_uuid(), null, v_guest) is not false then
      raise exception 'probe: a malformed key or an unknown listing was counted as a share';
    end if;
    if not exists (select 1 from public.listing_daily_stats where listing_id = v_l and day = v_today and shares >= 1) then
      raise exception 'probe: the day''s shares were not written';
    end if;
    if exists (select 1 from public.listing_view_marks where listing_id = v_l and viewer_hash in (v_guest, 'g:' || v_guest)) then
      raise exception 'probe: a mark holds the raw guest key';
    end if;

    /* Anybody can read the three numbers, and they are the ones just written. */
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    set local role anon;
    select count(*), max(s.shares) into v_rows, v_read from public.listing_public_stats(v_l) s;
    if v_rows <> 1 or v_read is distinct from v_shares1 then
      reset role;
      raise exception 'probe: anon read % rows, shares % (expected 1 row, %)', v_rows, v_read, v_shares1;
    end if;
    select count(*) into v_rows from public.listing_public_stats_many(array[v_l, v_l, gen_random_uuid()]);
    reset role;
    if v_rows <> 2 then
      raise exception 'probe: the cards'' read answered % rows, expected 2', v_rows;
    end if;

    raise exception 'probe_passed';
  exception when others then
    if sqlerrm = 'probe_passed' then
      perform set_config('vallo.listing_shares_probe', 'passed (rolled back, nothing kept)', false);
    elsif sqlerrm = 'probe_fixture_missing' then
      perform set_config('vallo.listing_shares_probe', 'skipped: no published listing to test with', false);
    else
      raise;
    end if;
  end;
end;
$$;

commit;

select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and column_name = 'shares'
      and table_name in ('listing_counters', 'listing_daily_stats')) as shares_columns,
  to_regprocedure('public.record_listing_share(uuid,uuid,text)') is not null as share_recorder,
  pg_get_function_result('public.listing_public_stats(uuid)'::regprocedure) as page_read_returns,
  (select count(*) from public.listings where status = 'PUBLISHED') as published_listings,
  (select coalesce(sum(views), 0) from public.listing_counters) as views_counted_so_far,
  (select coalesce(sum(shares), 0) from public.listing_counters) as shares_counted_so_far,
  current_setting('vallo.listing_shares_probe', true) as behaviour_probe;
