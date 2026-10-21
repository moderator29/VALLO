-- BOOKING-IS-PAID-NEVER-NULL: private.booking_is_paid answers true or false,
-- never NULL. pov05 made it `exists(...) or <partner position> in (...)`, which
-- is NULL for a booking with no payment and no partner arrangement, and every
-- guard written as `not private.booking_is_paid(...)` then let an unpaid stay
-- through (my_stay_details revealed the address and gate code; check-in took an
-- unpaid stay). Fixed by 20261021105606_booking_is_paid_never_null.sql (applied 21 October 2026).
-- Read-only: a booking id that does not exist has no payment and no arrangement.
do $$
declare
  answer boolean;
begin
  answer := private.booking_is_paid(gen_random_uuid());
  if answer is null then
    raise exception 'PROBE_FAIL booking-is-paid-never-null: an unpaid booking with no arrangement reads NULL, so `not booking_is_paid` guards let it through';
  end if;
  if answer then
    raise exception 'PROBE_FAIL booking-is-paid-never-null: a booking that does not exist reads as paid';
  end if;
  raise exception 'PROBE_OK booking-is-paid-never-null';
end
$$;
