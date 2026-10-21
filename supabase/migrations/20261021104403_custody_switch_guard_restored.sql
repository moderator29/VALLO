-- APPLIED 21 October 2026 (written as a draft, read against the live definition first). Check the live database before applying:
--   select pg_get_functiondef('private.guard_feature_flag_write()'::regprocedure);
--   select tgname, tgenabled, tgfoid::regproc from pg_trigger
--    where tgrelid = 'public.feature_flags'::regclass and not tgisinternal;
-- (queries 5 and 6 of docs/sql-editor/02-health-check-read-only.sql).
--
-- WHAT IT FIXES. The probe track-a-custody-retired fails on main with "the
-- wallet switch could be turned on": the live database accepted
-- `insert ... on conflict do update set enabled = true` for the key `wallet`.
-- Every migration in the repository refuses that, from
-- 20260925141824_track_a_no_flag_can_turn_custody_back_on.sql to the newest
-- definition, 20260925163708_track_a1_vallo_never_holds_customer_money_custody_retired.sql
-- (Track A: the four custody switches wallet, wallet_pots, held_payments and
-- held_payments_payouts can never be turned on, by anybody). No later ruling
-- lifts it: ADR 0003 (D69) lets partner-held money appear in Vallo-native
-- screens and keeps the custody guard, and it changes no switch. So the live
-- database has drifted: either the function lost its check or the trigger
-- feature_flags_guard_write is missing or disabled. This restores both, the
-- function exactly as 20260925163708 wrote it and the trigger exactly as
-- 20260924015442 created it. `create or replace trigger` also re-enables it.
--
-- WHAT IT DOES NOT DO. It does not touch any feature_flags row. The guard
-- fires only on a write that turns a custody switch on, so a row that is on
-- today stays on until someone turns it off. Read this first:
--   select key, enabled from public.feature_flags
--    where key in ('wallet', 'wallet_pots', 'held_payments', 'held_payments_payouts');
-- If `wallet` is on, the likely reason is the app: startCardSetup
-- (apps/web/src/lib/payments/methods-actions.ts) read the `wallet` key as the
-- switch for saving a card. Since 17 October it reads its own fail-closed
-- switch, `saved_cards`, and the `wallet` row only until this guard is back.
-- So: apply this, set `saved_cards` on if cards should be saved, then turn
-- `wallet` off (an update to false passes the guard).
--
-- Probe: supabase/tests/probes/track-a-custody-retired.sql (already in CI;
-- it raises PROBE_OK once this is applied).
set lock_timeout = '5s';

create or replace function private.guard_feature_flag_write()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  if tg_op <> 'DELETE'
     and new.key in ('wallet', 'wallet_pots', 'held_payments', 'held_payments_payouts')
     and new.enabled then
    raise exception 'custody_retired: % is a retired custody switch and cannot be turned on', new.key
      using errcode = '42501',
            hint = 'Vallo never holds customer money (Track A, 25 September 2026). There is nothing behind this switch.';
  end if;
  return coalesce(new, old);
end;
$fn$;

revoke all on function private.guard_feature_flag_write() from public, anon, authenticated;

create or replace trigger feature_flags_guard_write
  before insert or update or delete on public.feature_flags
  for each row execute function private.guard_feature_flag_write();

-- Read-back: the trigger is there and enabled, and the function refuses.
do $check$
begin
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'public.feature_flags'::regclass and tgname = 'feature_flags_guard_write'
                    and tgenabled = 'O' and tgfoid = 'private.guard_feature_flag_write'::regproc) then
    raise exception 'feature_flags_guard_write is missing, disabled or calls another function';
  end if;
  if pg_get_functiondef('private.guard_feature_flag_write()'::regprocedure) not like '%''wallet''%' then
    raise exception 'guard_feature_flag_write does not name the wallet switch';
  end if;
end
$check$;
