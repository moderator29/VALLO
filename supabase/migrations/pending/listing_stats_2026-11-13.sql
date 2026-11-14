/*
 * LISTING STATS: DAYS ON VALLO, VIEWS AND SAVES ON EVERY LISTING, AND THE
 * LISTINGS DESK UNDER ANALYTICS (founder, 13 November 2026: "priority views
 * and saved ... and the analytics in admin panel frontend very important").
 *
 * STATUS: NOT APPLIED. UNVERIFIED AGAINST LIVE. Written from the migrations in
 * this repository while the database connector was down; nothing here has been
 * run against project uccixoonmbhrnyczyigt or a local copy. Read it against the
 * live definitions of public.listing_daily_stats, public.listing_view_marks,
 * private.listing_view_salts, private.has_role and private.staff_can first.
 * Safe to run twice: every object is `if not exists` or `create or replace`,
 * every backfill is written so a second run lands on the same numbers.
 *
 * WHAT EXISTED, AND IS REUSED RATHER THAN COPIED (V-73, migration
 * 20260928231155_v73_per_listing_funnel.sql):
 *
 *   public.listing_view_marks   the one-day memory that makes a view unique:
 *                               (listing_id, day, kind, viewer_hash) is its
 *                               primary key, viewer_hash an HMAC of the viewer
 *                               under a random salt that lives one Lagos day.
 *                               This IS the append table the brief describes
 *                               (one row per viewer per listing per day); a
 *                               second one would count the same open twice.
 *   private.listing_view_salts  the day's salt; the hourly purge
 *                               (private.purge_view_marks, job
 *                               vallo_purge_view_marks) deletes yesterday's
 *                               salt and marks, after which no count can be
 *                               tied to anybody.
 *   public.listing_daily_stats  the daily rollup: impressions and opens per
 *                               listing per Lagos day.
 *
 * WHAT THIS FILE ADDS:
 *
 *   1. Three day columns on the rollup (saves, enquiries, viewings), so the
 *      desk's trends and conversions are sums over a small table, never a
 *      scan of saved_items, conversations or inspection_requests per request.
 *   2. public.listing_counters: one row per listing, lifetime views and current
 *      saves, so the listing page reads two numbers by primary key (O(1)).
 *   3. Triggers that keep 1 and 2 true: an open written to the rollup by ANY
 *      path (this file's recorder or V-73's) adds to the lifetime views; a save
 *      or unsave moves the counter; a new enquiry or viewing request adds to
 *      its day. Each trigger swallows its own error: a statistic must never
 *      stop somebody saving a place, sending a message or booking a viewing.
 *   4. public.record_listing_view: counts one open of one listing, by a member
 *      (their id) or a guest (a key the server derives), once per viewer per
 *      listing per Lagos day. Service role only.
 *   5. Reads: listing_public_stats and listing_public_stats_many (the page's
      row and the cards' counts; anon and authenticated),
 *      my_listing_stats (a lister's own listings only), and the staff desk's
 *      admin_listing_stats_daily, admin_listing_stats_ranked and
 *      admin_listing_stats_lifetime (admins, super admins and the read-only
 *      analyst scope, or the server's service role after it checked them).
 *   6. One-time backfills, and read-backs with has_table_privilege and
 *      has_function_privilege, plus a behaviour probe that always rolls back.
 *
 * PRIVACY AND THE DEDUP RULE:
 *
 *   - One view per viewer per listing per Lagos day. A member is keyed by
 *     their user id, a guest by a 64-hex key the app server derives from a
 *     SHA-256 of the network address and the browser's user agent. The raw
 *     address never reaches the database, and the database stores neither the
 *     id nor the key: only HMAC(key, today's salt), deleted with the salt
 *     within the hour after the day ends. No cookie or device storage is used
 *     to count a guest.
 *   - Not counted: example listings (is_demo), a listing that is not
 *     PUBLISHED, the listing's own lister (agent or assigned agent), staff
 *     (admin and super_admin roles, any live staff grant) and accounts marked
 *     internal (public.internal_accounts). Bots, prefetches, background tabs,
 *     a browser that declined usage counts or sends Global Privacy Control are
 *     turned away by the app before this function is called.
 *   - The day columns leave out saves, enquiries and viewing requests made by
 *     staff and internal accounts (C10), as every console figure does. The
 *     public save count is every save the listing holds.
 */

