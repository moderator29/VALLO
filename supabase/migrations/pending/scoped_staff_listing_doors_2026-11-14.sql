-- ============================================================================
-- THE LISTINGS DESK'S TWO DATABASE DOORS OPEN FOR SCOPED STAFF (14 Nov 2026).
--
-- NOT APPLIED. CHECKED AGAINST LIVE ON 14 NOVEMBER 2026 WITH READS ONLY.
-- Only the founder applies it, in the Supabase SQL editor.
--
-- WHAT BROKE AND WHEN. At 13:54 UTC today, right after staff_desks_only took
-- the admin role from the two position holders, the server crash log began
-- recording "SupabaseReadError: 42501: only staff read consent" (5 rows by
-- 14:00). The Business Development Director opened her Listings desk; the
-- page's consent read calls public.mandate_consents with HER OWN session, and
-- that function's guard is private.is_staff(), which counts only the admin
-- and super_admin roles. Her scoped grant (listing_approval) is invisible to
-- it. public.property_candidates (the property match panel on a listing's
-- review page) has the same guard and fails the same way.
--
-- WHAT THIS DOES. Both functions, exactly as live, with one guard changed:
--   is_staff()  becomes  is_staff() OR staff_can(auth.uid(), 'listing_approval')
-- private.staff_can is the existing door: an unrevoked grant carrying the
-- scope, the handbook acknowledged, and the console step-up passed. Nothing
-- else in either body changes (read back inside the transaction).
--
-- WHAT IT DOES NOT DO. It opens nothing else. admin_person_file keeps
-- refusing scoped staff (the person file is deliberately admin-only and
-- audited). The STR, referral, threshold and money functions keep their
-- admin-only guard. No table, policy or grant changes.
--
-- SAFE TO RUN TWICE: create or replace, same text.
-- TO UNDO: re-run the two function bodies with the guard line's staff_can
-- branch removed (the previous bodies are in migrations 20260924104522 and
-- the property match migration, or in git history of this file).
-- ============================================================================

begin;
set local lock_timeout = '5s';

create or replace function public.mandate_consents(p_mandates uuid[])
returns table(mandate_id uuid, consented_at timestamp with time zone, read_by_name text, withdrawn_at timestamp with time zone, has_number boolean, number_stopped_at timestamp with time zone)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not (private.is_staff() or private.staff_can((select auth.uid()), 'listing_approval')) then
    raise exception 'only staff read consent' using errcode = 'insufficient_privilege';
  end if;
  return query
  select m.id, m.principal_consented_at,
         coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.first_name), ''), 'A member of staff'),
         m.principal_consent_withdrawn_at,
         m.principal_phone is not null,
         (select max(x.principal_consent_withdrawn_at) from public.listing_mandates x
           where x.principal_phone = m.principal_phone)
    from public.listing_mandates m
    left join public.profiles p on p.id = m.principal_consent_read_by
   where m.id = any(p_mandates[1:200]);
end;
$function$;

create or replace function public.property_candidates(p_listing uuid)
returns table(listing_id uuid, reference text, title text, status listing_status, lister_name text, property_id uuid, same_principal boolean, different_principal boolean, distance_m integer, same_shape boolean, move_in_total_minor bigint)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  me public.listings%rowtype;
  my_key text;
begin
  if not (private.is_staff() or private.staff_can((select auth.uid()), 'listing_approval')) then
    raise exception 'only staff may see proposed property matches' using errcode = 'insufficient_privilege';
  end if;
  select * into me from public.listings where id = p_listing;
  if not found then
    return;
  end if;
  my_key := private.listing_principal_key(p_listing);

  return query
  with pool as (
    select c.*,
           private.listing_principal_key(c.id) as their_key,
           case when me.location is not null and c.location is not null
                then round(extensions.st_distance(me.location, c.location))::integer end as metres,
           (c.bedrooms = me.bedrooms and c.property_type = me.property_type) as shape_match
      from public.listings c
     where c.id <> me.id
       and c.is_demo = false
       and me.is_demo = false
       and c.closed_at is null
       and c.listing_intent = me.listing_intent
       and c.status in ('SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'APPROVED', 'PUBLISHED')
       and (me.property_id is null or c.property_id is distinct from me.property_id)
       and not exists (
         select 1 from public.property_decisions d
          where d.decision = 'kept_apart'
            and ((d.listing_id = me.id and d.other_listing_id = c.id)
              or (d.listing_id = c.id and d.other_listing_id = me.id)))
  )
  select p.id, p.reference, p.title, p.status,
         coalesce(nullif(btrim(b.name), ''), nullif(btrim(a.display_name), '')),
         p.property_id,
         (my_key is not null and p.their_key = my_key),
         (my_key is not null and p.their_key is not null and p.their_key <> my_key),
         p.metres, p.shape_match, p.total_move_in_cost_minor
    from pool p
    left join public.agents a on a.id = p.agent_id
    left join public.businesses b on b.id = p.firm_id
   where p.shape_match
     and ((my_key is not null and p.their_key = my_key) or (p.metres is not null and p.metres <= 40))
   order by (my_key is not null and p.their_key = my_key) desc, p.metres nulls last
   limit 12;
end;
$function$;

-- READ-BACK, inside the transaction: both guards carry the scoped door, and
-- the person file does NOT (it stays admin-only by design). Anything else
-- keeps nothing.
do $$
declare
  src text;
begin
  select prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mandate_consents';
  if src not like '%staff_can((select auth.uid()), ''listing_approval'')%' then
    raise exception 'mandate_consents did not take the scoped door';
  end if;
  select prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'property_candidates';
  if src not like '%staff_can((select auth.uid()), ''listing_approval'')%' then
    raise exception 'property_candidates did not take the scoped door';
  end if;
  select prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'admin_person_file';
  if src like '%staff_can%' then
    raise exception 'admin_person_file changed; it must stay admin-only';
  end if;
end
$$;

commit;

-- One row to read: both functions now name the scoped door.
select p.proname,
       (prosrc like '%staff_can((select auth.uid()), ''listing_approval'')%') as scoped_door
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('mandate_consents', 'property_candidates')
 order by p.proname;
-- expect: both rows true.
