-- A GRANT NO POLICY BACKS. The inverse of Supabase lint 0008.
--
-- WHY THIS PROBE EXISTS. The advisor tells you when a table has row level
-- security on and no policy, and judges it INFO, correctly: no policy plus no
-- grant is a table closed twice, which is this platform's deliberate
-- server-only pattern. The dangerous shape is the other way round and no
-- advisor reports it: a table where anon or authenticated HOLDS a privilege
-- that NO POLICY BACKS. PostgREST answers that read with 200 and an empty
-- array. Nothing fails, nothing is logged, no alert is raised. It reaches the
-- founder as "the page is empty" and reaches the team as nothing at all.
--
-- WHAT IT CHECKS. For every table in `public` with row level security on, and
-- every SELECT, INSERT, UPDATE or DELETE privilege anon or authenticated
-- holds on it, there must be at least one policy for that command (or for ALL)
-- that applies to that role. A privilege with no backing policy is listed.
--
-- IT ASKS has_table_privilege AND NOT information_schema, and that is not a
-- style choice. information_schema's grant views list only the grants the
-- OBSERVING role is party to, so a check written against role_table_grants
-- can come back empty under one role and full under another, and pass by
-- seeing nothing. Two applied migrations made exactly that mistake and
-- `supabase/tests/probes/info-schema-guards.sql` exists because of it. The
-- same question asked both ways on 13 November 2026 agreed at 19 rows, which
-- is corroboration rather than permission to use the easier view.
--
-- MEASURED WHEN WRITTEN, 13 November 2026, project uccixoonmbhrnyczyigt:
-- 19 rows, every one of them `anon` with SELECT, on the Roommates and Circle
-- tables plus account_deletion_requests, business_transfers and
-- terms_acceptances. Every policy on those tables names `authenticated` only,
-- deliberately, because Roommates and Circle are signed-in features. So all 19
-- are DEAD SURFACE rather than a live defect: the privilege does nothing
-- because no policy lets a row through. A twentieth row is the thing to look
-- at, and the question to ask about it is whether any signed-out page reads
-- that table, because if one does it is showing an empty screen and saying
-- nothing. On 13 November none did: every reader of those 19 is a signed-in
-- surface, so every real read runs as `authenticated`, which does have a
-- policy.
--
-- It checks nothing about a table with no row level security at all; that is
-- lint 0013's job and a different failure. It cannot tell a deliberate dead
-- grant from a missing policy either, which is why the baseline is a number a
-- person set after reading all 19 rather than a rule.
--
-- Read only. It writes nothing, so there is nothing to roll back, and it ends
-- by raising its own PROBE_OK as the harness requires.

do $$
declare
  n integer;
  found text;
begin
  with t as (
    select c.oid, c.relname
      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  ), held as (
    select t.oid, t.relname as tbl, r.rolname as grantee, v.priv, v.cmd
      from t
      cross join (values ('anon'), ('authenticated')) rr(rolname)
      join pg_roles r on r.rolname = rr.rolname
      cross join (values ('SELECT', 'r'), ('INSERT', 'a'),
                         ('UPDATE', 'w'), ('DELETE', 'd')) v(priv, cmd)
     where has_table_privilege(r.oid, t.oid, v.priv)
  ), bare as (
    select held.tbl, held.grantee, held.priv
      from held
     where not exists (
       select 1 from pg_policy p
        where p.polrelid = held.oid
          and (p.polcmd = '*' or p.polcmd = held.cmd)
          and (p.polroles = '{0}'
               or exists (select 1 from pg_roles r2
                           where r2.oid = any(p.polroles) and r2.rolname = held.grantee)))
  )
  select count(*), coalesce(string_agg(tbl || ' ' || grantee || ' ' || priv, '; ' order by tbl, grantee, priv), '')
    into n, found
    from bare;

  -- The baseline is the 19 read and judged on 13 November 2026. The list may
  -- SHRINK (a revoke) and must not grow without somebody reading the new row.
  -- A privilege granted together with its policy never appears here at all.
  if n > 19 then
    raise exception 'PROBE_FAIL grant-without-a-policy: % privilege(s) no policy backs, above the baseline of 19. Each one is a read that answers empty and says nothing. %', n, found;
  end if;

  raise exception 'PROBE_OK grant-without-a-policy: % privilege(s) with no backing policy, at or below the baseline of 19. %', n, found;
end $$;
