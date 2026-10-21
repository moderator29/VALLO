-- APPLIED 21 October 2026. URGENT: private.booking_is_paid answers NULL, not false,
-- for an unpaid booking with no partner arrangement, and every guard written
-- as `not private.booking_is_paid(...)` then lets the unpaid booking through.
--
-- WHAT IS WRONG (found 17 October 2026 from the CI probe run on main, probes
-- d75b-stay-trip-details and p1_f_stay_events, both failing against the live
-- database since pov05):
--   pov05 (20261013170856) redefined the function as
--     exists (... t.status = 'SUCCESSFUL')
--       or private.booking_partner_position(p_booking) in ('terminal', 'held')
--   booking_partner_position returns NULL when no arrangement speaks for the
--   booking, so `NULL in (...)` is NULL, and `false or NULL` is NULL. In
--   plpgsql `if not NULL then` does not run its branch, so:
--     * public.my_stay_details returns the address, check-in times, the host's
--       name and, for a listing stay, the gate access code to a guest whose
--       confirmed booking is unpaid (probe d75b 2: "revealed before payment");
--     * the stay check-in path accepts an unpaid stay (probe p1_f 5);
--     * any other `not booking_is_paid` guard is open the same way.
--   Guards written as `if booking_is_paid(...)` or `where booking_is_paid(...)`
--   were already safe, since NULL is not true.
--
-- THE FIX: the function always answers true or false. Same signature, same
-- grants, same meaning for every booking that has a payment or a partner hold.
--
-- BEFORE APPLYING: read the live definition and confirm it still matches pov05:
--   select pg_get_functiondef('private.booking_is_paid(uuid)'::regprocedure);
-- After applying, run probes d75b-stay-trip-details, p1_f_stay_events and
-- booking-is-paid-never-null; each should raise PROBE_OK.
set lock_timeout = '5s';

create or replace function private.booking_is_paid(p_booking uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $fn$
  select exists (select 1 from public.transactions t where t.booking_id = p_booking and t.status = 'SUCCESSFUL')
      or coalesce(private.booking_partner_position(p_booking) in ('terminal', 'held'), false);
$fn$;
