-- THE STAFF HANDBOOK, VERSION 2026-11-16 (founder, 16 November 2026: the two
-- copilot rules become rules staff accept: "a card you press in the copilot is
-- your decision" and "never paste an ID, bank or card number, a password or a
-- document into the copilot").
--
-- NOT APPLIED. RUN IT RIGHT AFTER THE PUSH TO MAIN IS LIVE, not before.
-- The code that ships with it writes and shows version '2026-11-16'
-- (apps/web/src/lib/admin/staff-handbook.ts). Run before the deploy, the
-- database would ask for '2026-11-16' while the live app still writes the old
-- string, and every staff member would be locked out of every desk until the
-- deploy landed. Run after it, each staff member is asked to read and accept
-- the handbook once more, then carries on.
--
-- Supersedes staff_handbook_reack_2026-11-11.sql (never run): its wording
-- change is already in the handbook and this re-acknowledgement covers it.
--
-- One function, replaced. Nothing else is touched. Safe to run twice.
create or replace function private.staff_handbook_version()
returns text language sql immutable set search_path to '' as $f$ select '2026-11-16'::text $f$;

do $check$
begin
  if private.staff_handbook_version() <> '2026-11-16' then
    raise exception 'staff handbook self-check: version is %', private.staff_handbook_version();
  end if;
  raise notice 'staff handbook self-check passed: version 2026-11-16';
end;
$check$;
-- Rollback: put '2026-09-25' back here and in staff-handbook.ts.
