-- VALLO INTELLIGENCE: SEARCH INDEXES, SEARCH ANALYTICS, STAFF ALIASES AND
-- A MEMBER'S RECENT SEARCHES (16 November 2026).
--
-- NOT APPLIED. Only the founder applies it, in the Supabase SQL editor.
-- Additive only: trigram indexes, four new tables (one private), and
-- SECURITY DEFINER functions. No existing table, policy, function or row is
-- changed, and nothing is removed. Safe to run twice (every statement is
-- `if not exists`, `create or replace` or guarded).
--
-- WHAT IT ADDS, IN PLAIN WORDS.
--
--  1. TRIGRAM INDEXES on the columns VALLO Intelligence searches with
--     `ilike '%words%'`: profile handles and display names, community names,
--     post titles and bodies, roommate listing titles and areas. The listings
--     table already has them (title, city, area), and so do businesses and
--     accommodations, so those are not repeated. pg_trgm lives in the
--     `extensions` schema on this project, so the operator class is named
--     `extensions.gin_trgm_ops`.
--
--  2. SEARCH ANALYTICS, `public.search_events`: one row per submitted search
--     or opened result. It keeps the words NORMALISED (lower case, single
--     spaces, at most 120 characters), the kind and tab, how many results,
--     how long the server took, the place (a name from the app's closed list),
--     which kind of result was opened, and a salted hash of the visit. It
--     keeps NO user id and NO address. Words carrying a run of ten or more
--     digits (a phone, account or ID number) are DROPPED: the row is kept,
--     the text is not. RLS on, no policy, no grant to anon or authenticated:
--     written only through `search_event_record` (service role only, called
--     by the app after the response has gone).
--
--  3. STAFF ALIASES, `public.search_aliases`: synonyms the search team adds
--     from the console (`/admin/search`). A `word` alias rewrites words
--     before they are read ("buka" -> "restaurant"); a `place` alias names a
--     place on the app's list ("Lekki 1" -> "Lekki Phase 1"; the app ignores
--     one that points anywhere else). Read by anyone through
--     `search_aliases_active` (active rows, three columns); written only
--     through `admin_search_alias_put` and `admin_search_alias_set_active`,
--     which admit an admin or a staff member with the `content` or
--     `marketing` access area on a session that proved its security key
--     (`private.staff_can`), and write `public.audit_log` in the same
--     transaction (`search_alias.added`, `.changed`, `.disabled`, `.enabled`).
--
--  4. POPULAR SEARCHES above a PRIVACY FLOOR: `search_popular_queries`
--     returns only words that at least THREE distinct visits searched in the
--     window (30 days by default, never more than 90) and that found
--     something. Below the floor, nothing is returned.
--
--  5. THE CONSOLE DESK: `admin_search_overview(days)` returns aggregates only
--     (searches, visits, zero-result share, click-through, median time, tab
--     and kind share, top places, and top and zero-result words, the word
--     lists under the same floor of three visits) to an admin or a staff
--     member with `analyst`, `content` or `marketing`. `admin_search_aliases`
--     lists the aliases to the same people.
--
--  6. A MEMBER'S OWN RECENT SEARCHES, `public.search_recent`: their last 20
--     searches, theirs alone (RLS select own; written and removed only
--     through `search_recent_remember`, `search_recent_forget` and
--     `search_recent_clear`, which act on auth.uid()). Removed with the
--     account (ON DELETE CASCADE).
--
-- RETENTION: 90 DAYS. `search_events_purge()` (service role only) deletes
-- every analytics row older than 90 days, and nothing reads further back.
-- Nothing is scheduled by this file; schedule it once, daily, with:
--   select cron.schedule('search-events-purge', '17 3 * * *', 'select public.search_events_purge()');
-- The visit salt (`private.search_event_salt`) is created once and never
-- leaves the database.
--
-- THE APP ALREADY SPEAKS TO THIS. Until it is applied, search still works
-- (on the existing indexes and ilike), and simply records nothing, offers no
-- popular searches, applies no staff aliases and keeps no server-side recent
-- searches; the console desk says "Search analytics are not set up yet".
--
-- AFTER APPLYING: move this file up into supabase/migrations/, record it
-- (`node scripts/check-migrations.mjs --record <file>`), and mark it applied
-- in supabase/migrations/pending/README.md. Then schedule the purge above.

