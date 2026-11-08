-- D-02: merge redundant permissive SELECT policies
--
-- Three tables carry two permissive SELECT policies that cover the same
-- side of the relationship. Postgres ORs permissive policies together, so
-- two that cover "host via listing" and "host via business" run both
-- sub-plans on every row check. One policy with an explicit OR is the
-- same grant with one plan.
--
-- bookings:     bookings_host_select + bookings_business_host_select
-- reservations: reservations_select_host + reservations_select_business_host
-- rent_payments: rent_payments_select_tenant + rent_payments_select_lister

BEGIN;

-- bookings: merge the two host-side SELECT policies into one
DROP POLICY IF EXISTS bookings_host_select ON public.bookings;
DROP POLICY IF EXISTS bookings_business_host_select ON public.bookings;

CREATE POLICY bookings_host_select ON public.bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM listings l
        JOIN agents a ON a.id = l.agent_id
       WHERE l.id = bookings.listing_id
         AND a.user_id = (SELECT auth.uid())
    )
    OR (
      accommodation_id IS NOT NULL
      AND private.owns_accommodation(accommodation_id)
    )
  );

-- reservations: merge the two host-side SELECT policies into one
DROP POLICY IF EXISTS reservations_select_host ON public.reservations;
DROP POLICY IF EXISTS reservations_select_business_host ON public.reservations;

CREATE POLICY reservations_select_host ON public.reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM listings l
        JOIN agents a ON a.id = l.agent_id
       WHERE l.id = reservations.listing_id
         AND a.user_id = (SELECT auth.uid())
    )
    OR (
      business_id IS NOT NULL
      AND business_id IN (SELECT private.my_business_ids())
    )
  );

-- rent_payments: merge tenant + lister into one "either party" policy
DROP POLICY IF EXISTS rent_payments_select_tenant ON public.rent_payments;
DROP POLICY IF EXISTS rent_payments_select_lister ON public.rent_payments;

CREATE POLICY rent_payments_select_party ON public.rent_payments
  FOR SELECT USING (
    tenant_id = (SELECT auth.uid())
    OR lister_id = (SELECT auth.uid())
  );

COMMIT;
