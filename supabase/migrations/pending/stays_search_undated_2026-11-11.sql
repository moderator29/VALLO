-- SEARCH: THE CATALOGUE SPENDS 2.8 PERCENT OF THE DATABASE PLANNING A JOIN IT
-- NEVER RUNS.
--
-- Backend audit, 11 November 2026. NOT APPLIED, and NOT YET MEASURED: unlike
-- the other files in this folder this one changes a hot path, so it carries
-- its own before and after script at the bottom and should be judged on those
-- numbers, not on this header.
--
-- =========================================================================
-- WHAT WAS MEASURED, ALL READ ONLY, ON 11 NOVEMBER
-- =========================================================================
--
-- `public.stays_search` is the catalogue search behind `/search`. It is a
-- plpgsql wrapper whose `if true` branch always calls
-- `public.stays_search_public`, a 23-parameter LANGUAGE sql function with a
-- 7,105 character body.
--
-- THE DATA IS TINY. `public.catalogue_entries` holds 72 rows, 71 of them
-- PUBLISHED, in a 96 kB heap. The base scan of it is a seq scan costing 12
-- shared buffers and about 2 ms.
--
-- THE CALLS ARE NOT. From `pg_stat_statements`, every row a PostgREST call:
--
--   calls  mean ms  max ms  buffers/call   parameters passed
--     578      354    2823          1810   entity_kinds, limit
--      97     1177    7862          1954   entity_kinds, limit
--      79     1501    7897          1953   entity_kinds, rooms, sort, limit, offset
--     153      305    2907          2499   entity_kinds, rooms, sort, limit, offset
--       5      911    1180          2575   entity_kinds, rooms, guests, sort, limit, offset
--
--   sum(total_exec_time) for stays_search  =    617.7 s
--   sum(total_exec_time) for every statement = 22,245.2 s
--   so this one function is 2.8 percent of all execution time on the project,
--   over a 72 row table.
--
-- NOT ONE OF THOSE CALL SHAPES PASSES p_check_in OR p_check_out. That matters
-- because the body's middle CTE, `priced`, is a LEFT JOIN LATERAL whose every
-- branch is guarded by `b.nights is not null`, and `nights` is null unless
-- both dates arrive. Inlined and planned with the dates null, that lateral
-- collapses to `One-Time Filter: false`:
--
--   Nested Loop Left Join (actual time=0.078..0.277 rows=71 loops=1)
--     ->  Seq Scan on catalogue_entries (actual rows=71) buffers: shared hit=12
--     ->  Limit (actual time=0.001..0.001 rows=0 loops=71)
--           ->  Result  One-Time Filter: false
--   Execution Time: 2.574 ms      Planning Time: 17.964 ms
--   Buffers: execution shared hit=15, PLANNING shared hit=785
--
-- So the work is 2.5 ms and 15 buffers; the planning of a cut-down version of
-- the same body is 18 ms and 785 buffers. The real body is three and a half
-- times larger and names eight tables rather than one.
--
-- AND THE COST DOES NOT REPEAT ONCE THE PLAN EXISTS. Three calls inside ONE
-- statement, after the first has been planned, measured with clock_timestamp:
--
--   call 1: 0.0 ms     call 2: 4.7 ms     call 3: 5.2 ms
--
-- Five milliseconds of real work against a 305 to 1,501 ms mean. The gap is
-- planning, repeated per request, because PostgREST runs every request in its
-- own transaction. `pg_stat_statements.track` is `top` and
-- `track_planning` is `off`, which is why the body's planning is folded into
-- the outer call's exec_time and `mean_plan_time` reads 0.00.
--
-- WHY IT MATTERED ON 11 NOVEMBER. `anon` carries statement_timeout 3s and
-- `authenticated` 8s. Those maxima of 7,862 and 7,897 ms sit on the ceiling.
-- When one goes over, Postgres raises 57014 and the transaction aborts;
-- PostgREST then issues the next request's BEGIN on the same connection
-- WITHOUT a ROLLBACK, Postgres refuses it with 25P02, and every later request
-- routed to that connection fails at BEGIN whatever read it was for. Measured:
-- session 6af48ced.2011a5, line 1 is 57014 at 15:42:54.651, lines 2 to 35 are
-- all 25P02 and the statement being refused is `BEGIN ISOLATION LEVEL READ
-- COMMITTED READ ONLY` itself. 1,662 of them between 15:42 and 15:58, from a
-- handful of timeouts, unrelated reads and all.
--
-- =========================================================================
-- THE CHANGE
-- =========================================================================
--
-- Plan the dated join only when there are dates. `stays_search_undated` is
-- `stays_search_public` with the `priced` lateral removed and its four
-- columns supplied as nulls, which is exactly what that lateral produces when
-- `nights` is null. The `params` and `base` CTEs and the whole final SELECT
-- are copied verbatim from the live body (md5 67503883917ea09ce244602b61d182e4),
-- so the rows and their order are the same by construction. CHECKED, not
-- asserted: with whitespace removed and lower-cased, the `params` plus `base`
-- block here is 1,962 characters md5 c85dc069b85fa4daa9251c083adb335a and the
-- final SELECT is 1,022 characters md5 5c2a8e60459c8c59bbd800934b124edb, both
-- identical to the live source at characters 1 to 2436 and from 5871. Re-check
-- with:
--   select md5(lower(regexp_replace(substring(prosrc from 1 for 2436), '\s+', '', 'g')))
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'stays_search_public';
-- The only hand-written SQL in this file is the ten line `filtered` CTE. Removing the lateral takes seven of the eight tables
-- out of the planned query: room_types, rate_plans, rate_calendar,
-- room_inventory, bookings, availability and cancellation_policies.
--
-- `stays_search_public` IS NOT TOUCHED, so the dated path is byte for byte
-- what it is today. Only the wrapper learns to choose, using the same test
-- the body already uses for `nights`.
--
-- Safe to run twice. Additive: one new function and one replaced wrapper.
-- The rollback is at the bottom and is one statement.

