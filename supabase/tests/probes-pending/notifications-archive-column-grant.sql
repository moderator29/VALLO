-- NOTIFICATIONS-ARCHIVE-COLUMN-GRANT: a member may archive their own
-- notification, and still may not touch anything else on the row.
--
-- PENDING until `supabase/migrations/pending/notifications_archive_grant_2026-11-11.sql`
-- is applied. It fails today, which is the point: `notifications` is one of
-- the few tables whose write grant is COLUMN level, and db-06 reads table
-- level grants only, so when `20261108115654_notification_archive.sql` added
-- `archived_at` and widened the policy but not the grant, nothing noticed.
-- Live, `authenticated` may update `read_at` and not `archived_at`, so every
-- Archive and Archive all tap in the Activity Centre is refused 42501
-- (apps/web/src/lib/notify/centre-actions.ts).
--
-- Rolls back always.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  note   uuid;
  n      int;
begin
  insert into public.notifications (user_id, kind, title, body)
  values (member, 'booking'::public.notification_kind, 'Probe', 'Probe')
  returning id into note;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', member, 'role', 'authenticated',
                      'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);

  -- CONTROL: marking read has always been granted, so a probe that is
  -- refused everything cannot pass.
  update public.notifications set read_at = now() where id = note;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL notifications-archive-column-grant: control mark read rows=%', n; end if;

  -- THE ONE THIS PROBE EXISTS FOR.
  begin
    update public.notifications set archived_at = now() where id = note;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'PROBE_FAIL notifications-archive-column-grant: archive rows=%', n; end if;
  exception when insufficient_privilege then
    raise exception 'PROBE_FAIL notifications-archive-column-grant: a member cannot write archived_at, so Archive is refused for everybody';
  end;

  -- And unarchive, which is the same column the other way.
  update public.notifications set archived_at = null where id = note;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL notifications-archive-column-grant: unarchive rows=%', n; end if;

  -- Still nothing else: the title is not the member's to rewrite.
  begin
    update public.notifications set title = 'rewritten' where id = note;
    raise exception 'PROBE_FAIL notifications-archive-column-grant: a member rewrote a notification title';
  exception when insufficient_privilege then null; end;

  -- And still only their own rows, which is the policy rather than the grant.
  update public.notifications set read_at = now() where user_id <> member;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'PROBE_FAIL notifications-archive-column-grant: a member marked somebody else read, rows=%', n; end if;

  reset role;
  raise exception 'PROBE_OK notifications-archive-column-grant';
end $$;
