-- ============================================================================
-- STAFF SEE THEIR OWN DESKS, NOT THE WHOLE CONSOLE (the founder, 14 November
-- 2026: "it should only be their desk and other things they need to do their
-- works ... users ID review, listing reviews ... and the social media manager
-- sees his own too").
--
-- NOT APPLIED. CHECKED AGAINST LIVE ON 14 NOVEMBER 2026 WITH READS ONLY.
-- Only the founder applies it, in the Supabase SQL editor.
--
-- WHAT LIVE HOLDS TODAY. The Business Development Director and the Social
-- Media Manager each hold a staff position AND the `admin` role (given on 12
-- November). The role opens every desk on the console: money, identity
-- documents, every member's records. Their positions need far less.
--
-- WHAT THIS DOES.
--   1. The Business Development position's bundle gains `kyc_review`, so a
--      holder reviews identity checks as well as listings. The same change
--      is in the app (lib/admin/staff-positions.ts).
--   2. Whoever holds that position today gets `kyc_review` on their grant.
--      The grant's own trigger tells them, by bell and by email.
--   3. The `admin` role is taken from the holders of those two positions.
--      Never `super_admin`, and nobody else's role is touched. Each removal
--      is written to the audit log and the person is told in the app.
--
-- AFTER IT RUNS, each of them sees a short console with only their desks:
--   Business Development Director: Business development, Listings, KYC.
--   Social Media Manager: Social media.
-- Their desks open once they have read and acknowledged the staff handbook
-- (neither has yet); until then the console shows them the handbook.
--
-- SAFE TO RUN TWICE: the second run changes nothing and tells nobody.
-- TO UNDO: give the role back on the Staff desk, or
--   insert into public.user_roles (user_id, role) values ('<their id>', 'admin');
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- 1. The position's bundle. The whole function, as live, with one line changed.
create or replace function private.staff_position_scopes(p_position text)
returns public.staff_scope[]
language sql
immutable
set search_path to ''
as $function$
  select case p_position
    when 'moderator' then array['moderation']::public.staff_scope[]
    when 'support_agent' then array['support']::public.staff_scope[]
    when 'kyc_reviewer' then array['kyc_review']::public.staff_scope[]
    when 'listings_reviewer' then array['listing_approval']::public.staff_scope[]
    when 'agreements_officer' then array['agreements', 'guarantee']::public.staff_scope[]
    when 'trust_safety_lead' then array['listing_approval', 'kyc_review', 'moderation', 'support']::public.staff_scope[]
    when 'compliance_officer' then array['kyc_review', 'compliance']::public.staff_scope[]
    when 'finance_officer' then array['guarantee', 'finance']::public.staff_scope[]
    when 'operations_manager' then array['support', 'agreements', 'operations']::public.staff_scope[]
    when 'cfo' then array['agreements', 'guarantee', 'finance', 'compliance']::public.staff_scope[]
    when 'coo' then array['listing_approval', 'moderation', 'support', 'agreements', 'operations']::public.staff_scope[]
    when 'ceo' then array['listing_approval', 'kyc_review', 'moderation', 'support', 'agreements', 'guarantee',
                          'finance', 'compliance', 'operations']::public.staff_scope[]
    when 'business_development_executive' then array['business_development', 'listing_approval', 'kyc_review']::public.staff_scope[]
    when 'social_media_manager' then array['social_media']::public.staff_scope[]
    when 'marketing_manager' then array['marketing']::public.staff_scope[]
    when 'content_manager' then array['content']::public.staff_scope[]
    when 'technical_administrator' then array['technical']::public.staff_scope[]
    when 'customer_support_lead' then array['support', 'support_lead']::public.staff_scope[]
  end;
$function$;

-- 2 and 3, with the audit lines and the note to each person.
do $$
declare
  v_founder uuid := (select f.user_id from private.founder_accounts f order by f.user_id limit 1);
  r record;
begin
  for r in
    update public.staff_grants g
       set scopes = array_append(g.scopes, 'kyc_review'::public.staff_scope)
     where g.position = 'business_development_executive'
       and g.revoked_at is null
       and not ('kyc_review' = any (g.scopes::text[]))
    returning g.user_id, g.scopes
  loop
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (v_founder, 'staff.grant', 'staff_grant', r.user_id::text,
            jsonb_build_object('scopes', to_jsonb(r.scopes::text[]),
                               'position', 'business_development_executive',
                               'note', 'Identity review added to the Business Development position (founder, 14 November 2026).'));
  end loop;

  for r in
    delete from public.user_roles ur
     using public.staff_grants g
     where ur.user_id = g.user_id
       and ur.role = 'admin'::public.app_role
       and g.revoked_at is null
       and g.position in ('business_development_executive', 'social_media_manager')
    returning ur.user_id, g.position
  loop
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (v_founder, 'staff.role_revoke', 'user_role', r.user_id::text,
            jsonb_build_object('role', 'admin',
                               'note', 'The position''s own desks only (founder, 14 November 2026). The staff position is unchanged.'));
    begin
      perform private.notify(
        r.user_id,
        'system'::public.notification_kind,
        'Your console now shows your own desks',
        'Your account no longer carries the administrator role, so the console shows the desks of your position and nothing else. '
        || 'Read and acknowledge the staff handbook to open them. Your position and your work are unchanged.',
        '/admin');
    exception when others then
      /* A bell that does not ring must not undo the change. */
      null;
    end;
  end loop;
end
$$;

-- READ-BACK, inside the transaction: if anything is not as written, nothing is kept.
do $$
begin
  if not ('kyc_review' = any (private.staff_position_scopes('business_development_executive')::text[])) then
    raise exception 'the Business Development bundle does not hold kyc_review';
  end if;
  if private.staff_position_scopes('social_media_manager')::text[] <> array['social_media'] then
    raise exception 'the Social Media bundle changed';
  end if;
  if exists (select 1 from public.staff_grants g
              where g.position = 'business_development_executive' and g.revoked_at is null
                and not ('kyc_review' = any (g.scopes::text[]))) then
    raise exception 'a Business Development grant is missing kyc_review';
  end if;
  if exists (select 1 from public.user_roles ur join public.staff_grants g on g.user_id = ur.user_id
              where ur.role = 'admin'::public.app_role and g.revoked_at is null
                and g.position in ('business_development_executive', 'social_media_manager')) then
    raise exception 'a holder of one of the two positions still has the admin role';
  end if;
  if (select count(*) from public.user_roles where role = 'super_admin'::public.app_role) < 1 then
    raise exception 'no super admin is left';
  end if;
end
$$;

commit;

select g.position,
       g.scopes::text[] as access,
       coalesce((select string_agg(ur.role::text, ', ' order by ur.role::text)
                   from public.user_roles ur
                  where ur.user_id = g.user_id and ur.role::text in ('admin', 'super_admin')), 'none') as admin_roles,
       exists (select 1 from public.staff_handbook_acks a
                where a.user_id = g.user_id and a.version = private.staff_handbook_version()) as handbook_acknowledged
  from public.staff_grants g
 where g.revoked_at is null
   and g.position in ('business_development_executive', 'social_media_manager')
 order by g.position;
-- expect: business_development_executive with kyc_review in access and admin_roles = none;
--         social_media_manager with {social_media} and admin_roles = none.