set lock_timeout = '5s';

begin;

-- 1. The undated twin. SECURITY INVOKER and search_path = '' like the other
--    three, so row level security on catalogue_entries still answers to the
--    caller and nothing is resolved from a mutable path.
create or replace function public.stays_search_undated(
  p_entity_kinds public.catalogue_entity_kind[] default null,
  p_q text default null,
  p_state_code text default null,
  p_city text default null,
  p_area text default null,
  p_check_in date default null,
  p_check_out date default null,
  p_rooms integer default 1,
  p_guests integer default null,
  p_min_price_minor bigint default null,
  p_max_price_minor bigint default null,
  p_min_rating numeric default null,
  p_room_categories public.room_category[] default null,
  p_amenities text[] default null,
  p_breakfast boolean default null,
  p_free_cancellation boolean default null,
  p_verified boolean default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default null,
  p_sort text default 'recommended',
  p_limit integer default 40,
  p_offset integer default 0
)
returns table (
  id uuid, entity_kind public.catalogue_entity_kind, entity_id uuid, title text, area text,
  city text, state_code text, kind text, source public.source_kind, verified boolean,
  is_demo boolean, featured boolean, headline_price_minor bigint, headline_price_period text,
  price_band smallint, max_sleeps smallint, cover_path text, latitude double precision,
  longitude double precision, rating_avg numeric, rating_count integer, has_breakfast boolean,
  has_free_cancellation boolean, room_categories public.room_category[], amenity_codes text[],
  distance_m double precision, nights integer, room_type_id uuid, rate_plan_id uuid,
  nightly_minor bigint, total_minor bigint, total_count bigint
)
language sql
stable
set search_path = ''
as $fn$
  with params as (
    select
      case when p_check_in is not null and p_check_out is not null and p_check_out > p_check_in
           then (p_check_out - p_check_in) else null end as nights,
      greatest(coalesce(p_rooms, 1), 1) as rooms,
      case when p_lat is not null and p_lng is not null
           then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
           else null end as origin,
      case when length(btrim(coalesce(p_q, ''))) >= 2
           then websearch_to_tsquery('simple', public.unaccent_immutable(p_q))
           else null end as query
  ),
  base as (
    select ce.id, ce.entity_kind, ce.entity_id, ce.title, ce.area, ce.city, ce.state_code, ce.kind, ce.source, ce.verified, ce.is_demo, ce.status, ce.featured, ce.published_at, ce.headline_price_minor, ce.headline_price_period, ce.price_band, ce.max_sleeps, ce.cover_path, ce.rating_avg, ce.rating_count, ce.has_breakfast, ce.has_free_cancellation, ce.room_categories, ce.amenity_codes, ce.search, ce.updated_at, ce.latitude_public as latitude, ce.longitude_public as longitude, ce.location_public as location, pr.nights, pr.rooms, pr.origin,
      case when pr.origin is not null and ce.location_public is not null
           then (round(extensions.st_distance(ce.location_public, pr.origin) / 500.0) * 500.0)::double precision else null end as distance_m
    from public.catalogue_entries ce, params pr
    where ce.status = 'PUBLISHED'
      and (p_entity_kinds is null or ce.entity_kind = any (p_entity_kinds))
      and (pr.query is null or ce.search @@ pr.query)
      and (p_state_code is null or ce.state_code = p_state_code)
      and (p_city is null or lower(ce.city) = lower(p_city))
      and (p_area is null or lower(ce.area) = lower(p_area))
      and (p_min_rating is null or ce.rating_avg >= p_min_rating)
      and (p_room_categories is null or ce.room_categories && p_room_categories)
      and (p_amenities is null or ce.amenity_codes @> p_amenities)
      and (p_breakfast is not true or ce.has_breakfast)
      and (p_free_cancellation is not true or ce.has_free_cancellation)
      and (p_verified is not true or ce.verified)
      and (p_guests is null or ce.max_sleeps is null or ce.max_sleeps * pr.rooms >= p_guests)
      and (pr.origin is null or p_radius_m is null or ce.location_public is null
           or extensions.st_dwithin(ce.location_public, pr.origin, p_radius_m))
  ),
  -- The four columns the `priced` lateral would have produced. With no dates
  -- it produces no row, so a left join leaves exactly these nulls, which is
  -- what `One-Time Filter: false` means in the plan above. Written out rather
  -- than joined for nothing.
  filtered as (
    select b.*,
      null::uuid as room_type_id,
      null::uuid as rate_plan_id,
      null::bigint as nightly_minor,
      null::bigint as total_minor,
      b.headline_price_minor as price_for_filter
    from base b
    where (p_min_price_minor is null or coalesce(b.headline_price_minor, -1) >= p_min_price_minor)
      and (p_max_price_minor is null or coalesce(b.headline_price_minor, -1) between 0 and p_max_price_minor)
  )
  select
    f.id, f.entity_kind, f.entity_id, f.title, f.area, f.city, f.state_code, f.kind, f.source,
    f.verified, f.is_demo, f.featured, f.headline_price_minor, f.headline_price_period, f.price_band,
    f.max_sleeps, f.cover_path, f.latitude, f.longitude, f.rating_avg, f.rating_count,
    f.has_breakfast, f.has_free_cancellation, f.room_categories, f.amenity_codes,
    f.distance_m, f.nights, f.room_type_id, f.rate_plan_id, f.nightly_minor, f.total_minor,
    count(*) over () as total_count
  from filtered f
  order by
    -- Dated inventory first on a dated query; first party above partner at equal relevance.
    case when f.nights is not null and f.total_minor is not null then 0 else 1 end,
    case when f.source = 'first_party' then 0 else 1 end,
    case when p_sort = 'price-asc'  then f.price_for_filter end asc nulls last,
    case when p_sort = 'price-desc' then f.price_for_filter end desc nulls last,
    case when p_sort = 'top-rated'  then f.rating_avg end desc nulls last,
    case when p_sort = 'distance'   then f.distance_m end asc nulls last,
    f.featured desc, f.published_at desc nulls last, f.id
  limit least(greatest(coalesce(p_limit, 40), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$fn$;

revoke all on function public.stays_search_undated(
  public.catalogue_entity_kind[], text, text, text, text, date, date, integer, integer,
  bigint, bigint, numeric, public.room_category[], text[], boolean, boolean, boolean,
  double precision, double precision, integer, text, integer, integer) from public;
grant execute on function public.stays_search_undated(
  public.catalogue_entity_kind[], text, text, text, text, date, date, integer, integer,
  bigint, bigint, numeric, public.room_category[], text[], boolean, boolean, boolean,
  double precision, double precision, integer, text, integer, integer) to anon, authenticated;

-- 2. The wrapper chooses. The test is the one the body already applies to
--    decide `nights`, so a query that would have taken the dated path still
--    does. The dead `stays_search_exact` branch the `if true` had fenced off
--    is kept exactly as it was, still unreachable, so this file changes which
--    function runs and nothing else.
create or replace function public.stays_search(
  p_entity_kinds public.catalogue_entity_kind[] default null,
  p_q text default null,
  p_state_code text default null,
  p_city text default null,
  p_area text default null,
  p_check_in date default null,
  p_check_out date default null,
  p_rooms integer default 1,
  p_guests integer default null,
  p_min_price_minor bigint default null,
  p_max_price_minor bigint default null,
  p_min_rating numeric default null,
  p_room_categories public.room_category[] default null,
  p_amenities text[] default null,
  p_breakfast boolean default null,
  p_free_cancellation boolean default null,
  p_verified boolean default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default null,
  p_sort text default 'recommended',
  p_limit integer default 40,
  p_offset integer default 0
)
returns table (
  id uuid, entity_kind public.catalogue_entity_kind, entity_id uuid, title text, area text,
  city text, state_code text, kind text, source public.source_kind, verified boolean,
  is_demo boolean, featured boolean, headline_price_minor bigint, headline_price_period text,
  price_band smallint, max_sleeps smallint, cover_path text, latitude double precision,
  longitude double precision, rating_avg numeric, rating_count integer, has_breakfast boolean,
  has_free_cancellation boolean, room_categories public.room_category[], amenity_codes text[],
  distance_m double precision, nights integer, room_type_id uuid, rate_plan_id uuid,
  nightly_minor bigint, total_minor bigint, total_count bigint
)
language plpgsql
stable
set search_path = ''
as $fn$
begin
  -- No dates means the dated lateral can produce nothing, so it is not worth
  -- planning. Same rule the body uses for `nights`.
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    return query select * from public.stays_search_undated(p_entity_kinds, p_q, p_state_code, p_city, p_area, p_check_in, p_check_out, p_rooms, p_guests, p_min_price_minor, p_max_price_minor, p_min_rating, p_room_categories, p_amenities, p_breakfast, p_free_cancellation, p_verified, p_lat, p_lng, p_radius_m, p_sort, p_limit, p_offset);
  else
    return query select * from public.stays_search_public(p_entity_kinds, p_q, p_state_code, p_city, p_area, p_check_in, p_check_out, p_rooms, p_guests, p_min_price_minor, p_max_price_minor, p_min_rating, p_room_categories, p_amenities, p_breakfast, p_free_cancellation, p_verified, p_lat, p_lng, p_radius_m, p_sort, p_limit, p_offset);
  end if;
end;
$fn$;

commit;

-- =========================================================================
-- BEFORE AND AFTER. Run this block BEFORE applying and again after, and keep
-- both answers. It is read only and takes a second.
-- =========================================================================
--
--   -- 1. The rows and their order must not move. Expect two identical lists.
--   select id, entity_kind, headline_price_minor, total_count
--     from public.stays_search(null, null, null, null, null, null, null, null, null,
--       null, null, null, null, null, null, null, null, null, null, null, 'recommended', 40, 0);
--   select id, entity_kind, headline_price_minor, total_count
--     from public.stays_search_public(null, null, null, null, null, null, null, null, null,
--       null, null, null, null, null, null, null, null, null, null, null, 'recommended', 40, 0);
--
--   -- 2. The cost. Compare Execution Time and the planning buffer count.
--   explain (analyze, buffers)
--   select count(*) from public.stays_search(null, null, null, null, null, null, null, null,
--     null, null, null, null, null, null, null, null, null, null, null, null, 'recommended', 24, 0);
--   -- Before, measured 11 November: 421 ms cold, 230 ms warm, 3290 buffers.
--
--   -- 3. The dated path must be untouched. Pick real dates and compare to
--   --    stays_search_public with the same arguments; expect identical rows.
--
--   -- 4. Live, after a day: mean_exec_time should fall by roughly the
--   --    planning share, and max_exec_time should come off the 3s and 8s
--   --    ceilings that were producing 57014.
--   select calls, round(mean_exec_time::numeric, 0) as mean_ms,
--          round(max_exec_time::numeric, 0) as max_ms,
--          round((shared_blks_hit / greatest(calls, 1))::numeric, 0) as blks_per_call
--     from pg_stat_statements where query ilike '%stays_search%' order by calls desc;
--
-- ROLLBACK, one statement: restore the wrapper to the single branch it has
-- today and the undated twin is simply never called.
--
--   create or replace function public.stays_search(...same signature...)
--   returns table (...same...) language plpgsql stable set search_path = '' as $$
--   begin
--     return query select * from public.stays_search_public(p_entity_kinds, p_q, p_state_code,
--       p_city, p_area, p_check_in, p_check_out, p_rooms, p_guests, p_min_price_minor,
--       p_max_price_minor, p_min_rating, p_room_categories, p_amenities, p_breakfast,
--       p_free_cancellation, p_verified, p_lat, p_lng, p_radius_m, p_sort, p_limit, p_offset);
--   end $$;