-- 1. Trigram indexes ------------------------------------------------------------

create index if not exists social_profiles_handle_trgm_idx
  on public.social_profiles using gin (handle extensions.gin_trgm_ops);
create index if not exists social_profiles_display_label_trgm_idx
  on public.social_profiles using gin (display_label extensions.gin_trgm_ops);
create index if not exists circle_communities_name_trgm_idx
  on public.circle_communities using gin (name extensions.gin_trgm_ops) where status = 'live';
create index if not exists posts_title_trgm_idx
  on public.posts using gin (title extensions.gin_trgm_ops) where status = 'LIVE' and depth = 0;
create index if not exists posts_body_trgm_idx
  on public.posts using gin (body extensions.gin_trgm_ops) where status = 'LIVE' and depth = 0;
create index if not exists roommate_listings_title_trgm_idx
  on public.roommate_listings using gin (title extensions.gin_trgm_ops) where status = 'live';
create index if not exists roommate_listings_area_trgm_idx
  on public.roommate_listings using gin (area extensions.gin_trgm_ops) where status = 'live';

-- 2. Search analytics -------------------------------------------------------------

create table if not exists public.search_events (
  id            bigint generated always as identity primary key,
  event         text not null,
  query         text,
  kind          text,
  tab           text not null,
  result_count  integer,
  took_ms       integer,
  place         text,
  clicked_kind  text,
  position      smallint,
  session_hash  text,
  created_at    timestamptz not null default now(),
  constraint search_events_event_chk check (event in ('search', 'click')),
  constraint search_events_query_len check (query is null or char_length(query) between 1 and 120),
  constraint search_events_query_digits check (query is null or query !~ '([0-9][ .-]?){9,}[0-9]'),
  constraint search_events_kind_chk check (kind is null or kind in
    ('place', 'property', 'stay', 'restaurant', 'roommate', 'person', 'community', 'post', 'screen', 'guide', 'personal')),
  constraint search_events_clicked_chk check (clicked_kind is null or clicked_kind in
    ('place', 'property', 'stay', 'restaurant', 'roommate', 'person', 'community', 'post', 'screen', 'guide', 'personal')),
  constraint search_events_tab_chk check (tab in
    ('all', 'property', 'stay', 'restaurant', 'roommate', 'person', 'community', 'guide', 'personal')),
  constraint search_events_results_chk check (result_count is null or result_count between 0 and 10000),
  constraint search_events_took_chk check (took_ms is null or took_ms between 0 and 120000),
  constraint search_events_place_len check (place is null or char_length(place) <= 80),
  constraint search_events_position_chk check (position is null or position between 0 and 500),
  constraint search_events_session_chk check (session_hash is null or session_hash ~ '^[0-9a-f]{32}$')
);

alter table public.search_events enable row level security;
revoke all on table public.search_events from public, anon, authenticated;
revoke all on sequence public.search_events_id_seq from public, anon, authenticated;

create index if not exists search_events_created_idx on public.search_events (created_at desc);
create index if not exists search_events_query_idx on public.search_events (query, created_at) where query is not null and event = 'search';

create schema if not exists private;

create table if not exists private.search_event_salt (
  id    smallint primary key default 1,
  salt  text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  constraint search_event_salt_one check (id = 1)
);
revoke all on table private.search_event_salt from public, anon, authenticated;
insert into private.search_event_salt (id) values (1) on conflict (id) do nothing;

