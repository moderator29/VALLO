/*
 * PROMOTE TWO PEOPLE TO ADMIN, AND GIVE THEM THEIR POSITIONS
 * (the founder, 12 November 2026).
 *
 *   sophiaduru0@gmail.com         admin + Business Development Director
 *   agboolajosephyomi@gmail.com   admin + Social Media Manager
 *
 * BOTH ACCOUNTS NOW EXIST. Checked against the live database before this was
 * written: sophiaduru0 signed up 12 Nov 20:00, agboolajosephyomi 12 Nov 20:46.
 * Both currently hold the plain `user` role and no staff grant. So this file
 * is ready to run, unlike the earlier one.
 *
 * ONE THING TO DECIDE BEFORE YOU RUN IT, because it is not reversible by
 * accident. `admin` is a PLATFORM-WIDE role, not a job title. Reading
 * `requireConsole` in lib/admin/guard.ts:
 *
 *   if (!staff.isAdmin && !staff.isSuperAdmin && staff.scopes.length === 0)
 *     return not-admin;
 *
 * The console opens on EITHER the admin role OR staff scopes. So section 2
 * alone, the positions, is already enough to let each of them into the console
 * and onto the desks their job needs, and nothing more. Section 1, the admin
 * role, is broader than either job: an admin is an admin everywhere the
 * console checks `isAdmin` rather than a scope.
 *
 * You asked for admin, so section 1 does exactly that. If on reading this you
 * want them to have only the desks their positions name, DELETE SECTION 1 and
 * run the rest. Section 2 stands on its own.
 *
 * It does NOT make anybody a super admin. Only a super admin can grant roles,
 * and that stays with you.
 *
 * Safe to run twice: the role function answers `already_held` and the grants
 * skip a live one rather than duplicating it.
 */

begin;

do $$
declare
  v_actor  uuid;
  v_bd     uuid;
  v_social uuid;
  v_result jsonb;
begin
  /* ------------------------------------------------------------------ *
   * WHO IS GRANTING. Put your own super admin address on the next line.
   * The role function refuses anybody who is not a super admin, so this
   * cannot be used to promote somebody from a lesser account.
   * ------------------------------------------------------------------ */
  select u.id into v_actor
  from auth.users u
  join public.user_roles r on r.user_id = u.id
  where lower(u.email) = lower('REPLACE_WITH_YOUR_SUPER_ADMIN_EMAIL')
    and r.role = 'super_admin'
  limit 1;

  if v_actor is null then
    raise exception
      'No super admin found for that address. Put your own super admin email on the line above and run this again. Nothing was changed.';
  end if;

  select id into v_bd     from auth.users where lower(email) = 'sophiaduru0@gmail.com'       limit 1;
  select id into v_social from auth.users where lower(email) = 'agboolajosephyomi@gmail.com' limit 1;

  if v_bd is null or v_social is null then
    raise exception 'One of the two accounts is missing. Nothing was changed.';
  end if;

  /* ================================================================== *
   * SECTION 1. THE ADMIN ROLE.
   *
   * Through `private.grant_staff_role`, not a raw insert into user_roles,
   * because that function is the only path that also writes the audit_log
   * row and sends the person a notification telling them their access
   * changed. A hand-written insert would give them the role with no record
   * of who granted it and no word to them that it happened.
   * ================================================================== */
  v_result := private.grant_staff_role(v_actor, 'sophiaduru0@gmail.com', 'admin'::public.app_role);
  raise notice 'sophiaduru0@gmail.com admin role: %', v_result->>'status';
  if v_result->>'status' not in ('ok', 'already_held') then
    raise exception 'Could not grant admin to sophiaduru0@gmail.com: %', v_result;
  end if;

  v_result := private.grant_staff_role(v_actor, 'agboolajosephyomi@gmail.com', 'admin'::public.app_role);
  raise notice 'agboolajosephyomi@gmail.com admin role: %', v_result->>'status';
  if v_result->>'status' not in ('ok', 'already_held') then
    raise exception 'Could not grant admin to agboolajosephyomi@gmail.com: %', v_result;
  end if;

  /* ================================================================== *
   * SECTION 2. THE POSITIONS AND THEIR DESKS.
   *
   * This is what gives each of them a title on the staff desk and the
   * scopes their job carries. The scopes are read from the position at
   * insert time (`private.staff_position_scopes`), never written out here,
   * so a grant cannot drift from its position if the bundle changes later.
   *
   *   business_development_executive  "Business Development Director"
   *                                   business_development, listing_approval
   *   social_media_manager            "Social Media Manager"
   *                                   social_media
   * ================================================================== */
  if not exists (
    select 1 from public.staff_grants
    where user_id = v_bd and position = 'business_development_executive' and revoked_at is null
  ) then
    insert into public.staff_grants (user_id, scopes, note, granted_by, position)
    values (v_bd,
            private.staff_position_scopes('business_development_executive'),
            'Business Development Director. Granted by the founder, 12 November 2026.',
            v_actor,
            'business_development_executive');
    raise notice 'Granted Business Development Director to sophiaduru0@gmail.com';
  else
    raise notice 'sophiaduru0@gmail.com already holds that position. Left alone.';
  end if;

  if not exists (
    select 1 from public.staff_grants
    where user_id = v_social and position = 'social_media_manager' and revoked_at is null
  ) then
    insert into public.staff_grants (user_id, scopes, note, granted_by, position)
    values (v_social,
            private.staff_position_scopes('social_media_manager'),
            'Social Media Manager. Granted by the founder, 12 November 2026.',
            v_actor,
            'social_media_manager');
    raise notice 'Granted Social Media Manager to agboolajosephyomi@gmail.com';
  else
    raise notice 'agboolajosephyomi@gmail.com already holds that position. Left alone.';
  end if;
end $$;

commit;

/*
 * READ IT BACK. Two rows, each with the admin role, their position, the
 * title that position carries and its scopes:
 *
 *   select lower(u.email) as email,
 *          (select string_agg(r.role::text, ', ' order by r.role::text)
 *             from public.user_roles r where r.user_id = u.id) as roles,
 *          g.position,
 *          private.staff_position_title(g.position) as title,
 *          g.scopes,
 *          g.granted_at
 *   from auth.users u
 *   left join public.staff_grants g
 *          on g.user_id = u.id and g.revoked_at is null
 *   where lower(u.email) in ('sophiaduru0@gmail.com','agboolajosephyomi@gmail.com')
 *   order by 1;
 *
 * And the audit trail the role function wrote for you:
 *
 *   select actor_id, action, entity_id, metadata, created_at
 *   from public.audit_log
 *   where action = 'staff.role_grant'
 *   order by created_at desc
 *   limit 4;
 *
 * TO UNDO THE ADMIN ROLE ONLY, leaving their desks in place:
 *
 *   select public.revoke_staff_role(
 *     '<your super admin id>'::uuid,
 *     '<their user id>'::uuid,
 *     'admin'::public.app_role
 *   );
 */
