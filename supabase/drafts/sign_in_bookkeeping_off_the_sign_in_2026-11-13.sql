-- ============================================================================
-- CHECK THIS FILE AGAINST THE LIVE TRIGGER AND FUNCTION DEFINITIONS BEFORE
-- ANYONE RUNS IT. IT WAS WRITTEN FROM THE MIGRATIONS IN THE REPOSITORY WHILE
-- THE DATABASE CONNECTION WAS DOWN (13 NOVEMBER 2026). READ, ON LIVE:
--   select pg_get_functiondef('private.enqueue_new_device_email()'::regprocedure);
--   select pg_get_functiondef('private.audit_staff_sign_in()'::regprocedure);
--   select tgname, pg_get_triggerdef(oid) from pg_trigger
--    where tgrelid = 'auth.sessions'::regclass and not tgisinternal;
-- AND IF ANY BODY DIFFERS FROM THE ONE COPIED INTO THE TWO FUNCTIONS BELOW,
-- COPY THE LIVE BODY IN INSTEAD. NOT APPLIED. ONLY THE FOUNDER APPLIES IT.
-- ============================================================================
--
-- SIGN-IN BOOKKEEPING LEAVES THE SIGN-IN (Agent NATIVE, 13 November 2026).
--
-- THE MEASURED PROBLEM. The founder: "it sits on /sign-in". A sign-in on
-- production, with the password accepted (the auth cookies were set), showed
-- an unchanged screen for 8 seconds and more, and a second one had no answer
-- at all after 20 seconds. The database's own query timings that morning
-- (docs/handoff/QUERY_TIMINGS_BEFORE_RESET_2026-11-13.md) show single small
-- inserts taking up to 74 seconds under contention. Every sign-in makes
-- GoTrue insert a row into auth.sessions, and two AFTER INSERT triggers on
-- that table run INSIDE GoTrue's sign-in transaction, so GoTrue cannot answer
-- until they finish:
--
--   sessions_enqueue_new_device_email  (20260923093115)
--     private.device_words(); an upsert into public.known_devices on EVERY
--     sign-in (an update of last_seen_at for a known device, a row lock); for
--     a new device a count, private.email_outbox_enqueue (an insert), and the
--     known_devices AFTER INSERT trigger known_devices_notify_new_device
--     (20260928230226: a count, private.notify, a notifications insert and
--     its own push-outbox trigger).
--   sessions_audit_staff_sign_in        (20260929103514, body 20261107180200)
--     two EXISTS lookups (user_roles, staff_grants) on EVERY sign-in; for
--     staff two audit_log scans, an audit_log insert, and on a new device a
--     profiles read and private.notify to the member and every super admin.
--
-- That is up to eight writes in front of one person's home screen, each one a
-- chance to land in a stall. The web side has already been changed so the
-- "Signed in" answer no longer waits for the next page to be built
-- (apps/web/src/lib/auth/actions.ts); what is left is this transaction.
--
-- WHAT THIS DOES.
--   1. A queue, private.sign_in_queue: one row per new session (the session
--      id, the user, the user agent, the network address, the time).
--   2. ONE trigger on auth.sessions, sessions_queue_sign_in, which does ONE
--      insert into that queue and nothing else. It replaces both triggers
--      above, which are dropped.
--   3. The work the two triggers did, unchanged in what it decides, moved into
--      two plain functions that take their facts as arguments
--      (private.record_sign_in_device and private.record_staff_sign_in), run by
--      private.process_sign_in_queue() from pg_cron every minute, oldest first,
--      200 at a time, each row in its own exception block so one bad row never
--      stops the rest. A processed row is stamped, and rows older than seven
--      days are deleted by the same run.
--
-- WHAT THIS DOES NOT DO.
--   - It does not change what is decided: the same device fingerprint, the
--     same "first device is the sign-up, not a stranger" rule, the same email
--     and dedupe key, the same staff audit row and alerts.
--   - It does not touch GoTrue's own writes (the session, the refresh token,
--     last_sign_in_at, GoTrue's audit log). Those stay in the sign-in.
--   - THE ONE VISIBLE DIFFERENCE: the new-device email, the "New sign-in to
--     Vallo" notification and the staff alert arrive up to a minute later than
--     the sign-in, instead of with it. The staff audit row carries the sign-in
--     time in its metadata (signed_in_at) as well as its own created_at.
--   - It does not touch auth.users triggers (password change, welcome email,
--     referral, mailbox), which do not fire on a sign-in.
--
-- SAFE TO RUN TWICE: create ... if not exists, create or replace, drop trigger
-- if exists before create, and cron.schedule by name replaces the same job.
--
-- READ-BACK at the foot: the queue exists and is closed to anon and
-- authenticated, exactly one non-internal trigger on auth.sessions and it is
-- this one, every new function is closed to anon and authenticated, and the
-- cron job is scheduled.

