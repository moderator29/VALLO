-- OPTIONAL, NOT APPLIED. Run ONLY if you want every staff member to re-read the
-- handbook after the 11 November 2026 wording change to the Money section
-- ("Licensed payment partners hold payments and escrow ...").
--
-- The wording change itself ships in code and does not need this: it makes the
-- line TRUE (it used to forbid describing escrow and a balance, both of which
-- exist) without adding any new obligation, so the existing acknowledgement
-- still stands. If you DO run this, change `STAFF_HANDBOOK_VERSION` in
-- apps/web/src/lib/admin/staff-handbook.ts to '2026-11-11' in the SAME deploy,
-- or staff acknowledging the old string would be locked out of every desk.
create or replace function private.staff_handbook_version()
returns text language sql immutable set search_path to '' as $f$ select '2026-11-11'::text $f$;
-- Rollback: put '2026-09-25' back here and in staff-handbook.ts.
