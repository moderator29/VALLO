-- APPLIED 21 October 2026 (written as a draft, read against the live definition first). A SEATING DISPUTE IS DECIDED ONLY BY STAFF WHO ARE NOT A
-- PARTY TO THE TABLE, AND ONLY WHILE IT IS OPEN.
--
-- What it fixes: `public.reservation_resolve_seating`
-- (20261013062857_restaurant_seating_f_diner_and_admin_functions.sql) checked
-- only that the caller is admin or super_admin. So:
--   * a staff member who booked the table, owns the restaurant, or is the agent
--     listing the venue could settle it in their own favour (the fee per seated
--     table and the right to review both follow the outcome);
--   * any table could be overruled, disputed or not, and a decided dispute
--     decided again.
-- The app refuses both since this branch (`resolveSeatingDispute`,
-- apps/web/src/lib/reservations/seating-actions.ts); this makes the database
-- refuse too. New answers: `own_table`, `not_disputed`, `not_found`.
--
-- BEFORE APPLYING: read the live definition
--   select pg_get_functiondef('public.reservation_resolve_seating(uuid, text)'::regprocedure);
-- and check it still matches the 20261013062857 body (the one below adds the
-- party and open-dispute checks and a row lock). Check grants after.
-- Probe: supabase/tests/probes-pending/seating-dispute-guards.sql (move it to
-- probes/ when this is recorded as applied).
set lock_timeout = '5s';

create or replace function public.reservation_resolve_seating(p_reservation uuid, p_outcome text)
returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare
  r public.reservations%rowtype;
  s public.reservation_seatings%rowtype;
  me uuid := auth.uid();
begin
  if not (private.has_role(me, 'admin'::public.app_role)
          or private.has_role(me, 'super_admin'::public.app_role)) then
    return jsonb_build_object('status', 'not_staff');
  end if;
  if p_outcome not in ('SEATED', 'NO_SHOW') then
    return jsonb_build_object('status', 'bad_outcome');
  end if;
  select * into r from public.reservations where id = p_reservation;
  if r.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  -- Nobody decides a table they booked, own or list.
  if r.guest_id = me
     or (r.business_id is not null and exists (
           select 1 from public.businesses b where b.id = r.business_id and b.owner_id = me))
     or (r.listing_id is not null and exists (
           select 1 from public.listings l join public.agents a on a.id = l.agent_id
            where l.id = r.listing_id and a.user_id = me)) then
    return jsonb_build_object('status', 'own_table');
  end if;
  select * into s from public.reservation_seatings where reservation_id = p_reservation for update;
  if s.reservation_id is null or s.disputed_at is null or s.dispute_resolved_at is not null then
    return jsonb_build_object('status', 'not_disputed');
  end if;
  perform private.settle_seating(p_reservation, p_outcome, 'admin');
  update public.reservation_seatings
     set dispute_resolved_at = now(), dispute_resolved_by = me
   where reservation_id = p_reservation;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (me, 'reservation.seating_resolved', 'reservation', p_reservation::text,
          jsonb_build_object('outcome', p_outcome));
  return jsonb_build_object('status', 'resolved', 'outcome', p_outcome);
end $fn$;
revoke all on function public.reservation_resolve_seating(uuid, text) from public, anon;
grant execute on function public.reservation_resolve_seating(uuid, text) to authenticated;
