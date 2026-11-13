/*
 * THE BYPASSED STAFF LETTER, FIXED AT THE TABLE INSTEAD OF AT EACH CALLER.
 * (Agent BE-BUGS, 13 November 2026. Not applied. The founder runs this.)
 *
 * ---------------------------------------------------------------------------
 * THE MEASURED PROBLEM
 *
 * Read off the live database on 13 November 2026, not assumed:
 *
 *   select g.user_id, g.position, g.granted_at::date,
 *          (select count(*) from public.email_outbox o
 *            where o.user_id = g.user_id and o.template = 'staff.access_granted') letters
 *     from public.staff_grants g order by g.granted_at;
 *
 *   three grants from 26 and 27 September   letters = 1 each
 *   two grants from 12 November             letters = 0
 *
 * Three write paths reach public.staff_grants and they tell the person three
 * different amounts:
 *
 *   public.admin_grant_staff   grant + audit row + in-app notice + the letter
 *   private.grant_staff_role   role only: in-app notice, no letter
 *   a direct insert            nothing at all
 *
 * The letter was never missing. Template staff.access_granted is written,
 * registered in apps/web/src/lib/notify/templates.ts and renders; the only
 * thing that enqueues it is one of the three paths. So the promote file of
 * 12 November, which had to use the other two (admin_grant_staff reads
 * auth.uid() and the SQL editor has no signed-in user), gave two real staff
 * members a bell line and no letter.
 *
 * AND THE DESK COULD NOT MAKE IT GOOD AFTERWARDS. admin_grant_staff returns
 * 'already_admin' and stops BEFORE it writes anything, the moment the target
 * holds admin or super_admin. Both of them now do. So re-granting them from
 * /admin/staff changed nothing and sent nothing, and no path existed by which
 * a person who holds the role could ever be given, changed or re-sent their
 * position. That is the trap, and it is the second half of this file.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE DOES
 *
 * 1. private.staff_grant_announce(uuid): one door. It reads the person's live
 *    active grant row, works out the position title and the access words from
 *    the row itself rather than from anything a caller typed, then writes the
 *    in-app notice through private.notify_once and enqueues
 *    staff.access_granted through private.email_outbox_enqueue. Both are keyed
 *    on the person, the position and a digest of the sorted scopes, so the
 *    same access is never announced to the same person twice and a genuine
 *    change of position or scopes is announced once. It never raises: a
 *    failure is reported through private.notice_failed, exactly as the nt01
 *    notice helpers do, because a grant must not roll back over a notice.
 *
 * 2. A trigger, staff_grants_announce_access, AFTER INSERT OR UPDATE on
 *    public.staff_grants. It calls the door whenever an active grant appears,
 *    changes its scopes or position, or comes back from revoked. This is the
 *    fix for the class: EVERY path into the table now announces, including a
 *    direct insert from the SQL editor and any path written after today.
 *
 * 3. public.admin_grant_staff is replaced. Two changes and nothing else:
 *    the 'already_admin' early return is gone, so holding the admin role no
 *    longer bars a person from being given or changed a staff position; and
 *    its own hand-written notify and enqueue are replaced by one call to the
 *    door. Its authority check, its target checks, its scope resolution, its
 *    upsert and its audit row are word for word as they were.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE DOES NOT DO
 *
 *   It does not send the two members of 12 November their missing letter.
 *   supabase/migrations/pending/send_the_staff_access_email_2026-11-13.sql is
 *   the lead's file for that and is still the right one to run. A trigger
 *   fires on writes made after it exists, never on rows already there, so
 *   this file reaches nobody who is already staff until their grant next
 *   changes.
 *
 *   It does not grant, revoke, widen or narrow one scope, position or role.
 *   It does not touch public.user_roles or private.grant_staff_role.
 *   It does not add an email when staff access ENDS (admin_revoke_staff still
 *   writes the in-app notice only; there is no staff.access_ended template to
 *   enqueue, and inventing one is a separate change with its own copy).
 *   It drops nothing and deletes nothing, so the connector will not freeze on
 *   it, and it creates no cron job.
 *
 * ---------------------------------------------------------------------------
 * SAFE TO RUN TWICE: YES.
 *
 * Every statement is create or replace. The trigger is 'create or replace
 * trigger' (PostgreSQL 14 and later; this database is 17.6), so a second run
 * replaces it rather than failing on a duplicate name. The announce door is
 * keyed, so even if it is somehow called twice for one state it writes one
 * bell line and one outbox row.
 *
 * ---------------------------------------------------------------------------
 * READ BACK AFTER RUNNING, all three in one go. Expect one trigger row, the
 * function present, and no 'already_admin' left in the function body.
 *
 *   select tgname, tgenabled from pg_trigger t
 *     join pg_class c on c.oid = t.tgrelid
 *    where c.relname = 'staff_grants' and not t.tgisinternal;
 *
 *   select count(*) as door from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 *    where n.nspname = 'private' and p.proname = 'staff_grant_announce';
 *
 *   select p.prosrc ~ 'already_admin' as trap_still_there,
 *          p.prosrc ~ 'staff_grant_announce' as uses_the_door
 *     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 *    where n.nspname = 'public' and p.proname = 'admin_grant_staff';
 *
 * Expected: one row 'staff_grants_announce_access' enabled 'O'; door = 1;
 * trap_still_there = false and uses_the_door = true.
 */

/* ------------------------------------------------------------------ the door */