-- The words as they may be kept: no control characters, lower case, single
-- spaces, 120 characters, and nothing at all when a long digit run is there.
create or replace function private.search_clean_words(p_text text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when w is null or w = '' then null
           when w ~ '([0-9][ .-]?){9,}[0-9]' then null
           else w
         end
    from (select left(btrim(regexp_replace(lower(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g')), '\s+', ' ', 'g')), p_max) as w) s;
$$;
revoke all on function private.search_clean_words(text, integer) from public, anon, authenticated;

create or replace function public.search_event_record(
  p_event        text,
  p_query        text,
  p_kind         text,
  p_tab          text,
  p_results      integer,
  p_took_ms      integer,
  p_place        text,
  p_clicked_kind text,
  p_position     integer,
  p_session      text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  kinds constant text[] := array['place', 'property', 'stay', 'restaurant', 'roommate', 'person', 'community', 'post', 'screen', 'guide', 'personal'];
  tabs  constant text[] := array['all', 'property', 'stay', 'restaurant', 'roommate', 'person', 'community', 'guide', 'personal'];
  h     text;
begin
  -- Anything that is not the shape is dropped quietly: a beacon never errors.
  if p_event is null or p_event not in ('search', 'click') then return; end if;
  if p_tab is null or not (p_tab = any (tabs)) then return; end if;
  if p_session is not null and char_length(p_session) between 1 and 200 then
    select left(encode(extensions.digest(s.salt || ':' || p_session, 'sha256'), 'hex'), 32)
      into h from private.search_event_salt s where s.id = 1;
  end if;
  insert into public.search_events (event, query, kind, tab, result_count, took_ms, place, clicked_kind, position, session_hash)
  values (
    p_event,
    private.search_clean_words(p_query, 120),
    case when p_kind = any (kinds) then p_kind end,
    p_tab,
    case when p_results between 0 and 10000 then p_results end,
    case when p_took_ms between 0 and 120000 then p_took_ms end,
    private.search_clean_words(p_place, 80),
    case when p_clicked_kind = any (kinds) then p_clicked_kind end,
    case when p_position between 0 and 500 then p_position end,
    h
  );
end;
$$;
revoke all on function public.search_event_record(text, text, text, text, integer, integer, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.search_event_record(text, text, text, text, integer, integer, text, text, integer, text) to service_role;

create or replace function public.search_events_purge()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.search_events where created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.search_events_purge() from public, anon, authenticated;
grant execute on function public.search_events_purge() to service_role;

-- 3. Popular searches, above the floor ---------------------------------------------

create or replace function public.search_popular_queries(p_days integer default 30, p_limit integer default 8)
returns table (query text, sessions integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.query, count(distinct e.session_hash)::integer as sessions
    from public.search_events e
   where e.event = 'search'
     and e.query is not null
     and e.session_hash is not null
     and coalesce(e.result_count, 0) > 0
     and e.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 90))
   group by e.query
  having count(distinct e.session_hash) >= 3
   order by count(distinct e.session_hash) desc, count(*) desc, e.query
   limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;
revoke all on function public.search_popular_queries(integer, integer) from public;
grant execute on function public.search_popular_queries(integer, integer) to anon, authenticated, service_role;

-- 4. Staff aliases -------------------------------------------------------------------

create table if not exists public.search_aliases (
  id          uuid primary key default gen_random_uuid(),
  from_text   text not null,
  to_text     text not null,
  kind        text not null,
  active      boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint search_aliases_kind_chk check (kind in ('word', 'place')),
  constraint search_aliases_from_chk check (from_text = lower(btrim(from_text)) and char_length(from_text) between 1 and 60),
  constraint search_aliases_to_chk check (char_length(btrim(to_text)) between 1 and 60),
  constraint search_aliases_digits_chk check (from_text !~ '[0-9]{6,}' and to_text !~ '[0-9]{6,}'),
  constraint search_aliases_unique unique (from_text, kind)
);
alter table public.search_aliases enable row level security;
revoke all on table public.search_aliases from public, anon, authenticated;

create or replace function public.search_aliases_active()
returns table (from_text text, to_text text, kind text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.from_text, a.to_text, a.kind from public.search_aliases a where a.active order by a.from_text limit 500;
$$;
revoke all on function public.search_aliases_active() from public;
grant execute on function public.search_aliases_active() to anon, authenticated, service_role;

-- Who may see the desk, and who may change an alias.
create or replace function private.search_desk_reader(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.staff_can(p_user, 'analyst') or private.staff_can(p_user, 'content') or private.staff_can(p_user, 'marketing');
$$;
create or replace function private.search_desk_writer(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.staff_can(p_user, 'content') or private.staff_can(p_user, 'marketing');
$$;
revoke all on function private.search_desk_reader(uuid) from public, anon, authenticated;
revoke all on function private.search_desk_writer(uuid) from public, anon, authenticated;

create or replace function public.admin_search_aliases()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.search_desk_reader(auth.uid()) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'can_edit', private.search_desk_writer(auth.uid()),
    'aliases', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'from_text', a.from_text, 'to_text', a.to_text, 'kind', a.kind,
               'active', a.active, 'created_at', a.created_at, 'updated_at', a.updated_at)
             order by a.active desc, a.from_text)
        from public.search_aliases a), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_search_aliases() from public, anon;
grant execute on function public.admin_search_aliases() to authenticated;

create or replace function public.admin_search_alias_put(p_from text, p_to text, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor  uuid := auth.uid();
  f      text := regexp_replace(lower(btrim(coalesce(p_from, ''))), '\s+', ' ', 'g');
  t      text := regexp_replace(btrim(coalesce(p_to, '')), '\s+', ' ', 'g');
  before public.search_aliases;
  row_id uuid;
begin
  if not private.search_desk_writer(actor) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_kind is null or p_kind not in ('word', 'place') then
    return jsonb_build_object('status', 'invalid', 'reason', 'An alias is a word or a place.');
  end if;
  if char_length(f) not between 1 and 60 or char_length(t) not between 1 and 60 then
    return jsonb_build_object('status', 'invalid', 'reason', 'Both sides are 1 to 60 characters.');
  end if;
  if f ~ '[0-9]{6,}' or t ~ '[0-9]{6,}' then
    return jsonb_build_object('status', 'invalid', 'reason', 'An alias cannot carry a long number.');
  end if;
  if lower(f) = lower(t) then
    return jsonb_build_object('status', 'invalid', 'reason', 'The two sides are the same.');
  end if;
  select * into before from public.search_aliases a where a.from_text = f and a.kind = p_kind for update;
  insert into public.search_aliases as a (from_text, to_text, kind, active, created_by)
  values (f, t, p_kind, true, actor)
  on conflict (from_text, kind) do update
     set to_text = excluded.to_text, active = true, updated_at = now()
  returning a.id into row_id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor,
          case when before.id is null then 'search_alias.added' else 'search_alias.changed' end,
          'search_alias', row_id::text,
          jsonb_build_object('from', f, 'to', t, 'kind', p_kind,
                             'before', case when before.id is null then null
                                            else jsonb_build_object('to', before.to_text, 'active', before.active) end));
  return jsonb_build_object('status', 'ok', 'id', row_id);
end;
$$;
revoke all on function public.admin_search_alias_put(text, text, text) from public, anon;
grant execute on function public.admin_search_alias_put(text, text, text) to authenticated;

create or replace function public.admin_search_alias_set_active(p_id uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  hit   public.search_aliases;
begin
  if not private.search_desk_writer(actor) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_id is null or p_active is null then
    return jsonb_build_object('status', 'invalid', 'reason', 'Say which alias and whether it is on.');
  end if;
  update public.search_aliases a set active = p_active, updated_at = now()
   where a.id = p_id and a.active is distinct from p_active
  returning * into hit;
  if hit.id is null then
    if exists (select 1 from public.search_aliases a where a.id = p_id) then
      return jsonb_build_object('status', 'ok', 'unchanged', true);
    end if;
    return jsonb_build_object('status', 'not_found');
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, case when p_active then 'search_alias.enabled' else 'search_alias.disabled' end,
          'search_alias', hit.id::text,
          jsonb_build_object('from', hit.from_text, 'to', hit.to_text, 'kind', hit.kind));
  return jsonb_build_object('status', 'ok');
end;
$$;
revoke all on function public.admin_search_alias_set_active(uuid, boolean) from public, anon;
grant execute on function public.admin_search_alias_set_active(uuid, boolean) to authenticated;

-- 5. The console desk's aggregates --------------------------------------------------

create or replace function public.admin_search_overview(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90));
  floor_sessions constant integer := 3;
  out jsonb;
begin
  if not private.search_desk_reader(auth.uid()) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  with ev as (
    select * from public.search_events e where e.created_at >= since
  ), s as (
    select * from ev where event = 'search'
  )
  select jsonb_build_object(
    'status', 'ok',
    'days', least(greatest(coalesce(p_days, 7), 1), 90),
    'floor', floor_sessions,
    'searches', (select count(*) from s),
    'sessions', (select count(distinct session_hash) from s),
    'zero_results', (select count(*) from s where result_count = 0),
    'clicks', (select count(*) from ev where event = 'click'),
    'median_took_ms', (select percentile_cont(0.5) within group (order by took_ms) from s where took_ms is not null),
    'p90_took_ms', (select percentile_cont(0.9) within group (order by took_ms) from s where took_ms is not null),
    'tabs', coalesce((select jsonb_agg(jsonb_build_object('tab', tab, 'n', n) order by n desc)
                        from (select tab, count(*) n from s group by tab) t), '[]'::jsonb),
    'kinds', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'n', n) order by n desc)
                         from (select kind, count(*) n from s where kind is not null group by kind) k), '[]'::jsonb),
    'clicked_kinds', coalesce((select jsonb_agg(jsonb_build_object('kind', clicked_kind, 'n', n) order by n desc)
                                 from (select clicked_kind, count(*) n from ev where event = 'click' and clicked_kind is not null group by clicked_kind) c), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(jsonb_build_object('place', place, 'n', n) order by n desc)
                          from (select place, count(*) n from s where place is not null group by place order by count(*) desc limit 10) p), '[]'::jsonb),
    'top_queries', coalesce((select jsonb_agg(jsonb_build_object('query', query, 'searches', n, 'sessions', v, 'zero', z) order by v desc, n desc)
                               from (select query, count(*) n, count(distinct session_hash) v, count(*) filter (where result_count = 0) z
                                       from s where query is not null group by query
                                      having count(distinct session_hash) >= floor_sessions
                                      order by count(distinct session_hash) desc, count(*) desc limit 20) q), '[]'::jsonb),
    'zero_queries', coalesce((select jsonb_agg(jsonb_build_object('query', query, 'searches', n, 'sessions', v) order by v desc, n desc)
                                from (select query, count(*) n, count(distinct session_hash) v
                                        from s where query is not null and result_count = 0 group by query
                                       having count(distinct session_hash) >= floor_sessions
                                       order by count(distinct session_hash) desc, count(*) desc limit 20) q), '[]'::jsonb)
  ) into out;
  return out;
end;
$$;
revoke all on function public.admin_search_overview(integer) from public, anon;
grant execute on function public.admin_search_overview(integer) to authenticated;

-- 6. A member's own recent searches -------------------------------------------------

create table if not exists public.search_recent (
  user_id     uuid not null references auth.users (id) on delete cascade,
  query       text not null,
  searched_at timestamptz not null default now(),
  primary key (user_id, query),
  constraint search_recent_query_len check (char_length(query) between 1 and 120),
  constraint search_recent_query_digits check (query !~ '([0-9][ .-]?){9,}[0-9]')
);
alter table public.search_recent enable row level security;
revoke all on table public.search_recent from public, anon, authenticated;
grant select on table public.search_recent to authenticated;
drop policy if exists search_recent_select_own on public.search_recent;
create policy search_recent_select_own on public.search_recent
  for select to authenticated using (user_id = (select auth.uid()));
create index if not exists search_recent_user_idx on public.search_recent (user_id, searched_at desc);

create or replace function public.search_recent_remember(p_query text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  q  text := btrim(regexp_replace(regexp_replace(coalesce(p_query, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
begin
  if me is null then return; end if;
  q := left(q, 120);
  if char_length(q) < 2 or q ~ '([0-9][ .-]?){9,}[0-9]' then return; end if;
  insert into public.search_recent (user_id, query, searched_at) values (me, q, clock_timestamp())
  on conflict (user_id, query) do update set searched_at = clock_timestamp();
  -- The newest 20 are kept.
  delete from public.search_recent r
   where r.user_id = me
     and r.query not in (select x.query from public.search_recent x where x.user_id = me order by x.searched_at desc limit 20);
end;
$$;

create or replace function public.search_recent_forget(p_query text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.search_recent r where r.user_id = auth.uid() and r.query = btrim(coalesce(p_query, ''));
$$;

create or replace function public.search_recent_clear()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.search_recent r where r.user_id = auth.uid();
$$;

revoke all on function public.search_recent_remember(text) from public, anon;
revoke all on function public.search_recent_forget(text) from public, anon;
revoke all on function public.search_recent_clear() from public, anon;
grant execute on function public.search_recent_remember(text) to authenticated;
grant execute on function public.search_recent_forget(text) to authenticated;
grant execute on function public.search_recent_clear() to authenticated;

-- 7. Read back -----------------------------------------------------------------------

do $check$
declare
  fn text;
begin
  if to_regclass('public.search_events') is null or to_regclass('public.search_aliases') is null
     or to_regclass('public.search_recent') is null or to_regclass('private.search_event_salt') is null then
    raise exception 'intelligence_search: a table is missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.search_events'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.search_aliases'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.search_recent'::regclass) then
    raise exception 'intelligence_search: RLS is off on a search table';
  end if;
  if has_table_privilege('anon', 'public.search_events', 'select')
     or has_table_privilege('authenticated', 'public.search_events', 'select')
     or has_table_privilege('authenticated', 'public.search_events', 'insert')
     or has_table_privilege('anon', 'public.search_aliases', 'select')
     or has_table_privilege('authenticated', 'public.search_aliases', 'select')
     or has_table_privilege('authenticated', 'public.search_aliases', 'insert')
     or has_table_privilege('authenticated', 'public.search_aliases', 'update')
     or has_table_privilege('anon', 'public.search_recent', 'select')
     or has_table_privilege('authenticated', 'public.search_recent', 'insert')
     or has_table_privilege('authenticated', 'public.search_recent', 'update')
     or has_table_privilege('authenticated', 'public.search_recent', 'delete')
     or has_table_privilege('anon', 'private.search_event_salt', 'select')
     or has_table_privilege('authenticated', 'private.search_event_salt', 'select') then
    raise exception 'intelligence_search: a member can reach a search table directly';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'search_recent' and policyname = 'search_recent_select_own') then
    raise exception 'intelligence_search: the own-rows policy on search_recent is missing';
  end if;
  foreach fn in array array[
    'public.search_event_record(text,text,text,text,integer,integer,text,text,integer,text)',
    'public.search_events_purge()',
    'public.search_popular_queries(integer,integer)',
    'public.search_aliases_active()',
    'public.admin_search_aliases()',
    'public.admin_search_alias_put(text,text,text)',
    'public.admin_search_alias_set_active(uuid,boolean)',
    'public.admin_search_overview(integer)',
    'public.search_recent_remember(text)',
    'public.search_recent_forget(text)',
    'public.search_recent_clear()'] loop
    if to_regprocedure(fn) is null then
      raise exception '% is missing', fn;
    end if;
    if not (select p.prosecdef from pg_proc p where p.oid = to_regprocedure(fn)) then
      raise exception '% is not SECURITY DEFINER', fn;
    end if;
    if not exists (select 1 from pg_proc p where p.oid = to_regprocedure(fn) and p.proconfig @> array['search_path=""']) then
      raise exception '% does not pin an empty search_path', fn;
    end if;
  end loop;
  -- Only the service role writes analytics and purges them.
  if has_function_privilege('anon', 'public.search_event_record(text,text,text,text,integer,integer,text,text,integer,text)', 'execute')
     or has_function_privilege('authenticated', 'public.search_event_record(text,text,text,text,integer,integer,text,text,integer,text)', 'execute')
     or has_function_privilege('authenticated', 'public.search_events_purge()', 'execute') then
    raise exception 'intelligence_search: a member can write or purge analytics';
  end if;
  if not has_function_privilege('service_role', 'public.search_event_record(text,text,text,text,integer,integer,text,text,integer,text)', 'execute') then
    raise exception 'intelligence_search: the service role cannot record a search';
  end if;
  -- The console doors and the member's own list are never anon's.
  if has_function_privilege('anon', 'public.admin_search_overview(integer)', 'execute')
     or has_function_privilege('anon', 'public.admin_search_alias_put(text,text,text)', 'execute')
     or has_function_privilege('anon', 'public.search_recent_remember(text)', 'execute')
     or has_function_privilege('authenticated', 'private.search_desk_writer(uuid)', 'execute') then
    raise exception 'intelligence_search: a door is open to the wrong role';
  end if;
  -- With no caller, the console doors refuse.
  if public.admin_search_overview(7) ->> 'status' <> 'forbidden'
     or public.admin_search_aliases() ->> 'status' <> 'forbidden'
     or public.admin_search_alias_put('probe', 'probe two', 'word') ->> 'status' <> 'forbidden' then
    raise exception 'intelligence_search: a console door answered a caller with no identity';
  end if;
  -- A long digit run is never kept as words.
  if private.search_clean_words('call me on 0803 123 4567', 120) is not null
     or private.search_clean_words('  2 Bedroom   in LEKKI ', 120) <> '2 bedroom in lekki' then
    raise exception 'intelligence_search: the words cleaner is wrong';
  end if;
  raise notice 'intelligence_search_2026-11-16: self-check passed';
end
$check$;

notify pgrst, 'reload schema';
