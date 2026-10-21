-- APPLIED 21 October 2026 (written as a draft, read against the live definition first). Check against the live definition before applying:
--   select pg_get_functiondef('public.resolve_inspection_no_show(uuid, boolean)'::regprocedure);
-- It must still match 20261013063125_viewing_no_show_c_functions.sql apart
-- from the lines marked NEW below; if it has drifted, re-base this on the live
-- body rather than applying it as written.
--
-- WHAT IT FIXES. `resolve_inspection_no_show` checks that the caller is an
-- admin, but not WHO the caller is, so an admin who reported the no-show, or
-- who was said to have stayed away, or who is either side of the viewing,
-- could decide their own dispute. Every other admin desk refuses self-review.
-- The app now refuses it too (`resolveNoShow` in
-- apps/web/src/lib/inspections/no-show-actions.ts, which also covers a scoped
-- staff member calling through the service role, where auth.uid() is null);
-- this is the half an attacker cannot skip for a signed-in admin.
--
-- The function body is otherwise unchanged. Probe:
-- supabase/tests/probes-pending/no-show-dispute-self-review.sql (move it to probes/ once applied).

set lock_timeout = '5s';

create or replace function public.resolve_inspection_no_show(p_inspection uuid, p_upheld boolean)
returns text
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  caller   uuid := (select auth.uid());
  s        record;
  property text;
  word     text;
begin
  if caller is not null
     and not private.has_role(caller, 'admin'::public.app_role)
     and not private.has_role(caller, 'super_admin'::public.app_role) then
    raise exception 'staff only' using errcode = '42501';
  end if;
  if p_upheld is null then
    raise exception 'say upheld or overturned' using errcode = '22023';
  end if;

  -- NEW: i.requester_id is read so every party can be named below.
  select n.inspection_id, n.reported_by, n.absent_id, n.disputed_at, n.resolved_at,
         i.listing_id, i.lister_id, i.requester_id
    into s
    from public.inspection_no_shows n
    join public.inspection_requests i on i.id = n.inspection_id
   where n.inspection_id = p_inspection
   for update of n;
  if not found or s.disputed_at is null then
    raise exception 'no open dispute' using errcode = 'P0001', hint = 'no_show_no_dispute';
  end if;
  if s.resolved_at is not null then
    raise exception 'already resolved' using errcode = 'P0001', hint = 'no_show_already_resolved';
  end if;
  -- NEW: nobody decides a dispute they are part of.
  if caller is not null and caller in (s.reported_by, s.absent_id, s.lister_id, s.requester_id) then
    raise exception 'a party cannot decide this dispute' using errcode = '42501', hint = 'no_show_party';
  end if;

  word := case when p_upheld then 'upheld' else 'overturned' end;
  update public.inspection_no_shows
     set resolved_at = now(), resolution = word, resolved_by = caller
   where inspection_id = p_inspection;

  update public.risk_alerts
     set status = 'resolved', resolved_at = now(), resolved_by = caller
   where entity_type = 'inspection_no_show'
     and entity_id = p_inspection::text
     and status = 'open';

  select l.title into property from public.listings l where l.id = s.listing_id;
  perform private.notify(
    who,
    'listing'::public.notification_kind,
    case when p_upheld then 'No-show stands' else 'No-show removed' end,
    'Vallo looked at the no-show on the viewing of ' || coalesce(property, 'the property') || ': '
      || case when p_upheld then 'it stands.' else 'it has been taken off the record.' end,
    case when who = s.lister_id then '/agent/inspections' else '/inspections' end
  )
  from unnest(array[s.reported_by, s.absent_id]) as who;
  return word;
end;
$fn$;

revoke all on function public.resolve_inspection_no_show(uuid, boolean) from public, anon;
grant execute on function public.resolve_inspection_no_show(uuid, boolean) to authenticated;