create or replace function private.staff_grant_announce(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g      public.staff_grants;
  title  text;
  words  text;
  sorted text;
  key    text;
begin
  if p_user is null then
    return;
  end if;

  select * into g from public.staff_grants where user_id = p_user;
  if g.user_id is null or g.revoked_at is not null then
    return;
  end if;
  if g.scopes is null or cardinality(g.scopes) = 0 then
    return;
  end if;

  title := private.staff_position_title(g.position);
  words := private.staff_scope_words(g.scopes);
  if coalesce(btrim(coalesce(words, '')), '') = '' then
    return;
  end if;

  /* The key states the ACCESS, not the moment, so the same access is never
     announced twice and a real change is announced once. Sorted so that a
     direct insert writing the same scopes in another order does not read as a
     change. */
  select string_agg(s::text, ',' order by s::text) into sorted
    from unnest(g.scopes) s;
  key := 'staff.access:' || p_user::text || ':' || coalesce(g.position, '-')
         || ':' || md5(coalesce(sorted, ''));

  begin
    perform private.notify_once(
      key,
      p_user,
      'system'::public.notification_kind,
      case when title is null
        then 'You have Vallo staff access'
        else 'You are Vallo''s ' || title
      end,
      coalesce('Your position: ' || title || '. ', '')
        || 'Access given: ' || words
        || '. Read and acknowledge the staff handbook before anything unlocks.',
      '/admin/handbook');
  exception when others then
    perform private.notice_failed('staff access bell', 'staff_grant', p_user::text, sqlstate, sqlerrm);
  end;

  begin
    perform private.email_outbox_enqueue(
      p_user,
      'staff.access_granted',
      key,
      jsonb_build_object(
        'scopes', to_jsonb(g.scopes::text[]),
        'scope_words', words,
        'position', g.position,
        'position_title', title));
  exception when others then
    perform private.notice_failed('staff access letter', 'staff_grant', p_user::text, sqlstate, sqlerrm);
  end;
end;
$$;

revoke all on function private.staff_grant_announce(uuid) from public;
revoke all on function private.staff_grant_announce(uuid) from anon;
revoke all on function private.staff_grant_announce(uuid) from authenticated;

/* --------------------------------------------------------------- the trigger */

create or replace function private.staff_grants_announce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.revoked_at is not null then
    return new;
  end if;
  if tg_op = 'INSERT'
     or old.revoked_at is not null
     or old.scopes is distinct from new.scopes
     or old.position is distinct from new.position then
    perform private.staff_grant_announce(new.user_id);
  end if;
  return new;
end;
$$;

revoke all on function private.staff_grants_announce() from public;
revoke all on function private.staff_grants_announce() from anon;
revoke all on function private.staff_grants_announce() from authenticated;

create or replace trigger staff_grants_announce_access
after insert or update on public.staff_grants
for each row execute function private.staff_grants_announce();

/* ------------------------------------------- admin_grant_staff, without the trap */

create or replace function public.admin_grant_staff(
  p_user uuid,
  p_scopes text[] default null,
  p_note text default null,
  p_position text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor  uuid := auth.uid();
  scopes public.staff_scope[];
  prior  public.staff_grants;
  pos    text := nullif(btrim(coalesce(p_position, '')), '');
  title  text;
begin
  if actor is null or not private.has_role(actor, 'super_admin'::public.app_role) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_user is null or p_user = actor then
    return jsonb_build_object('status', 'invalid_target');
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    return jsonb_build_object('status', 'no_such_user');
  end if;
  /* The 'already_admin' refusal that used to stand here is gone. A staff
     POSITION and the admin ROLE are two different records, and refusing the
     position because the role is held left a person who holds the role with
     no path to a position, a scope change or their position letter. */
  if pos is not null then
    title := private.staff_position_title(pos);
    if title is null then
      return jsonb_build_object('status', 'invalid_position');
    end if;
  end if;
  if p_scopes is null or cardinality(p_scopes) = 0 then
    scopes := private.staff_position_scopes(pos);
  else
    begin
      select array_agg(distinct s::public.staff_scope order by s::public.staff_scope)
        into scopes from unnest(p_scopes) s;
    exception when invalid_text_representation then
      return jsonb_build_object('status', 'invalid_scope');
    end;
  end if;
  if scopes is null or cardinality(scopes) = 0 then
    return jsonb_build_object('status', 'no_scopes');
  end if;

  select * into prior from public.staff_grants where user_id = p_user;
  insert into public.staff_grants (user_id, scopes, note, position, granted_by, granted_at, revoked_at, revoked_by, revoke_reason)
  values (p_user, scopes, nullif(btrim(p_note), ''), pos, actor, now(), null, null, null)
  on conflict (user_id) do update
    set scopes = excluded.scopes, note = excluded.note, position = excluded.position,
        granted_by = excluded.granted_by, granted_at = excluded.granted_at,
        revoked_at = null, revoked_by = null, revoke_reason = null;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, case when prior.user_id is null or prior.revoked_at is not null then 'staff.grant' else 'staff.change' end,
          'staff_grant', p_user,
          jsonb_build_object('scopes', to_jsonb(scopes::text[]),
                             'previous_scopes', case when prior.user_id is null then null else to_jsonb(prior.scopes::text[]) end,
                             'position', pos,
                             'previous_position', prior.position,
                             'note', nullif(btrim(p_note), '')));

  /* ONE DOOR. The trigger on the table has already called this for the write
     above; the key makes the second call a no-op. It is called here as well so
     the function still announces if the trigger is ever absent. */
  perform private.staff_grant_announce(p_user);

  return jsonb_build_object('status', 'ok', 'scopes', to_jsonb(scopes::text[]), 'position', pos);
end;
$$;