set lock_timeout = '5s';

/* ------------------------------------------------ 1. the daily rollup grows */

alter table public.listing_daily_stats
  add column if not exists saves integer not null default 0 check (saves >= 0);
alter table public.listing_daily_stats
  add column if not exists enquiries integer not null default 0 check (enquiries >= 0);
alter table public.listing_daily_stats
  add column if not exists viewings integer not null default 0 check (viewings >= 0);

comment on table public.listing_daily_stats is
  'V-73 and listing stats (13 Nov 2026): per listing per Lagos day, unique viewers who saw it in results (impressions) and opened it (opens), and saves, enquiries and viewing requests made that day by people who are not staff. Counts only. Written by record_listing_views, record_listing_view and the listing stats triggers; read by listing_funnel and the admin_listing_stats_* functions.';

/* The desk reads a window of days across every listing. */
create index if not exists listing_daily_stats_day_idx
  on public.listing_daily_stats (day, listing_id);

/* ----------------------------------------- 2. lifetime counters per listing */

create table if not exists public.listing_counters (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  views bigint not null default 0 check (views >= 0),
  saves integer not null default 0 check (saves >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.listing_counters is
  'Listing stats (13 Nov 2026): lifetime unique-per-day views and current saves of one listing, kept by triggers, read by primary key for the listing page. No person is in it. Read only through listing_public_stats, my_listing_stats and admin_listing_stats_lifetime.';

alter table public.listing_counters enable row level security;
revoke all on public.listing_counters from public, anon, authenticated;

/* ------------------------------------------------------- private helpers */

/* Staff and internal accounts: not viewers, and left out of the desk's days. */
create or replace function private.listing_stats_internal(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and (
    exists (select 1 from public.user_roles r
             where r.user_id = p_user
               and r.role in ('admin'::public.app_role, 'super_admin'::public.app_role))
    or exists (select 1 from public.staff_grants g where g.user_id = p_user and g.revoked_at is null)
    or exists (select 1 from public.internal_accounts i where i.user_id = p_user)
  );
$$;
revoke all on function private.listing_stats_internal(uuid) from public, anon, authenticated;

/*
 * May this caller read the desk's figures? An admin or super admin whose
 * session proved its security key (private.has_role checks the step-up), a
 * staff member holding the read-only analyst scope (private.staff_can), or the
 * server's service role, which the app uses for a scoped staff member only
 * after requireAdmin(scope) has proved the scope.
 */
create or replace function private.listing_stats_reader_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'role', '') = 'service_role'
      or coalesce(private.has_role((select auth.uid()), 'admin'::public.app_role), false)
      or coalesce(private.has_role((select auth.uid()), 'super_admin'::public.app_role), false)
      or coalesce(private.staff_can((select auth.uid()), 'analyst'), false);
$$;
revoke all on function private.listing_stats_reader_ok() from public, anon, authenticated;

/* ------------------------------------------------------------ 3. triggers */

/* An open written to the rollup, by any path, is a lifetime view. */
create or replace function private.listing_counters_on_daily()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta bigint;
begin
  v_delta := new.opens - (case when tg_op = 'UPDATE' then old.opens else 0 end);
  if v_delta > 0 then
    insert into public.listing_counters (listing_id, views)
    values (new.listing_id, v_delta)
    on conflict (listing_id) do update
      set views = public.listing_counters.views + excluded.views,
          updated_at = now();
  end if;
  return null;
exception when others then
  /* A lifetime figure is never worth refusing the day's count. */
  return null;
end;
$$;
revoke all on function private.listing_counters_on_daily() from public, anon, authenticated;

drop trigger if exists listing_daily_stats_lifetime_views on public.listing_daily_stats;
create trigger listing_daily_stats_lifetime_views
  after insert or update of opens on public.listing_daily_stats
  for each row execute function private.listing_counters_on_daily();

/* A save moves the public count and, for a real listing saved by a member who
   is not staff, the day's saves. An unsave moves the public count back. */
create or replace function private.listing_counters_on_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if tg_op = 'INSERT' then
    insert into public.listing_counters (listing_id, saves)
    values (new.listing_id, 1)
    on conflict (listing_id) do update
      set saves = public.listing_counters.saves + 1,
          updated_at = now();
    if not private.listing_stats_internal(new.user_id)
       and exists (select 1 from public.listings l where l.id = new.listing_id and not l.is_demo) then
      insert into public.listing_daily_stats (listing_id, day, saves)
      values (new.listing_id, v_today, 1)
      on conflict (listing_id, day) do update
        set saves = public.listing_daily_stats.saves + 1;
    end if;
  elsif tg_op = 'DELETE' then
    update public.listing_counters
       set saves = greatest(saves - 1, 0),
           updated_at = now()
     where listing_id = old.listing_id;
  end if;
  return null;
exception when others then
  /* Saving a place never fails because a statistic did. */
  return null;
end;
$$;
revoke all on function private.listing_counters_on_save() from public, anon, authenticated;

drop trigger if exists saved_items_listing_stats on public.saved_items;
create trigger saved_items_listing_stats
  after insert or delete on public.saved_items
  for each row execute function private.listing_counters_on_save();

/* A new conversation about a listing is an enquiry on its day. */
create or replace function private.listing_daily_on_enquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.listing_id is not null
     and not private.listing_stats_internal(new.guest_id)
     and exists (select 1 from public.listings l where l.id = new.listing_id and not l.is_demo) then
    insert into public.listing_daily_stats (listing_id, day, enquiries)
    values (new.listing_id, (now() at time zone 'Africa/Lagos')::date, 1)
    on conflict (listing_id, day) do update
      set enquiries = public.listing_daily_stats.enquiries + 1;
  end if;
  return null;
exception when others then
  /* A message is never refused because a statistic failed. */
  return null;
end;
$$;
revoke all on function private.listing_daily_on_enquiry() from public, anon, authenticated;

drop trigger if exists conversations_listing_stats on public.conversations;
create trigger conversations_listing_stats
  after insert on public.conversations
  for each row execute function private.listing_daily_on_enquiry();

/* A new viewing (inspection) request is a viewing on its day. */
create or replace function private.listing_daily_on_viewing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.listing_stats_internal(new.requester_id)
     and exists (select 1 from public.listings l where l.id = new.listing_id and not l.is_demo) then
    insert into public.listing_daily_stats (listing_id, day, viewings)
    values (new.listing_id, (now() at time zone 'Africa/Lagos')::date, 1)
    on conflict (listing_id, day) do update
      set viewings = public.listing_daily_stats.viewings + 1;
  end if;
  return null;
exception when others then
  /* A viewing request is never refused because a statistic failed. */
  return null;
end;
$$;
revoke all on function private.listing_daily_on_viewing() from public, anon, authenticated;

drop trigger if exists inspection_requests_listing_stats on public.inspection_requests;
create trigger inspection_requests_listing_stats
  after insert on public.inspection_requests
  for each row execute function private.listing_daily_on_viewing();

/* -------------------------------------------------- 4. the view recorder */

/*
 * Count one open of one listing. Called by the app server only (service role),
 * from /api/listing-view, after the page was visible for a second in a real
 * browser. Exactly one of p_viewer (a signed-in member) or p_guest (64 hex
 * characters the server derived; never an address) is used; a member wins.
 * Returns true when the open was new today and counted.
 *
 * A member is hashed exactly as record_listing_views hashes them, so the same
 * person opening the same listing through either path is one view.
 */
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

  /* Published, real, and not the viewer's own. */
  select l.id into v_target
    from public.listings l
    join public.agents a on a.id = l.agent_id
    left join public.agents aa on aa.id = l.assigned_agent_id
   where l.id = p_listing
     and l.status = 'PUBLISHED'
     and not l.is_demo
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
  'Listing stats (13 Nov 2026): one open of one published, non-example listing by a member (id) or a guest (a 64-hex key the server derives, never an address), counted once per viewer per listing per Lagos day under the V-73 daily salt. Staff, internal accounts and the lister are not counted. Service role only.';

revoke execute on function public.record_listing_view(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_listing_view(uuid, uuid, text) to service_role;

/* ------------------------------------------------------------ 5. reads */

/* The listing page's two numbers. Nothing for a listing that is not live or
   is an example: the page draws no row then. */
create or replace function public.listing_public_stats(p_listing uuid)
returns table (views bigint, saves integer)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(c.views, 0)::bigint, coalesce(c.saves, 0)::integer
    from public.listings l
    left join public.listing_counters c on c.listing_id = l.id
   where l.id = p_listing
     and l.status = 'PUBLISHED'
     and not l.is_demo;
$$;
revoke execute on function public.listing_public_stats(uuid) from public;
grant execute on function public.listing_public_stats(uuid) to anon, authenticated, service_role;

/* The same two numbers for the listings one page draws (its cards), in one
   call: at most 60 ids, live real listings only, so a page never pays one
   read per card. */
create or replace function public.listing_public_stats_many(p_ids uuid[])
returns table (listing_id uuid, views bigint, saves integer)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, coalesce(c.views, 0)::bigint, coalesce(c.saves, 0)::integer
    from unnest(coalesce(p_ids[1:60], array[]::uuid[])) as w(id)
    join public.listings l on l.id = w.id
    left join public.listing_counters c on c.listing_id = l.id
   where l.status = 'PUBLISHED'
     and not l.is_demo;
$$;
revoke execute on function public.listing_public_stats_many(uuid[]) from public;
grant execute on function public.listing_public_stats_many(uuid[]) to anon, authenticated, service_role;

/* A lister's own listings, and only theirs. */
create or replace function public.my_listing_stats()
returns table (listing_id uuid, views bigint, saves integer)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, coalesce(c.views, 0)::bigint, coalesce(c.saves, 0)::integer
    from public.listings l
    join public.agents a on a.id = l.agent_id
    left join public.listing_counters c on c.listing_id = l.id
   where a.user_id = (select auth.uid())
     and (select auth.uid()) is not null
     and not l.is_demo;
$$;
revoke execute on function public.my_listing_stats() from public, anon;
grant execute on function public.my_listing_stats() to authenticated;

/* The desk: one row per Lagos day of the window, zeros included, for every
   real listing or for one. Sums over the rollup only. */
create or replace function public.admin_listing_stats_daily(p_days integer, p_listing uuid default null)
returns table (day date, views bigint, saves bigint, enquiries bigint, viewings bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select (now() at time zone 'Africa/Lagos')::date as today,
           least(greatest(coalesce(p_days, 30), 1), 400) as n
  ),
  rolled as (
    select st.day, st.opens, st.saves, st.enquiries, st.viewings
      from public.listing_daily_stats st
      join public.listings l on l.id = st.listing_id and not l.is_demo
      cross join bounds b
     where st.day > b.today - b.n
       and st.day <= b.today
       and (p_listing is null or st.listing_id = p_listing)
  )
  select d.d::date,
         coalesce(sum(r.opens), 0)::bigint,
         coalesce(sum(r.saves), 0)::bigint,
         coalesce(sum(r.enquiries), 0)::bigint,
         coalesce(sum(r.viewings), 0)::bigint
    from bounds b
    cross join lateral generate_series((b.today - (b.n - 1))::timestamp, b.today::timestamp, interval '1 day') as d(d)
    left join rolled r on r.day = d.d::date
   where private.listing_stats_reader_ok()
   group by d.d
   order by d.d;
$$;
revoke execute on function public.admin_listing_stats_daily(integer, uuid) from public, anon;
grant execute on function public.admin_listing_stats_daily(integer, uuid) to authenticated, service_role;

/* The desk's tables: the window's figures grouped by listing, by area or by
   lister, ordered by views or by saves. */
create or replace function public.admin_listing_stats_ranked(
  p_days integer,
  p_group text default 'listing',
  p_order text default 'views',
  p_limit integer default 10
)
returns table (
  group_key text,
  label text,
  sub text,
  listings bigint,
  views bigint,
  saves bigint,
  enquiries bigint,
  viewings bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with win as (
    select st.listing_id,
           sum(st.opens)::bigint as v_views,
           sum(st.saves)::bigint as v_saves,
           sum(st.enquiries)::bigint as v_enquiries,
           sum(st.viewings)::bigint as v_viewings
      from public.listing_daily_stats st
     where st.day > (now() at time zone 'Africa/Lagos')::date - least(greatest(coalesce(p_days, 30), 1), 400)
     group by st.listing_id
  ),
  tagged as (
    select case p_group
             when 'area' then lower(coalesce(nullif(trim(l.area), ''), '-')) || '|' || lower(coalesce(nullif(trim(l.city), ''), '-'))
             when 'lister' then l.agent_id::text
             else l.id::text
           end as k,
           case p_group
             when 'area' then coalesce(nullif(trim(l.area), ''), nullif(trim(l.city), ''), 'No area given')
             when 'lister' then a.display_name
             else l.title
           end as lbl,
           case p_group
             when 'area' then case when nullif(trim(l.area), '') is null then null else nullif(trim(l.city), '') end
             when 'lister' then null
             else concat_ws(', ', nullif(trim(l.area), ''), nullif(trim(l.city), ''))
           end as sb,
           l.id as lid,
           w.v_views, w.v_saves, w.v_enquiries, w.v_viewings
      from win w
      join public.listings l on l.id = w.listing_id and not l.is_demo
      join public.agents a on a.id = l.agent_id
  )
  select t.k, min(t.lbl), min(t.sb), count(distinct t.lid)::bigint,
         sum(t.v_views)::bigint, sum(t.v_saves)::bigint, sum(t.v_enquiries)::bigint, sum(t.v_viewings)::bigint
    from tagged t
   where private.listing_stats_reader_ok()
     and p_group in ('listing', 'area', 'lister')
   group by t.k
  having sum(t.v_views) + sum(t.v_saves) + sum(t.v_enquiries) + sum(t.v_viewings) > 0
   order by (case when p_order = 'saves' then sum(t.v_saves) else sum(t.v_views) end) desc,
            sum(t.v_views) desc, t.k
   limit least(greatest(coalesce(p_limit, 10), 1), 100);
$$;
revoke execute on function public.admin_listing_stats_ranked(integer, text, text, integer) from public, anon;
grant execute on function public.admin_listing_stats_ranked(integer, text, text, integer) to authenticated, service_role;

/* One listing's lifetime figures, for its detail page. */
create or replace function public.admin_listing_stats_lifetime(p_listing uuid)
returns table (views bigint, saves integer)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(c.views, 0)::bigint, coalesce(c.saves, 0)::integer
    from public.listings l
    left join public.listing_counters c on c.listing_id = l.id
   where l.id = p_listing
     and private.listing_stats_reader_ok();
$$;
revoke execute on function public.admin_listing_stats_lifetime(uuid) from public, anon;
grant execute on function public.admin_listing_stats_lifetime(uuid) to authenticated, service_role;

/* ------------------------------------------------------- 6. backfills */

/*
 * Lifetime views: every open the rollup already holds (V-73 has counted
 * signed-in opens since 28 September 2026). `greatest` keeps a second run from
 * lowering a counter the trigger has moved since. Saves: the exact number of
 * saved_items rows, recounted on every run, so the public count is true.
 */
insert into public.listing_counters (listing_id, views, saves)
select l.id, coalesce(v.views, 0), coalesce(s.saves, 0)
  from public.listings l
  left join (select listing_id, sum(opens)::bigint as views from public.listing_daily_stats group by listing_id) v
         on v.listing_id = l.id
  left join (select listing_id, count(*)::integer as saves from public.saved_items group by listing_id) s
         on s.listing_id = l.id
 where v.views is not null or s.saves is not null
on conflict (listing_id) do update
  set views = greatest(public.listing_counters.views, excluded.views),
      saves = excluded.saves,
      updated_at = now();

update public.listing_counters c
   set saves = 0, updated_at = now()
 where c.saves <> 0
   and not exists (select 1 from public.saved_items si where si.listing_id = c.listing_id);

/* The day columns, from the rows that exist (a save later removed is gone, so
   the past days count the saves still held). `greatest` again keeps a second
   run from undoing what the triggers added since the first. */
insert into public.listing_daily_stats (listing_id, day, saves)
select si.listing_id, (si.created_at at time zone 'Africa/Lagos')::date, count(*)::integer
  from public.saved_items si
  join public.listings l on l.id = si.listing_id and not l.is_demo
 where not private.listing_stats_internal(si.user_id)
 group by 1, 2
on conflict (listing_id, day) do update
  set saves = greatest(public.listing_daily_stats.saves, excluded.saves);

insert into public.listing_daily_stats (listing_id, day, enquiries)
select c.listing_id, (c.created_at at time zone 'Africa/Lagos')::date, count(*)::integer
  from public.conversations c
  join public.listings l on l.id = c.listing_id and not l.is_demo
 where c.listing_id is not null
   and not private.listing_stats_internal(c.guest_id)
 group by 1, 2
on conflict (listing_id, day) do update
  set enquiries = greatest(public.listing_daily_stats.enquiries, excluded.enquiries);

insert into public.listing_daily_stats (listing_id, day, viewings)
select r.listing_id, (r.created_at at time zone 'Africa/Lagos')::date, count(*)::integer
  from public.inspection_requests r
  join public.listings l on l.id = r.listing_id and not l.is_demo
 where not private.listing_stats_internal(r.requester_id)
 group by 1, 2
on conflict (listing_id, day) do update
  set viewings = greatest(public.listing_daily_stats.viewings, excluded.viewings);

/* ------------------------------------------------------- 7. read-backs */

do $readback$
declare
  v_l       uuid;
  v_example uuid;
  v_lister  uuid;
  v_viewer  uuid;
  v_today   date := (now() at time zone 'Africa/Lagos')::date;
  v_guest   text := repeat('ab', 32);
  v_first   boolean;
  v_second  boolean;
  v_own     boolean;
  v_demo    boolean;
  v_opens0  integer;
  v_opens1  integer;
  v_views0  bigint;
  v_views1  bigint;
  v_saves0  integer;
  v_saves1  integer;
  v_saves2  integer;
  v_rows    integer;
begin
  /* The objects, as described. */
  if to_regclass('public.listing_counters') is null then
    raise exception 'listing stats read-back: public.listing_counters is missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.listing_counters'::regclass) then
    raise exception 'listing stats read-back: RLS is off on public.listing_counters';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'listing_daily_stats'
         and column_name in ('saves', 'enquiries', 'viewings')) <> 3 then
    raise exception 'listing stats read-back: the rollup is missing a day column';
  end if;
  if (select count(*) from pg_trigger
       where not tgisinternal
         and tgname in ('listing_daily_stats_lifetime_views', 'saved_items_listing_stats',
                        'conversations_listing_stats', 'inspection_requests_listing_stats')) <> 4 then
    raise exception 'listing stats read-back: a trigger is missing';
  end if;

  /* Born locked: no person reads or writes a stats table directly. */
  if has_table_privilege('anon', 'public.listing_counters', 'select')
     or has_table_privilege('authenticated', 'public.listing_counters', 'select')
     or has_table_privilege('authenticated', 'public.listing_counters', 'insert')
     or has_table_privilege('authenticated', 'public.listing_counters', 'update')
     or has_table_privilege('anon', 'public.listing_daily_stats', 'select')
     or has_table_privilege('authenticated', 'public.listing_daily_stats', 'select')
     or has_table_privilege('authenticated', 'public.listing_daily_stats', 'update')
     or has_table_privilege('anon', 'public.listing_view_marks', 'select')
     or has_table_privilege('authenticated', 'public.listing_view_marks', 'select') then
    raise exception 'listing stats read-back: a stats table is granted to anon or authenticated';
  end if;

  /* Functions: the recorder is the server's alone; the reads as designed. */
  if has_function_privilege('anon', 'public.record_listing_view(uuid,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.record_listing_view(uuid,uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.record_listing_view(uuid,uuid,text)', 'execute')
     or not has_function_privilege('anon', 'public.listing_public_stats(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.listing_public_stats(uuid)', 'execute')
     or not has_function_privilege('anon', 'public.listing_public_stats_many(uuid[])', 'execute')
     or has_function_privilege('anon', 'public.my_listing_stats()', 'execute')
     or not has_function_privilege('authenticated', 'public.my_listing_stats()', 'execute')
     or has_function_privilege('anon', 'public.admin_listing_stats_daily(integer,uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_listing_stats_daily(integer,uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.admin_listing_stats_daily(integer,uuid)', 'execute')
     or has_function_privilege('anon', 'public.admin_listing_stats_ranked(integer,text,text,integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_listing_stats_ranked(integer,text,text,integer)', 'execute')
     or has_function_privilege('anon', 'public.admin_listing_stats_lifetime(uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.listing_stats_internal(uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.listing_stats_reader_ok()', 'execute')
     or has_function_privilege('authenticated', 'private.listing_counters_on_save()', 'execute') then
    raise exception 'listing stats read-back: function grants are not as designed';
  end if;

  /* Every function that writes or gates runs with an empty search path. */
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where (n.nspname, p.proname) in (
             ('public', 'record_listing_view'), ('public', 'listing_public_stats'), ('public', 'listing_public_stats_many'),
             ('public', 'my_listing_stats'),
             ('public', 'admin_listing_stats_daily'), ('public', 'admin_listing_stats_ranked'),
             ('public', 'admin_listing_stats_lifetime'), ('private', 'listing_stats_internal'),
             ('private', 'listing_stats_reader_ok'), ('private', 'listing_counters_on_daily'),
             ('private', 'listing_counters_on_save'), ('private', 'listing_daily_on_enquiry'),
             ('private', 'listing_daily_on_viewing'))
       and (not p.prosecdef or position('search_path=' in coalesce(array_to_string(p.proconfig, ','), '')) = 0)
  ) then
    raise exception 'listing stats read-back: a function is not security definer with a fixed search_path';
  end if;

  /* The behaviour, in a subtransaction that is always rolled back. */
  begin
    select l.id, a.user_id into v_l, v_lister
      from public.listings l join public.agents a on a.id = l.agent_id
     where l.status = 'PUBLISHED'
     order by l.is_demo, l.id limit 1;
    select u.id into v_viewer from auth.users u
     where u.id is distinct from v_lister
       and not private.listing_stats_internal(u.id)
       and not exists (select 1 from public.saved_items si where si.user_id = u.id and si.listing_id = v_l)
     order by u.created_at limit 1;
    if v_l is null or v_viewer is null then
      raise exception 'probe_fixture_missing';
    end if;
    /* Fixture: only a real (non-example) listing is counted, so a real one is
       preferred above. Where every published listing is an example, the
       listing guards (the SCUML 17 mandate gate among them) rightly refuse to
       make one real, and that is a missing fixture, not a fault in the stats:
       the first run against live on 14 November failed here and rolled the
       whole file back. */
    begin
      update public.listings set is_demo = false where id = v_l and is_demo;
    exception when others then
      raise exception 'probe_fixture_missing';
    end;

    select coalesce((select opens from public.listing_daily_stats where listing_id = v_l and day = v_today), 0) into v_opens0;
    select coalesce((select views from public.listing_counters where listing_id = v_l), 0) into v_views0;

    v_first  := public.record_listing_view(v_l, null, v_guest);
    v_second := public.record_listing_view(v_l, null, v_guest);
    v_own    := public.record_listing_view(v_l, v_lister, null);

    select coalesce((select opens from public.listing_daily_stats where listing_id = v_l and day = v_today), 0) into v_opens1;
    select coalesce((select views from public.listing_counters where listing_id = v_l), 0) into v_views1;
    if v_first is not true or v_second is not false or v_opens1 <> v_opens0 + 1 or v_views1 <> v_views0 + 1 then
      raise exception 'probe: one guest twice should count once (first %, second %, opens % to %, views % to %)',
        v_first, v_second, v_opens0, v_opens1, v_views0, v_views1;
    end if;
    if v_own is not false then
      raise exception 'probe: the lister''s own open was counted';
    end if;
    if public.record_listing_view(v_l, null, 'not-a-key') is not false then
      raise exception 'probe: a malformed guest key was counted';
    end if;
    if exists (select 1 from public.listing_view_marks where listing_id = v_l and viewer_hash in (v_guest, 'g:' || v_guest)) then
      raise exception 'probe: a view mark holds the raw guest key';
    end if;

    /* A save moves the public count, an unsave moves it back. */
    select coalesce((select saves from public.listing_counters where listing_id = v_l), 0) into v_saves0;
    insert into public.saved_items (user_id, listing_id) values (v_viewer, v_l);
    select saves into v_saves1 from public.listing_counters where listing_id = v_l;
    delete from public.saved_items where user_id = v_viewer and listing_id = v_l;
    select saves into v_saves2 from public.listing_counters where listing_id = v_l;
    if v_saves1 is distinct from v_saves0 + 1 or v_saves2 is distinct from v_saves0 then
      raise exception 'probe: saves counter wrong (% then % then %)', v_saves0, v_saves1, v_saves2;
    end if;

    /* The public read answers anybody; the desk answers nobody without a role. */
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    set local role anon;
    select count(*) into v_rows from public.listing_public_stats(v_l);
    if v_rows <> 1 then
      reset role;
      raise exception 'probe: anon could not read the public stats (% rows)', v_rows;
    end if;
    select count(*) into v_rows from public.listing_public_stats_many(array[v_l, v_l, gen_random_uuid()]);
    reset role;
    if v_rows <> 2 then
      raise exception 'probe: anon could not read the cards'' stats (% rows)', v_rows;
    end if;

    perform set_config('request.jwt.claim.sub', v_viewer::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_viewer, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_rows from public.admin_listing_stats_daily(7, null);
    reset role;
    if v_rows <> 0 then
      raise exception 'probe: a member read the staff desk (% rows)', v_rows;
    end if;

    /* An example is never counted and never drawn (when the platform holds one). */
    select l.id into v_example from public.listings l
     where l.is_demo and l.status = 'PUBLISHED' order by l.id limit 1;
    if v_example is not null then
      v_demo := public.record_listing_view(v_example, null, repeat('cd', 32));
      select count(*) into v_rows from public.listing_public_stats(v_example);
      if v_demo is not false or v_rows <> 0 then
        raise exception 'probe: an example listing was counted or read (counted %, rows %)', v_demo, v_rows;
      end if;
    end if;

    raise exception 'probe_passed';
  exception when others then
    if sqlerrm = 'probe_passed' then
      perform set_config('vallo.listing_stats_probe', 'passed (rolled back)', false);
      raise notice 'listing stats probe passed (rolled back)';
    elsif sqlerrm = 'probe_fixture_missing' then
      perform set_config('vallo.listing_stats_probe',
        'skipped: no real published listing or no eligible member to test with', false);
      raise notice 'listing stats probe skipped: no real published listing or no eligible member to test with';
    else
      raise exception 'listing stats probe failed: %', sqlerrm;
    end if;
  end;
end
$readback$;

/* What the editor shows when the file has run: the objects are in, and whether
   the behaviour probe ran or had nothing real to run on. */
select to_regclass('public.listing_counters') is not null as counters_table,
       (select count(*) from pg_trigger
         where not tgisinternal
           and tgname in ('listing_daily_stats_lifetime_views', 'saved_items_listing_stats',
                          'conversations_listing_stats', 'inspection_requests_listing_stats')) as triggers_of_4,
       (select count(*) from public.listing_counters) as listings_with_counts,
       current_setting('vallo.listing_stats_probe', true) as behaviour_probe;
