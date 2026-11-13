/*
 * THE TWO NEW ADMINS WERE NEVER EMAILED. THIS SENDS IT, ONCE.
 * (the founder, 13 November 2026: "check and confirm mails and notis have
 * been sent to them about it")
 *
 * REWRITTEN 13 November, after Agent BE-BUGS wrote
 * `staff_access_announce_one_door_2026-11-13.sql`. The first version of this
 * file keyed its letter on `staff.access_granted:catchup:<user>` while the
 * door keys on the ACCESS, `staff.access:<user>:<position>:<md5 of scopes>`.
 * Different keys means neither file can see the other's letter, so the two of
 * them together would have sent Sophia and Joseph the same letter twice the
 * next time either grant row was touched. Measured, not guessed:
 *
 *   sophiaduru0        door staff.access:8f54dfab...:business_development_executive:4c8225a8...
 *                      mine staff.access_granted:catchup:8f54dfab...
 *   agboolajosephyomi  door staff.access:96204d3e...:social_media_manager:c3bb0b0c...
 *                      mine staff.access_granted:catchup:96204d3e...
 *
 * So this file no longer carries a key of its own. It calls the door where
 * the door exists, and where it does not it writes the door's own key by the
 * door's own formula. RUN THE TWO FILES IN EITHER ORDER, ONCE EACH OR TWICE
 * EACH: these two people get exactly one letter and one bell line.
 *
 * ---------------------------------------------------------------------------
 * WHAT ACTUALLY WENT OUT when you ran the promote file, read back from the
 * live database rather than assumed:
 *
 *   in-app notification   SENT to both, 12 Nov 23:53, still unread.
 *                         "You are now a Vallo administrator", links /admin.
 *   email                 NOT SENT. The only mail either of them has ever
 *                         had from Vallo is `account.welcome` from signing
 *                         up (both SENT, 12 Nov). The three
 *                         `staff.access_granted` letters in the outbox are
 *                         all from 26 and 27 September, to other people.
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
 * `auth.uid()` for the actor, and the SQL editor has no signed-in user, so
 * it would have returned `forbidden` and done nothing. So the file used
 * `private.grant_staff_role` for the role and a direct insert for the
 * position, and `grant_staff_role` writes the in-app notification only.
 * That is the whole of the gap. My oversight, not yours.
 *
 * AND THE STAFF DESK CANNOT FIX IT NOW EITHER. `admin_grant_staff` returns
 * `already_admin` and stops before the email the moment a person holds the
 * admin role, which both now do. So re-granting them through /admin/staff
 * would send nothing. (The door file removes that trap for the future. It
 * cannot reach these two, because a trigger fires on writes made after it
 * exists, never on rows already in the table. Hence this file.)
 *
 * WHAT THIS DOES, exactly what a grant should have done and nothing besides:
 *
 *   1. Announces their access through the door: the `staff.access_granted`
 *      email, and the in-app notice that NAMES THEIR POSITION. The one they
 *      have says they are an administrator; it does not tell either of them
 *      what their desk is. Scopes and words are read from their live grant
 *      row, so what they are told is the access they actually hold.
 *   2. Writes the `staff.grant` audit row the direct insert skipped, so the
 *      staff desk can say who granted the position and when.
 *
 * IT SENDS REAL EMAIL TO TWO REAL PEOPLE. The outbox drains on a schedule,
 * about every fifteen minutes going by when their welcome mails settled, so
 * expect it to land shortly after you run this, not instantly.
 *
 * SAFE TO RUN TWICE: yes, and safe to run alongside the door file in either
 * order, which is the point of the rewrite.
 */

begin;

do $$
declare
  r           record;
  v_actor     uuid;
  v_door      boolean;
  v_key       text;
  v_sorted    text;
  v_queued    uuid;
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

  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'staff_grant_announce'
  ) into v_door;

  if v_door then
    raise notice 'The announce door is present. Using it, so the keys match and nobody is told twice.';
  else
    raise notice 'The announce door is not here yet. Writing its key by its own formula instead.';
  end if;

  for r in
    select g.user_id,
           lower(u.email)                           as email,
           g.position,
           g.scopes,
           private.staff_position_title(g.position) as title,
           private.staff_scope_words(g.scopes)      as words
    from public.staff_grants g
    join auth.users u on u.id = g.user_id
    where g.revoked_at is null
      and lower(u.email) in ('sophiaduru0@gmail.com', 'agboolajosephyomi@gmail.com')
  loop
    if v_door then
      /* ONE CALL. The door writes the bell line and the letter under its own
         key, so this file and the door file can both run, in any order, and
         the second one to see that key does nothing. */
      perform private.staff_grant_announce(r.user_id);
      raise notice '% : announced through the door (%).', r.email, r.title;
    else
      /* THE DOOR'S KEY, BY THE DOOR'S FORMULA. Sorted scope names so the
         order they were written in does not change the key. */
      select string_agg(s::text, ',' order by s::text) into v_sorted
        from unnest(r.scopes) s;
      v_key := 'staff.access:' || r.user_id::text || ':' || coalesce(r.position, '-')
               || ':' || md5(coalesce(v_sorted, ''));

      perform private.notify_once(
        v_key,
        r.user_id,
        'system'::public.notification_kind,
        case when r.title is null
          then 'You have Vallo staff access'
          else 'You are Vallo''s ' || r.title
        end,
        coalesce('Your position: ' || r.title || '. ', '')
          || 'Access given: ' || r.words
          || '. Read and acknowledge the staff handbook before anything unlocks.',
        '/admin/handbook');

      v_queued := private.email_outbox_enqueue(
        r.user_id,
        'staff.access_granted',
        v_key,
        jsonb_build_object(
          'scopes',         to_jsonb(r.scopes::text[]),
          'scope_words',    r.words,
          'position',       r.position,
          'position_title', r.title));

      if v_queued is null then
        raise notice '% : letter already queued or sent under that key. Nothing added.', r.email;
      else
        raise notice '% : staff access letter queued (%).', r.email, r.title;
      end if;
    end if;

    /* ---------------------------------------------------------------- *
     * THE MISSING AUDIT ROW for the position grant. The role grant
     * logged itself; the direct insert of the position did not.
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
 * READ IT BACK. One letter each, no more, whichever order you ran the two
 * files in. It should appear PENDING and then SENT within about fifteen
 * minutes:
 *
 *   select lower(u.email), e.template, e.status, e.attempts, e.last_error,
 *          e.dedupe_key, e.created_at, e.settled_at
 *   from public.email_outbox e
 *   join auth.users u on u.id = e.user_id
 *   where e.template = 'staff.access_granted'
 *   order by e.created_at desc;
 *
 * If a row sits PENDING with attempts climbing and a last_error, the drain
 * is the problem and not this file. Both notifications, newest first:
 *
 *   select lower(u.email), n.title, n.href, n.created_at, n.read_at
 *   from public.notifications n
 *   join auth.users u on u.id = n.user_id
 *   where lower(u.email) in ('sophiaduru0@gmail.com','agboolajosephyomi@gmail.com')
 *   order by n.created_at desc;
 */