begin;

-- 1. THE QUEUE ----------------------------------------------------------------

create table if not exists private.sign_in_queue (
  id            bigint generated always as identity primary key,
  session_id    uuid not null,
  user_id       uuid not null,
  user_agent    text,
  ip            inet,
  signed_in_at  timestamptz not null default now(),
  processed_at  timestamptz,
  attempts      integer not null default 0
);

create index if not exists sign_in_queue_pending
  on private.sign_in_queue (id)
  where processed_at is null;

revoke all on table private.sign_in_queue from public, anon, authenticated;

-- 2. THE ONE CHEAP TRIGGER -----------------------------------------------------

create or replace function private.queue_sign_in()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into private.sign_in_queue (session_id, user_id, user_agent, ip)
  values (new.id, new.user_id, new.user_agent, new.ip);
  return new;
exception when others then
  /* A trigger on the auth schema may never break signing in. */
  raise warning '[sign-in queue] enqueue failed: %', sqlstate;
  return new;
end;
$$;

revoke all on function private.queue_sign_in() from public, anon, authenticated;

drop trigger if exists sessions_enqueue_new_device_email on auth.sessions;
drop trigger if exists sessions_audit_staff_sign_in on auth.sessions;
drop trigger if exists sessions_queue_sign_in on auth.sessions;
create trigger sessions_queue_sign_in
  after insert on auth.sessions
  for each row
  execute function private.queue_sign_in();

-- 3. THE WORK, AS IT WAS, WITH ITS FACTS PASSED IN -----------------------------

/* The body of private.enqueue_new_device_email() (20260923093115), with
   `new.user_id` and `new.user_agent` as arguments and the sign-in time passed
   in for the email's "at". CHECK AGAINST LIVE (see the head). */
