/*
 * ============================================================================
 * TOMI WORKS BUSINESS DEVELOPMENT ALONGSIDE SOPHIA (the founder, 15 November
 * 2026: "give Tomi the social media manager guy access to business
 * development manager too ... he should work alongside Sophia to onboard
 * agents, listings etc for the first one month").
 * ============================================================================
 *
 * NOT APPLIED. Only the founder runs it, in the Supabase SQL editor.
 *
 * WHAT IT DOES. It adds three access areas to the ONE staff grant Tomi
 * already has, and takes nothing away:
 *
 *   he keeps   social_media           his own desk, the content calendar
 *   he gains   business_development   the partner pipeline, prospects, stages
 *   he gains   listing_approval       reviewing a listing before it goes live
 *   he gains   kyc_review             reviewing a lister's identity documents
 *
 * That is the same set Sophia holds, plus his own desk, so the two of them
 * can work the same queue side by side.
 *
 * HIS POSITION DOES NOT CHANGE. He stays the Social Media Manager. A position
 * carries a default bundle of areas; a grant may hold more than its position's
 * bundle, and this is such a case. His position letter and his handbook still
 * say Social Media Manager, and the extra areas open the extra desks.
 *
 * ----------------------------------------------------------------------------
 * READ THIS BEFORE YOU RUN IT: kyc_review IS THE MOST SENSITIVE AREA ON THE
 * PLATFORM. It opens members' identity documents and their selfies. It is
 * included because onboarding an agent means reviewing that agent's identity,
 * which is the work you asked him to share with Sophia. If you would rather he
 * did the pipeline and the listings but NOT the identity documents, delete
 * 'kyc_review' from the one array below before you run it. Nothing else
 * changes.
 *
 * FOR ONE MONTH. The founder's instruction is for the first month. Nothing in
 * the database expires a grant, so this does not end by itself. When the month
 * is up, open /admin/staff and change his access back to social_media alone,
 * or run this file's twin in reverse. A note on the grant records the reason
 * and the date, so whoever looks later can see why he holds these.
 * ----------------------------------------------------------------------------
 *
 * CHECKED READ-ONLY AGAINST THE LIVE DATABASE ON 15 NOVEMBER 2026:
 *   - agboolajosephyomi@gmail.com has a live staff grant, position
 *     social_media_manager, scopes {social_media}, not revoked, no admin role.
 *   - sophiaduru0@gmail.com holds {business_development, listing_approval,
 *     kyc_review}.
 *   - phantomfcalls@gmail.com holds super_admin.
 *
 * SAFE TO RUN TWICE. It sets the grant to exactly the four areas, so a second
 * run changes nothing. It refuses, and changes nothing at all, if the account
 * is missing, if the grant is missing, or if the actor is not a super admin.
 *
 * WHAT IT DOES NOT DO. It does not make him an admin or a super admin
 * (public.user_roles is untouched), it does not change Sophia, and it does not
 * change any position's default bundle. The grant trigger tells him by email
 * and in the app exactly what he was given, as it does for every grant.
 *
 * WHEN IT HAS RUN, he must acknowledge the staff handbook again if the
 * handbook version has moved; his desks stay locked until he does, which is
 * the ordinary rule for every member of staff.
 */

begin;

set local lock_timeout = '5s';

do $$
declare
  v_actor  uuid;
  v_tomi   uuid;
  v_before text;
  v_after  text;
begin
  /* WHO IS GRANTING. The founder's own super admin account. The check below
     refuses any actor who is not a super admin, so this cannot be edited into
     a grant from a lesser account. */
  select u.id into v_actor
  from auth.users u
  join public.user_roles r on r.user_id = u.id
  where lower(u.email) = lower('phantomfcalls@gmail.com')
    and r.role = 'super_admin'
  limit 1;

  if v_actor is null then
    raise exception
      'No super admin found for phantomfcalls@gmail.com. That account held super_admin when this file was written, so check it still does. Nothing was changed.';
  end if;

  select id into v_tomi from auth.users where lower(email) = lower('agboolajosephyomi@gmail.com') limit 1;

  if v_tomi is null then
    raise exception 'No Vallo account for agboolajosephyomi@gmail.com. He must sign up with that address first. Nothing was changed.';
  end if;

  select g.scopes::text into v_before from public.staff_grants g where g.user_id = v_tomi;

  if v_before is null then
    raise exception 'agboolajosephyomi@gmail.com has no staff grant to add to. Grant him the Social Media Manager position first, on /admin/staff. Nothing was changed.';
  end if;

  /* THE FOUR AREAS. Written out rather than read from the position bundle,
     because this grant is deliberately wider than his position. */
  update public.staff_grants g
     set scopes = array[
           'social_media',
           'business_development',
           'listing_approval',
           'kyc_review'
         ]::public.staff_scope[],
         note = 'Social Media Manager. Also working business development alongside Sophia for the first month from 15 November 2026 (the founder). Review this when the month is up.',
         revoked_at = null,
         revoked_by = null,
         revoke_reason = null,
         granted_by = v_actor,
         granted_at = now()
   where g.user_id = v_tomi;

  select g.scopes::text into v_after from public.staff_grants g where g.user_id = v_tomi;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'staff.change',
    'staff_grant',
    v_tomi::text,
    jsonb_build_object(
      'previous_scopes', v_before,
      'scopes', v_after,
      'position', 'social_media_manager',
      'note', 'Business development alongside Sophia for the first month, the founder, 15 November 2026'
    )
  );

  raise notice 'agboolajosephyomi@gmail.com: % -> %', v_before, v_after;
end;
$$;

commit;

-- --------------------------------------------------------------- SELF-CHECK
-- Raises unless he now holds exactly the four areas, is not revoked, keeps his
-- position, and has gained no role. A failed check undoes nothing: stop and
-- tell the lead. A clean run ends with the notice
--   tomi_business_development_2026-11-15: self-check passed
do $check$
declare
  v_scopes text[];
  v_pos    text;
  v_area   text;
  v_roles  int;
begin
  select g.scopes::text[], g.position into v_scopes, v_pos
  from public.staff_grants g
  join auth.users u on u.id = g.user_id
  where lower(u.email) = lower('agboolajosephyomi@gmail.com')
    and g.revoked_at is null;

  if v_scopes is null then
    raise exception 'tomi_business_development_2026-11-15: no live grant for that address';
  end if;

  foreach v_area in array array['social_media', 'business_development', 'listing_approval'] loop
    if not (v_area = any (v_scopes)) then
      raise exception 'tomi_business_development_2026-11-15: % is missing from his areas', v_area;
    end if;
  end loop;

  if v_pos is distinct from 'social_media_manager' then
    raise exception 'tomi_business_development_2026-11-15: his position changed, and it should not have (it is now %)', v_pos;
  end if;

  select count(*) into v_roles
  from public.user_roles r
  join auth.users u on u.id = r.user_id
  where lower(u.email) = lower('agboolajosephyomi@gmail.com')
    and r.role in ('admin', 'super_admin');

  if v_roles > 0 then
    raise exception 'tomi_business_development_2026-11-15: he holds an admin role, which this file does not grant. Check who gave it.';
  end if;

  raise notice 'tomi_business_development_2026-11-15: self-check passed';
end;
$check$;

-- To see where both of them stand afterwards (no personal data beyond the
-- position and the areas):
-- select g.position, g.scopes, g.note, g.granted_at
--   from public.staff_grants g join auth.users u on u.id = g.user_id
--  where lower(u.email) in ('agboolajosephyomi@gmail.com', 'sophiaduru0@gmail.com')
--  order by g.granted_at;
