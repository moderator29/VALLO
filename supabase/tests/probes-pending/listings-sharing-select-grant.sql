-- LISTINGS-SHARING-SELECT-GRANT: a lister, and a visitor, can read whether a
-- property is good for sharing and for how many people.
--
-- PENDING until `supabase/migrations/pending/listings_sharing_select_grant_2026-11-11.sql`
-- is applied. It fails today, which is the point.
--
-- `public.listings` grants SELECT per column, not per table, so a column
-- added to it afterwards is readable by nobody. `roommates_3_integrations`
-- added `shared_living_ok` and `max_occupants` and granted neither. The
-- write side is fine, because `roommate_set_listing_sharing` is SECURITY
-- DEFINER; only the read is refused, with 42501, which is why nothing
-- noticed. `/agent/listings/<id>/sharing` reads both columns through the
-- lister's own client, gets the whole statement refused, and tells the
-- lister their own listing is not theirs. Live, on 11 November 2026, not one
-- listing had `shared_living_ok` set: nobody has ever reached the form.
--
-- The repo's db-06 probe could not see this, because it read table grants.
-- It reads column grants now, which is the other half of this fix.
--
-- Rolls back always.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  shared boolean;
  most   smallint;
  held   text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated',
                      'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);

  -- CONTROL: the columns this table has always published are still readable,
  -- so a probe that is refused everything cannot pass.
  perform id, title, bedrooms from public.listings limit 1;

  -- THE ONE THIS PROBE EXISTS FOR.
  begin
    select l.shared_living_ok, l.max_occupants into shared, most
      from public.listings l limit 1;
  exception when insufficient_privilege then
    raise exception 'PROBE_FAIL listings-sharing-select-grant: a member cannot read shared_living_ok, so Good for sharing is unreachable for everybody';
  end;

  -- And for a signed-out visitor, because the line belongs on the public
  -- listing page, which loads as anon.
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    select l.shared_living_ok, l.max_occupants into shared, most
      from public.listings l limit 1;
  exception when insufficient_privilege then
    raise exception 'PROBE_FAIL listings-sharing-select-grant: a visitor cannot read shared_living_ok, so the public listing never shows the line';
  end;

  -- STILL REDACTED. This grant adds two columns and takes nothing away: the
  -- address and the coordinates stay behind the service role.
  foreach held in array array['address', 'latitude', 'longitude', 'review_notes'] loop
    if has_column_privilege('anon', 'public.listings', held, 'SELECT') then
      raise exception 'PROBE_FAIL listings-sharing-select-grant: anon can read listings.%', held;
    end if;
    if has_column_privilege('authenticated', 'public.listings', held, 'SELECT') then
      raise exception 'PROBE_FAIL listings-sharing-select-grant: a member can read listings.%', held;
    end if;
  end loop;

  reset role;
  raise exception 'PROBE_OK listings-sharing-select-grant';
end $$;