create or replace function private.record_sign_in_device(p_user uuid, p_user_agent text, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_fingerprint text;
  v_words text;
  v_inserted boolean;
  v_known integer;
begin
  v_words := private.device_words(p_user_agent);
  v_fingerprint := left(md5(coalesce(nullif(btrim(p_user_agent), ''), 'unrecorded')), 16);

  insert into public.known_devices (user_id, fingerprint, device_words)
  values (p_user, v_fingerprint, v_words)
  on conflict (user_id, fingerprint)
    do update set last_seen_at = greatest(public.known_devices.last_seen_at, p_at)
  returning (xmax = 0) into v_inserted;

  if not coalesce(v_inserted, false) then
    return;
  end if;

  /* The first device an account ever sees is the sign-up, not a new device. */
  select count(*) into v_known from public.known_devices where user_id = p_user;
  if v_known < 2 then
    return;
  end if;

  perform private.email_outbox_enqueue(
    p_user,
    'security.new_device_sign_in',
    'security:new_device:' || p_user::text || ':' || v_fingerprint,
    jsonb_build_object('at', p_at, 'device', v_words)
  );
end;
$$;

revoke all on function private.record_sign_in_device(uuid, text, timestamptz) from public, anon, authenticated;

/* The body of private.audit_staff_sign_in() as 20261107180200 left it, with
   the session's facts as arguments. CHECK AGAINST LIVE (see the head). */
create or replace function private.record_staff_sign_in(p_user uuid, p_session uuid, p_ip inet, p_user_agent text, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  is_staff boolean;
  net text;
  ua text;
  seen boolean;
  recent boolean;
  who text;
  boss uuid;
begin
  select exists (select 1 from public.user_roles r where r.user_id = p_user and r.role in ('admin', 'super_admin'))
      or exists (select 1 from public.staff_grants g where g.user_id = p_user and g.revoked_at is null)
    into is_staff;
  if not coalesce(is_staff, false) then
    return;
  end if;

  net := case when p_ip is null then 'unknown'
              else host(network(set_masklen(p_ip, case when family(p_ip) = 4 then 24 else 48 end)))
                   || '/' || case when family(p_ip) = 4 then '24' else '48' end end;
  ua := left(encode(sha256(convert_to(coalesce(p_user_agent, ''), 'UTF8')), 'hex'), 32);

  select exists (
    select 1 from public.audit_log a
     where a.actor_id = p_user and a.action = 'staff.sign_in'
       and a.created_at > p_at - interval '60 days'
       and a.metadata ->> 'ua_hash' = ua)
    into seen;

  select exists (
    select 1 from public.audit_log a
     where a.actor_id = p_user and a.action = 'staff.sign_in'
       and a.created_at > p_at - interval '24 hours'
       and (a.metadata ->> 'alerted')::boolean is true)
    into recent;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_user, 'staff.sign_in', 'user', p_user::text,
          jsonb_build_object('session_id', p_session, 'network', net, 'ua_hash', ua,
                             'new_place', not seen, 'alerted', (not seen and not recent),
                             'signed_in_at', p_at));

  if not seen and not recent then
    select coalesce(nullif(btrim(p.display_name), ''), 'A staff member') into who
      from public.profiles p where p.id = p_user;
    perform private.notify(p_user, 'system'::public.notification_kind,
      'New device on your staff account',
      'Your staff account signed in on a device we have not seen before. If this was not you, change your password now and tell the founder.',
      '/settings/privacy');
    for boss in
      select distinct r.user_id from public.user_roles r
       where r.role = 'super_admin'::public.app_role and r.user_id <> p_user
    loop
      perform private.notify(boss, 'system'::public.notification_kind,
        'Staff sign-in on a new device',
        coalesce(who, 'A staff member') || ' signed in on a device we have not seen before.',
        '/admin/audit?q=staff.sign_in');
    end loop;
  end if;
end;
$$;

revoke all on function private.record_staff_sign_in(uuid, uuid, inet, text, timestamptz) from public, anon, authenticated;

-- 4. THE WORKER -----------------------------------------------------------------

create or replace function private.process_sign_in_queue(p_limit integer default 200)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  r private.sign_in_queue%rowtype;
  v_done integer := 0;
begin
  for r in
    select * from private.sign_in_queue
     where processed_at is null and attempts < 5
     order by id
     limit greatest(1, least(p_limit, 1000))
     for update skip locked
  loop
    begin
      perform private.record_sign_in_device(r.user_id, r.user_agent, r.signed_in_at);
      perform private.record_staff_sign_in(r.user_id, r.session_id, r.ip, r.user_agent, r.signed_in_at);
      update private.sign_in_queue set processed_at = now(), attempts = attempts + 1 where id = r.id;
      v_done := v_done + 1;
    exception when others then
      /* One row that cannot be done never stops the rest; five tries, then it
         is left for a person to read. */
      update private.sign_in_queue set attempts = attempts + 1 where id = r.id;
      raise warning '[sign-in queue] row % failed: %', r.id, sqlstate;
    end;
  end loop;

  delete from private.sign_in_queue
   where processed_at is not null and processed_at < now() - interval '7 days';

  return v_done;
end;
$$;

revoke all on function private.process_sign_in_queue(integer) from public, anon, authenticated;

commit;

/* Outside the transaction, because cron.schedule commits its own row. By name,
   so a second run replaces the same job. */
select cron.schedule('vallo-sign-in-queue', '* * * * *', 'select private.process_sign_in_queue()');

-- 5. READ-BACK -------------------------------------------------------------------

do $$
declare
  v_triggers text[];
  v_open integer;
begin
  if to_regclass('private.sign_in_queue') is null then
    raise exception 'the sign-in queue is not there';
  end if;
  if has_table_privilege('anon', 'private.sign_in_queue', 'select')
     or has_table_privilege('authenticated', 'private.sign_in_queue', 'select')
     or has_table_privilege('authenticated', 'private.sign_in_queue', 'insert') then
    raise exception 'the sign-in queue is open to anon or authenticated';
  end if;

  select array_agg(t.tgname order by t.tgname) into v_triggers
    from pg_trigger t
   where t.tgrelid = 'auth.sessions'::regclass and not t.tgisinternal;
  if v_triggers is distinct from array['sessions_queue_sign_in']::text[] then
    raise exception 'auth.sessions should carry only sessions_queue_sign_in, it carries %', v_triggers;
  end if;

  select count(*) into v_open
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname in ('queue_sign_in', 'record_sign_in_device', 'record_staff_sign_in', 'process_sign_in_queue')
     and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if v_open <> 0 then
    raise exception 'a sign-in queue function is executable by anon or authenticated';
  end if;

  if not exists (select 1 from cron.job where jobname = 'vallo-sign-in-queue') then
    raise exception 'the sign-in queue worker is not scheduled';
  end if;

  raise notice 'sign-in bookkeeping is off the sign-in: one queue insert per session, worked every minute';
end
$$;
