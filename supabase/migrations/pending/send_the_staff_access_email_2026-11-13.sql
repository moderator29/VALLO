/*
 * THE TWO NEW ADMINS WERE NEVER EMAILED. THIS SENDS IT.
 * (the founder, 13 November 2026: "check and confirm mails and notis have
 * been sent to them about it")
 *
 * WHAT ACTUALLY WENT OUT when you ran the promote file, read back from the
 * live database rather than assumed:
 *
 *   in-app notification   SENT to both, 12 Nov 23:53, still unread.
 *                         "You are now a Vallo administrator", links /admin.
 *   email                 NOT SENT. The only mail either of them has ever
 *                         had from Vallo is `account.welcome` from signing
 *                         up (both SENT, 12 Nov).
 *   push                  NOT SENT, and correctly so: neither has a push
 *                         token, so neither has ever allowed notifications
 *                         on a device. Nothing to deliver to.
 *   WhatsApp              NOT SENT: the doorbell needs a confirmed phone
 *                         and the setting switched on.
 *
 * WHY THE EMAIL DID NOT GO. The email exists and is good: template
 * `staff.access_granted`, which names the position, the access given, who
 * they report to and their responsibilities, and links the handbook. It is
 * enqueued by `public.admin_grant_staff`, and the promote file did not go
 * through that function. It could not: `admin_grant_staff` reads
 * `auth.uid()` for the actor, and in the SQL editor there is no signed-in
 * user, so it would have returned `forbidden` and done nothing. So the file
 * used `private.grant_staff_role` for the role and a direct insert for the
 * position, and `grant_staff_role` writes the in-app notification only.
 * That is the whole of the gap. My oversight, not yours.
 *
 * AND THE STAFF DESK CANNOT FIX IT NOW EITHER. `admin_grant_staff` returns
 * `already_admin` and stops before the email the moment a person holds the
 * admin role, which both now do. So re-granting them through /admin/staff
 * would send nothing. It has to be enqueued directly, which is this file.
 *
 * WHAT THIS DOES, exactly what `admin_grant_staff` would have done after the
 * grant and nothing besides:
 *
 *   1. Enqueues the `staff.access_granted` email for each of them, with the
 *      payload the template reads. Scopes and words come out of their live
 *      grant row, so the email states the access they actually hold rather
 *      than what anybody typed here.
 *   2. Sends the in-app notification that NAMES THEIR POSITION, which they
 *      never got. The one they have says they are an administrator; it does
 *      not tell either of them what their desk is.
 *   3. Writes the `staff.grant` audit row the direct insert skipped, so the
 *      staff desk can say who granted the position and when.
 *
 * IT SENDS REAL EMAIL TO TWO REAL PEOPLE. The outbox drains on a schedule,
 * about every fifteen minutes going by when their welcome mails settled, so
 * expect it to land shortly after you run this, not instantly.
 *
 * Safe to run twice: the email is keyed on a dedupe key that does not carry
 * a timestamp, so a second run queues nothing, and the notification and
 * audit row are guarded on their own existence.
 */

begin;

do $$
declare
  r        record;
  v_actor  uuid;
  v_queued uuid;
begin
  select u.id into v_actor
  from auth.users u
  join public.user_roles ro on ro.user_id = u.id
  where lower(u.email) = 'phantomfcalls@gmail.com'
    and ro.role = 'super_admin'
  limit 1;

  if v_actor is null then
    raise exception 'No super admin found for phantomfcalls@gmail.com. Nothing was changed.';
  end if;

  for r in
    select g.user_id,
           lower(u.email)                              as email,
           g.position,
           g.scopes,
           private.staff_position_title(g.position)    as title,
           private.staff_scope_words(g.scopes)         as words
    from public.staff_grants g
    join auth.users u on u.id = g.user_id
    where g.revoked_at is null
      and lower(u.email) in ('sophiaduru0@gmail.com', 'agboolajosephyomi@gmail.com')
  loop
    /* ---------------------------------------------------------------- *
     * 1. THE EMAIL. No timestamp in the dedupe key, on purpose: the key
     *    is what makes a second run of this file silent instead of
     *    sending the same person the same letter twice.
     * ---------------------------------------------------------------- */
    v_queued := private.email_outbox_enqueue(
      r.user_id,
      'staff.access_granted',
      'staff.access_granted:catchup:' || r.user_id::text,
      jsonb_build_object(
        'scopes',         to_jsonb(r.scopes::text[]),
        'scope_words',    r.words,
        'position',       r.position,
        'position_title', r.title
      )
    );

    if v_queued is null then
      raise notice '% : email already queued or sent. Nothing added.', r.email;
    else
      raise notice '% : staff access email queued (%).', r.email, r.title;
    end if;

    /* ---------------------------------------------------------------- *
     * 2. THE NOTIFICATION THAT NAMES THE POSITION. Word for word what
     *    `admin_grant_staff` writes, so what they read in the app is the
     *    same whichever path granted them.
     * ---------------------------------------------------------------- */
    if not exists (
      select 1 from public.notifications n
      where n.user_id = r.user_id
        and n.title = 'You have Vallo staff access'
    ) then
      perform private.notify(
        r.user_id,
        'system'::public.notification_kind,
        'You have Vallo staff access',
        coalesce('Your position: ' || r.title || '. ', '')
          || 'Access given: ' || r.words
          || '. Read and acknowledge the staff handbook before anything unlocks.',
        '/admin/handbook'
      );
      raise notice '% : position notification sent.', r.email;
    else
      raise notice '% : already has the position notification. Left alone.', r.email;
    end if;

    /* ---------------------------------------------------------------- *
     * 3. THE MISSING AUDIT ROW for the position grant. The role grant
     *    logged itself; the direct insert of the position did not.
     * ---------------------------------------------------------------- */
    if not exists (
      select 1 from public.audit_log a
      where a.action = 'staff.grant'
        and a.entity_type = 'staff_grant'
        and a.entity_id = r.user_id::text
    ) then
      insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
      values (v_actor, 'staff.grant', 'staff_grant', r.user_id::text,
              jsonb_build_object(
                'scopes',   to_jsonb(r.scopes::text[]),
                'position', r.position,
                'note',     'Backfilled 13 November 2026: the position was granted by direct insert, which logged nothing.'
              ));
      raise notice '% : audit row written.', r.email;
    end if;
  end loop;
end $$;

commit;

/*
 * READ IT BACK. The email should appear PENDING and then SENT within about
 * fifteen minutes:
 *
 *   select lower(u.email), e.template, e.status, e.attempts, e.last_error,
 *          e.created_at, e.settled_at
 *   from public.email_outbox e
 *   join auth.users u on u.id = e.user_id
 *   where e.template = 'staff.access_granted'
 *   order by e.created_at desc;
 *
 * If it sits PENDING with attempts climbing and a last_error, the drain is
 * the problem and not this file. Both notifications, newest first:
 *
 *   select lower(u.email), n.title, n.href, n.created_at, n.read_at
 *   from public.notifications n
 *   join auth.users u on u.id = n.user_id
 *   where lower(u.email) in ('sophiaduru0@gmail.com','agboolajosephyomi@gmail.com')
 *   order by n.created_at desc;
 */
