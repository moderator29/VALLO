-- ============================================================================
-- !!  DESTRUCTIVE.  NOT APPLIED.  READ BEFORE RUNNING.  !!
--
-- PAYLUK REMOVAL, database half (founder, 10 November 2026: "Remove Payluk.
-- What is this Payluk naming? We are not using them in our platform no more.").
--
-- This file DROPS database objects. It runs only because the founder said to
-- remove Payluk. The app half is already in the repository: it reads the NEW
-- flag key first and falls back to the old one (lib/money/protected-pay-switch.ts),
-- so this file may run before or after the deploy, in either order.
--
-- WHAT IT DOES, in order, in ONE transaction, safe to run twice:
--   0. PRE-CHECK: counts the rows in the table to be dropped and RAISES (and so
--      rolls everything back) if there is even one. Nothing is destroyed
--      silently. The table is append only (no delete is possible), so if it
--      ever holds a row the founder decides what to do with that record first.
--   1. Creates the neutral flag key payments_protected_pay_on, copying the
--      CURRENT value of payments_payluk_on (false today). on conflict do nothing.
--   2. Deletes the old flag row payments_payluk_on, ONLY after the new row
--      exists.
--   3. Drops the table public.payluk_commission_sweeps (its two triggers go
--      with it).
--   4. Drops private.payluk_sweep_append_only() (the trigger function).
--   5. Drops public.admin_payluk_commission_sweep() (the desk read, called by
--      no code).
--   6. Closing check: none of the above remains, the new flag exists.
--
-- WHAT EACH DROPPED OBJECT WAS (checked in the repository 10 November 2026):
--   payluk_commission_sweeps          the log of the commission sweep job; the
--                                     job and its code were removed on 9 Nov.
--   payluk_sweep_append_only()        its append-only / no-truncate trigger fn.
--   admin_payluk_commission_sweep()   a finance desk read of that log; nothing
--                                     in apps/web/src calls it.
-- (ledger_record_payluk_commission was already dropped on 10 Nov by
--  END_OF_BATCH_2026-11-10.sql, verified live.)
--
-- LEFT IN PLACE ON PURPOSE (listed so nobody thinks they were forgotten). None
-- of these can be removed without rewriting live data rules, and none is
-- visible to a member or to staff:
--   * the text value 'payluk' inside CHECK constraints (not Postgres enums, so
--     no enum value is involved): provider_arrangements_provider_check,
--     provider_webhook_events provider check, chargebacks provider check, the
--     ledger provider checks, financial_provider_accounts / funds_movements /
--     member_funds_reported provider values. Old rows (if any) keep reading.
--   * provider_arrangements.buyer_customer_id / seller_customer_id and the
--     constraint provider_arrangements_payluk_customers_check (the columns are
--     nullable; the constraint binds only rows whose provider is 'payluk', of
--     which there are none: zero arrangements were ever opened).
--   * the wallet tables (funds_movements, financial_provider_accounts,
--     member_funds_reported, provider_webhook_events): provider-neutral by
--     design, kept for whichever provider is chosen next.
--   * historical migration files (never rewritten).
--   Cleaning the constraint text values is a later, separate decision, once
--   the founder has decided what replaces the member wallet.
--
-- Do NOT run until the founder says so. The lead applies it.
-- ============================================================================

begin;

do $removal$
declare
  n bigint := 0;
begin
  -- 0. PRE-CHECK: no row may be lost silently.
  if to_regclass('public.payluk_commission_sweeps') is not null then
    execute 'select count(*) from public.payluk_commission_sweeps' into n;
    if n > 0 then
      raise exception 'payluk_removal: public.payluk_commission_sweeps holds % row(s); nothing was dropped. Decide what happens to that record first.', n;
    end if;
  end if;

  -- 1. The neutral flag, with the current value of the old one (false when
  --    the old row is missing: fail closed).
  insert into public.feature_flags (key, enabled, note)
  select 'payments_protected_pay_on',
         coalesce((select f.enabled from public.feature_flags f where f.key = 'payments_payluk_on'), false),
         'The protected payment rail offered to members (founder switch). Replaces the previous provider''s switch, 10 Nov 2026. Fails closed.'
  on conflict (key) do nothing;

  -- 2. The old flag row goes only once the new one exists.
  if exists (select 1 from public.feature_flags where key = 'payments_protected_pay_on') then
    delete from public.feature_flags where key = 'payments_payluk_on';
  else
    raise exception 'payluk_removal: the new flag payments_protected_pay_on does not exist; the old flag was not deleted';
  end if;
end
$removal$;

-- 3. to 5. The objects.
drop table if exists public.payluk_commission_sweeps;
drop function if exists private.payluk_sweep_append_only();
drop function if exists public.admin_payluk_commission_sweep();

-- 6. Closing check.
do $check$
begin
  if to_regclass('public.payluk_commission_sweeps') is not null
     or to_regprocedure('private.payluk_sweep_append_only()') is not null
     or to_regprocedure('public.admin_payluk_commission_sweep()') is not null then
    raise exception 'payluk_removal: a dropped object is still present';
  end if;
  if not exists (select 1 from public.feature_flags where key = 'payments_protected_pay_on') then
    raise exception 'payluk_removal: the new flag is missing';
  end if;
  if exists (select 1 from public.feature_flags where key = 'payments_payluk_on') then
    raise exception 'payluk_removal: the old flag row is still present';
  end if;
end
$check$;

commit;
