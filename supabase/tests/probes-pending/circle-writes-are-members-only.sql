-- CIRCLE-WRITES-ARE-MEMBERS-ONLY (migration
-- supabase/migrations/pending/function_execute_grants_2026-11-12.sql, NOT APPLIED):
--  1. anon holds no EXECUTE on the four Circle member writes
--  2. PUBLIC holds no EXECUTE on them either, which is the half a
--     `revoke ... from anon` alone would leave behind
--  3. authenticated still holds EXECUTE on all four
--  4. CONTROL: circle_create_community and circle_join, whose migration wrote
--     `from public, anon`, already pass 1 and 2 today
--  5. CONTROL: the anon-by-design Circle and Roommates reads keep their anon
--     grant, and lose PUBLIC
--
-- FAILS BEFORE THE MIGRATION on 1 and 2: `circle_update_community` and
-- `circle_remove_member` each carry `revoke all on function ... from public`
-- in their own migration and are still `anon=X` live, because the anon grant
-- comes from this project's `alter default privileges` and is a separate,
-- named grant; `accept_circle_invite` and `decline_circle_invite` were never
-- revoked from anything and carry PUBLIC as well.
--
-- Read from the catalogue FOR the named roles (has_function_privilege and
-- aclexplode), never from information_schema, which answers about whoever is
-- observing. Nothing is written, and the final raise rolls the transaction
-- back anyway.
do $$
declare
  writes constant text[] := array[
    'public.circle_update_community(uuid, text, text, text, text[])',
    'public.circle_remove_member(uuid, uuid)',
    'public.accept_circle_invite(uuid)',
    'public.decline_circle_invite(uuid)'];
  controls constant text[] := array[
    'public.circle_create_community(text, text, text, text, text, text[], text, uuid, boolean)',
    'public.circle_join(uuid)'];
  reads constant text[] := array[
    'public.circle_home_stats()',
    'public.circle_community_active(uuid[])',
    'public.roommate_home()',
    'public.roommate_institution_page(text)',
    'public.roommate_listing_view(uuid)',
    'public.roommate_search_listings(jsonb)'];
  f text;
  bad text := '';
begin
  -- 1 and 2: the member writes.
  foreach f in array writes loop
    if has_function_privilege('anon', f, 'EXECUTE') then
      bad := bad || format(' [anon may execute %s]', f);
    end if;
    if exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                where p.oid = f::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      bad := bad || format(' [PUBLIC may execute %s]', f);
    end if;
    -- 3: and a member still can, or the revoke took the wrong thing with it.
    if not has_function_privilege('authenticated', f, 'EXECUTE') then
      bad := bad || format(' [authenticated may NOT execute %s]', f);
    end if;
  end loop;

  -- 4: the two that were written correctly, as the control for the diagnosis.
  foreach f in array controls loop
    if has_function_privilege('anon', f, 'EXECUTE') then
      bad := bad || format(' [CONTROL anon may execute %s]', f);
    end if;
    if not has_function_privilege('authenticated', f, 'EXECUTE') then
      bad := bad || format(' [CONTROL authenticated may NOT execute %s]', f);
    end if;
  end loop;

  -- 5: the reads a signed-out visitor is meant to reach are untouched. The
  -- Roommates four keep anon and lose only PUBLIC, which is what section 4 of
  -- the migration does.
  foreach f in array reads loop
    if not has_function_privilege('anon', f, 'EXECUTE') then
      bad := bad || format(' [anon may NOT execute %s, which a public page needs]', f);
    end if;
    if exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                where p.oid = f::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      bad := bad || format(' [PUBLIC may execute %s]', f);
    end if;
  end loop;

  if bad <> '' then
    raise exception 'PROBE_FAIL circle-writes-are-members-only:%', bad;
  end if;
  raise exception 'PROBE_OK circle-writes-are-members-only';
end
$$;
