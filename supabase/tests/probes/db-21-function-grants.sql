-- DB-21: WHO MAY EXECUTE THIS PROJECT'S FUNCTIONS. Nothing read a function
-- grant before this probe existed.
--
-- db-06 reads table privileges and, since 11 November, column privileges. It
-- stops there, and a grant in Postgres is per table, per column OR PER
-- FUNCTION. On this platform almost every write a member can make goes
-- through a SECURITY DEFINER function rather than a table, so the function
-- grant IS the authorisation surface, and until 12 November 2026 nothing in
-- this repository looked at one. Two live defects were sitting in that gap:
--
--   `lib/landlord/queries.ts` records 1,678 refusals of
--   `listing_landlord_facts` between 9 and 12 November, because `/search` and
--   the listing page asked a function granted only to `authenticated` for
--   every signed-out visitor. The grant was right and the caller was wrong,
--   and nothing could say which.
--
--   `circle_update_community` and `circle_remove_member` each carry
--   `revoke all on function ... from public` in their own migration and were
--   STILL executable by `anon`, because this project's `alter default
--   privileges` grants EXECUTE on new functions to `anon`, `authenticated`
--   and `service_role` by name, on top of Postgres's own built-in grant to
--   the PUBLIC pseudo-role. `revoke ... from public` removes exactly one of
--   those entries. `accept_circle_invite` and `decline_circle_invite` were
--   never revoked from anything and hold both.
--
-- THE RULE THIS PINS, and its scope. A VOLATILE SECURITY DEFINER function in
-- `public` is a write that runs with the owner's rights. Those are the ones
-- where the grant is the whole wall, so:
--
--   1. `anon` may execute one only if it is on ANON_OK below: a door built
--      for somebody with no account, which on this platform means a signed
--      token (the landlord's reply link, a safety share, a calendar feed), a
--      public page, or a beacon that records no person.
--   2. the PUBLIC pseudo-role may execute none of them. PUBLIC is not a role
--      anybody connects as, so a PUBLIC grant is never the intent; what it
--      does is make a later `revoke ... from anon` appear to work while
--      changing nothing.
--   3. a function the app calls for a signed-in member must be executable by
--      `authenticated`, which is the landlord defect from the other side.
--
-- WHAT IS DELIBERATELY NOT A RULE: "every function in public is reachable by
-- somebody other than the service role". About 150 of them are reachable by
-- the service role alone, and that is correct rather than a smell: PostgREST
-- only exposes `public`, so a function the server calls with the service key
-- has to live there even though no member may run it. Counted live on 12
-- November 2026 before this probe was written, so that the rule was dropped
-- on evidence rather than kept and then silenced with a 150-name allowlist.
--
-- STABLE and IMMUTABLE functions are out of scope and said so plainly: 18 of
-- them hold a PUBLIC grant today (the catalogue readers, `area_*`,
-- `comparable_*`, `stays_search`, `unaccent_immutable` and so on), they are
-- SECURITY INVOKER reads that RLS already binds, and sweeping them would mean
-- an allowlist long enough to hide the next one. If a stable function is ever
-- made SECURITY DEFINER it enters rules 1 and 2 by itself.
--
-- PENDING is the db-06 `colpending` device: a name there may be in either
-- state, so this probe is green on both sides of the founder running
-- `migrations/pending/function_execute_grants_2026-11-12.sql`. A name that no
-- longer exists as a function fails the probe, so the list cannot rot into a
-- lie about something that is not there.
--
-- Read FOR the named roles (has_function_privilege, aclexplode over
-- pg_proc.proacl), never from information_schema, which answers about whoever
-- is observing. Nothing is written.
do $$
declare
  -- Volatile SECURITY DEFINER functions a signed-out caller is MEANT to reach.
  anon_ok constant text[] := array[
    'calendar_feed',              -- an iCal feed, by its own secret token
    'landlord_line_answer',       -- the landlord's reply link, by token
    'landlord_line_stop',         -- the same link's opt out, by token
    'record_funnel_event',        -- the first-party beacon; records no person
    'roommate_home',              -- a public Roommates page
    'roommate_institution_page',  -- a public Roommates page
    'submit_doc_feedback'];       -- helpful/not on a documentation page
  -- Waiting on migrations/pending/function_execute_grants_2026-11-12.sql.
  -- Tolerated in either state; every name must still exist.
  pending constant text[] := array[
    'accept_circle_invite', 'decline_circle_invite',
    'circle_remove_member', 'circle_update_community',
    'roommate_home', 'roommate_institution_page'];
  r record;
  n text;
  bad text := '';
begin
  -- 1 and 2: every volatile SECURITY DEFINER function in public.
  for r in
    select p.proname,
           p.oid::regprocedure::text as sig,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_can,
           exists (select 1 from aclexplode(p.proacl) a
                    where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_can
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.prokind in ('f', 'p')
       and p.prosecdef and p.provolatile = 'v'
     order by p.proname
  loop
    if r.anon_can and not (r.proname = any (anon_ok)) and not (r.proname = any (pending)) then
      bad := bad || format(' [anon may execute %s: either revoke it from public, anon or add it to ANON_OK here]', r.sig);
    end if;
    if r.public_can and not (r.proname = any (pending)) then
      bad := bad || format(' [PUBLIC may execute %s: add `revoke all on function ... from public, anon`]', r.sig);
    end if;
  end loop;

  -- The pending list cannot name something that is not there.
  foreach n in array pending loop
    if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                    where ns.nspname = 'public' and p.proname = n) then
      bad := bad || format(' [PENDING names %s, which is not a function in public]', n);
    end if;
  end loop;

  -- 3: the landlord defect from the other side. These are called for a
  -- signed-in member on surfaces open to strangers, so the grant must be
  -- there AND the caller must check for a session (`lib/landlord/queries.ts`).
  foreach n in array array[
    'public.listing_landlord_facts(uuid[])',
    'public.property_offers(uuid)',
    'public.rent_landlord_fact(uuid)',
    'public.mandate_consents(uuid[])'
  ] loop
    if not has_function_privilege('authenticated', n, 'EXECUTE') then
      bad := bad || format(' [authenticated may NOT execute %s, which members'' pages call]', n);
    end if;
    if has_function_privilege('anon', n, 'EXECUTE') then
      bad := bad || format(' [anon may execute %s, which holds a landlord''s facts]', n);
    end if;
  end loop;

  -- CONTROL: the probe is reading something. One door that is open to a
  -- stranger by design, and two member writes that are correctly shut.
  if not has_function_privilege('anon', 'public.record_funnel_event(text, uuid, text, text, text)', 'EXECUTE') then
    bad := bad || ' [CONTROL anon may not reach the funnel beacon, so this probe is reading the wrong thing]';
  end if;
  foreach n in array array[
    'public.circle_create_community(text, text, text, text, text, text[], text, uuid, boolean)',
    'public.circle_join(uuid)'
  ] loop
    if has_function_privilege('anon', n, 'EXECUTE') then
      bad := bad || format(' [CONTROL anon may execute %s]', n);
    end if;
    if not has_function_privilege('authenticated', n, 'EXECUTE') then
      bad := bad || format(' [CONTROL authenticated may not execute %s]', n);
    end if;
  end loop;

  if bad <> '' then
    raise exception 'PROBE_FAIL db-21-function-grants:%', bad;
  end if;
  raise exception 'PROBE_OK db-21-function-grants';
end
$$;
