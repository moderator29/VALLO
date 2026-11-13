/*
 * SUPERSEDED. DO NOT RUN THIS ONE. Run
 * `promote_bd_and_social_to_admin_2026-11-12.sql` instead: it does everything
 * this file does, plus the admin role the founder asked for, and it has his
 * own super admin address filled in rather than a placeholder. This file is
 * kept only as the record of what was written before both accounts existed.
 *
 * TWO STAFF GRANTS: BUSINESS DEVELOPMENT AND SOCIAL MEDIA (the founder,
 * 12 November 2026).
 *
 * READ THIS BEFORE YOU RUN IT. Neither account existed when this was written.
 * Both do now (12 Nov, evening). Checked against
 * the live database on 12 November:
 *
 *   select id, email from auth.users
 *   where lower(email) in ('sophiaduru0@gmail.com','agboolajosephyomi@gmail.com');
 *   -> 0 rows
 *
 * A staff grant attaches to a Vallo account, so BOTH PEOPLE MUST SIGN UP
 * FIRST, with those exact addresses. Until they do, this file stops on its own
 * and changes nothing: it raises and names whoever is missing rather than
 * writing half the grant. Run it again once they have signed up.
 *
 * WHAT IT GRANTS, read out of the database rather than typed here
 * (`private.staff_position_scopes`, migration
 * 20260929094459_named_staff_positions_with_default_scope_bundles):
 *
 *   sophiaduru0@gmail.com         business_development_executive
 *                                 "Business Development Director"
 *                                 scopes: business_development, listing_approval
 *
 *   agboolajosephyomi@gmail.com   social_media_manager
 *                                 "Social Media Manager"
 *                                 scopes: social_media
 *
 * The scopes are NOT written out in this file. Each grant takes whatever
 * `staff_position_scopes` says its position carries, so the grant and the
 * position cannot drift apart, and a later change to a position's bundle does
 * not leave these two holding yesterday's list.
 *
 * It is safe to run twice: an existing live grant for the same person and
 * position is left alone rather than duplicated.
 *
 * WHAT IT DOES NOT DO. It does not make either of them an admin or a super
 * admin, and `public.user_roles` is untouched. They are staff with scopes,
 * which is what opens the desks their position names and nothing else. Only
 * your super admin account grants access, and the database refuses a grant
 * from anybody else whatever a page does.
 */

begin;

do $$
declare
  v_actor    uuid;
  v_bd       uuid;
  v_social   uuid;
  v_missing  text[] := '{}';
begin
  /* ------------------------------------------------------------------ *
   * 1. WHO IS GRANTING. Put your own super admin address here. It is a
   *    column on the row, so the staff desk can say who let somebody in.
   * ------------------------------------------------------------------ */
  select u.id into v_actor
  from auth.users u
  join public.user_roles r on r.user_id = u.id
  where lower(u.email) = lower('REPLACE_WITH_YOUR_SUPER_ADMIN_EMAIL')
    and r.role = 'super_admin'
  limit 1;

  if v_actor is null then
    raise exception
      'No super admin found for that address. Edit the email on the line above to your own super admin account, then run this again. Nothing was changed.';
  end if;

  /* ------------------------------------------------------------------ *
   * 2. THE TWO ACCOUNTS. Both must already exist.
   * ------------------------------------------------------------------ */
  select id into v_bd     from auth.users where lower(email) = 'sophiaduru0@gmail.com'        limit 1;
  select id into v_social from auth.users where lower(email) = 'agboolajosephyomi@gmail.com'  limit 1;

  if v_bd is null then
    v_missing := v_missing || 'sophiaduru0@gmail.com';
  end if;
  if v_social is null then
    v_missing := v_missing || 'agboolajosephyomi@gmail.com';
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception
      'These people have no Vallo account yet: %. Ask them to sign up with that exact address, then run this file again. Nothing was changed.',
      array_to_string(v_missing, ', ');
  end if;

  /* ------------------------------------------------------------------ *
   * 3. THE GRANTS. Scopes come from the position, never from this file.
   * ------------------------------------------------------------------ */
  if not exists (
    select 1 from public.staff_grants
    where user_id = v_bd and position = 'business_development_executive' and revoked_at is null
  ) then
    insert into public.staff_grants (user_id, scopes, note, granted_by, position)
    values (
      v_bd,
      private.staff_position_scopes('business_development_executive'),
      'Business Development Director. Granted by the founder, 12 November 2026.',
      v_actor,
      'business_development_executive'
    );
    raise notice 'Granted Business Development Director to sophiaduru0@gmail.com';
  else
    raise notice 'sophiaduru0@gmail.com already holds this position. Left alone.';
  end if;

  if not exists (
    select 1 from public.staff_grants
    where user_id = v_social and position = 'social_media_manager' and revoked_at is null
  ) then
    insert into public.staff_grants (user_id, scopes, note, granted_by, position)
    values (
      v_social,
      private.staff_position_scopes('social_media_manager'),
      'Social Media Manager. Granted by the founder, 12 November 2026.',
      v_actor,
      'social_media_manager'
    );
    raise notice 'Granted Social Media Manager to agboolajosephyomi@gmail.com';
  else
    raise notice 'agboolajosephyomi@gmail.com already holds this position. Left alone.';
  end if;
end $$;

commit;

/*
 * AFTERWARDS, read it back. This should show two live rows with their
 * positions, their titles and the scopes the positions carry:
 *
 *   select u.email,
 *          g.position,
 *          private.staff_position_title(g.position) as title,
 *          g.scopes,
 *          g.granted_at
 *   from public.staff_grants g
 *   join auth.users u on u.id = g.user_id
 *   where g.revoked_at is null
 *     and lower(u.email) in ('sophiaduru0@gmail.com','agboolajosephyomi@gmail.com')
 *   order by u.email;
 *
 * And each of them, signed in, should see only their own desks:
 *
 *   select public.my_staff_access();
 */
