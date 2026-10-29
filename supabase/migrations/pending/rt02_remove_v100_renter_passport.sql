-- APPLIED BY HAND in the dashboard SQL editor on 29 October 2026 (the connector cannot confirm a DROP);
-- verified afterwards: public.renter_passports and the five functions are gone, passport_settings is intact.
-- Kept here as the record. Originally: RETIRED OBJECTS 2 of 2 (Part B: after the deploy).
-- Removes the old V-100 renter passport, retired in the app on 13 October
-- 2026 and replaced by the Vallo passport (pass01, pass02). This is item 3 of
-- docs/DB_NOTES.md, with exact signatures and a guard.
--
-- APPLY ONLY WHEN BOTH ARE TRUE:
--   1. pass01_passport_settings.sql has been applied. pass01 reads
--      public.renter_passports once to carry members' choices into
--      public.passport_settings. The guard below refuses to run without it.
--   2. This branch is deployed to production. origin/main still calls these
--      functions today:
--        my_renter_passport          lib/trust/passport-read.ts (twice)
--        renter_passport_for_thread  lib/trust/passport-read.ts
--        passport_shared_here        lib/trust/passport-read.ts
--        set_renter_passport         lib/trust/passport-actions.ts
--        share_renter_passport       lib/trust/passport-actions.ts
--      The new code calls none of them (only comments in pass01 and pass02
--      name them; pass02 does not call private.passport_facts).
--
-- WHAT GOES, AND WHAT READS IT TODAY (13 October 2026)
--   public.share_renter_passport(uuid, boolean)  old main only
--   public.passport_shared_here(uuid)            old main only
--   public.renter_passport_for_thread(uuid)      old main only; calls passport_facts
--   public.set_renter_passport(boolean)          old main only
--   public.my_renter_passport()                  old main only; calls passport_facts
--   private.passport_facts(uuid)                 read only by the two above
--   public.passport_shares (table)               0 rows. Read only by the five
--                                                functions above. No trigger, no
--                                                policy reads it, nothing points at it.
--   public.renter_passports (table)              1 row: ONE MEMBER'S REAL CHOICE
--                                                (passport on or off). pass01 copies
--                                                it into passport_settings; the guard
--                                                below checks the copy before the drop.
--                                                No trigger, nothing points at it.
--
-- KEPT: public.record_vnin_check (still called); private.shares_identity_with
-- (live functions read it).
--
-- After it runs: regenerate apps/web/src/lib/supabase/database.types.ts, and
-- in the same commit take check 5 out of
-- supabase/tests/probes/pass01-passport-settings.sql (it reads
-- public.renter_passports and would fail once the table is gone).
--
-- RUN IN THE DASHBOARD SQL EDITOR: the agents' migration connector waits on a
-- confirmation for DROP that never arrives (docs/DB_NOTES.md).
-- Probe: supabase/tests/probes-pending/rt02-remove-v100-renter-passport.sql
set lock_timeout = '5s';

-- GUARD: pass01 ran, and every explicit V-100 choice is in passport_settings.
do $guard$
declare
  missed integer;
begin
  if to_regclass('public.passport_settings') is null then
    raise exception 'rt02: apply pass01_passport_settings.sql first (public.passport_settings is missing)';
  end if;
  if to_regclass('public.renter_passports') is not null then
    execute $q$
      select count(*) from public.renter_passports rp
       where not exists (select 1 from public.passport_settings s
                          where s.user_id = rp.user_id and s.enabled = rp.enabled)
    $q$ into missed;
    if missed <> 0 then
      raise exception 'rt02: % renter passport choice(s) were not carried into passport_settings', missed;
    end if;
  end if;
end
$guard$;

-- Functions first (callers before what they call), then the tables they read.
drop function if exists public.share_renter_passport(uuid, boolean);
drop function if exists public.passport_shared_here(uuid);
drop function if exists public.renter_passport_for_thread(uuid);
drop function if exists public.set_renter_passport(boolean);
drop function if exists public.my_renter_passport();
drop function if exists private.passport_facts(uuid);
drop table if exists public.passport_shares;
drop table if exists public.renter_passports;

-- READ-BACK
do $check$
begin
  if to_regprocedure('public.share_renter_passport(uuid, boolean)') is not null
     or to_regprocedure('public.passport_shared_here(uuid)') is not null
     or to_regprocedure('public.renter_passport_for_thread(uuid)') is not null
     or to_regprocedure('public.set_renter_passport(boolean)') is not null
     or to_regprocedure('public.my_renter_passport()') is not null
     or to_regprocedure('private.passport_facts(uuid)') is not null
     or to_regclass('public.passport_shares') is not null
     or to_regclass('public.renter_passports') is not null then
    raise exception 'rt02: a V-100 passport object is still present';
  end if;
  if to_regclass('public.passport_settings') is null
     or to_regprocedure('public.record_vnin_check(uuid, text, text, text, boolean, text)') is null
     or to_regprocedure('private.shares_identity_with(uuid, uuid)') is null then
    raise exception 'rt02: a live object went with the passport';
  end if;
end
$check$;
