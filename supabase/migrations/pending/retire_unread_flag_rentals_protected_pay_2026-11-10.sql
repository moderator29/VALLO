-- Retire one feature flag that nothing reads (removal audit, 10 November 2026).
--
-- `rentals_protected_pay` was the switch for protected rent payment. It was
-- superseded by `payments_payluk_on` (which `private.rentals_protected_pay_on()`
-- reads) and is now read by nothing: no application code (grep of apps/web/src)
-- and no database function (pg_proc search on 10 November 2026). It is false.
-- Deleting the row changes no behaviour: a missing flag reads as off.
--
-- NOT APPLIED. For the founder's end-of-batch block. Deletes one row only.
begin;

delete from public.feature_flags
where key = 'rentals_protected_pay'
  and enabled = false;

commit;
