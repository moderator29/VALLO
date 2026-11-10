-- RUN 3: deletion reasons table + rent fee schedule row. Safe to run twice.

-- ===== account_deletion_reasons =====
-- WHY PEOPLE DELETE THEIR ACCOUNT (founder, 10 November 2026). The deletion
-- flow already asks for an optional reason code; until now it only reached
-- one audit line. This keeps a proper record the admin desk
-- /admin/account-deletions reads as counts and percentages.
--
-- NOT APPLIED. Additive only: one new table. Nothing existing is touched.
-- Safe to run twice (if not exists, drop policy if exists before create).
--
-- WHAT IS KEPT. The reason code (the closed list in
-- lib/account-deletion/constants.ts, plus 'not_given'), an optional note of at
-- most 500 characters ("tell us more"; the form asks for no personal data),
-- when the deletion was requested, when it was restored (null until then) and
-- a tenure bucket. user_id is nullable and ON DELETE SET NULL, so the row
-- outlives the purge of the account and then names nobody. Rates never need
-- the user_id; the desk does not select it.
--
-- WRITES. The server action writes through the service client at the moment of
-- the deletion request, and flips restored_at when the account is restored
-- inside the thirty days. No authenticated write grant, so
-- supabase/tests/probes/db-06.sql needs no allowlist entry.
--
-- READS. Admin and super admin through private.has_role (the shape of
-- staff_weekly_reports_admin_read); scoped staff reach it through the service
-- client requireAdmin hands out. The desk shows notes to a super admin only.
--
-- BACKFILL. None: checked read-only against live on 10 Nov 2026, 0 audit lines
-- of account.deletion.requested exist.

begin;

create table if not exists public.account_deletion_reasons (
  id            uuid primary key default gen_random_uuid(),
  reason        text not null default 'not_given',
  note          text,
  requested_at  timestamptz not null default now(),
  restored_at   timestamptz,
  tenure_bucket text,
  user_id       uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint account_deletion_reasons_reason_check check (reason in
    ('not_using', 'found_place', 'not_found', 'hard_to_use', 'notifications',
     'privacy', 'safety', 'second_account', 'other', 'prefer_not_to_say', 'not_given')),
  constraint account_deletion_reasons_note_len check (note is null or char_length(note) <= 500),
  constraint account_deletion_reasons_tenure_check check (tenure_bucket is null or tenure_bucket in
    ('under_30_days', '1_to_6_months', 'over_6_months')),
  constraint account_deletion_reasons_restored_after check (restored_at is null or restored_at >= requested_at)
);

comment on table public.account_deletion_reasons is
  'Why a member asked to delete their account: a reason code, an optional note (500 characters), when, whether it was restored within the grace window, and a tenure bucket. user_id goes null when the account is purged. Written by the server through the service role only.';

create index if not exists account_deletion_reasons_requested_idx
  on public.account_deletion_reasons (requested_at desc);
create index if not exists account_deletion_reasons_user_idx
  on public.account_deletion_reasons (user_id) where restored_at is null;

alter table public.account_deletion_reasons enable row level security;
revoke all on table public.account_deletion_reasons from public, anon, authenticated;
grant select on table public.account_deletion_reasons to authenticated;

drop policy if exists account_deletion_reasons_admin_read on public.account_deletion_reasons;
create policy account_deletion_reasons_admin_read on public.account_deletion_reasons
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

commit;

-- ===== fee_schedule =====
begin;
-- fee_schedule_2026-11-10.sql
-- NOT APPLIED. Founder decision, 10 November 2026: a rent payment costs about
-- 3.5 percent in total, Vallo's service fee 2 percent plus the payment
-- partner's fee about 1.5 percent. Vallo's 2 percent is already the live
-- commission (money_policy_versions.commission_bps = 200). This adds the
-- partner's share as a new dated row in public.fee_protection_rates, which the
-- lister's fee screen reads through public.lister_fee_policy. Additive: no row
-- is changed or removed, the old 200 row stays as history, and an acceptance
-- already recorded keeps the rate it was recorded against.
-- Source of truth in the app: apps/web/src/lib/money/fee-schedule.ts.

insert into public.fee_protection_rates (effective_from, protection_bps, note)
values (timestamptz '2026-11-10 00:00:00+01', 150,
        'Founder, 10 November 2026: payment partner about 1.5 percent on a rent payment; Vallo 2 percent; total about 3.5 percent. Round figure.')
on conflict (effective_from) do nothing;

-- Self-check: the newest row in force reads 150, and Vallo's commission is still 200.
do $$
declare p integer; c integer;
begin
  select protection_bps into p from public.fee_protection_rates order by effective_from desc, id desc limit 1;
  select commission_bps into c from public.money_policy_at(now());
  if p is distinct from 150 then raise exception 'fee_schedule: partner rate is %, expected 150', p; end if;
  if c is distinct from 200 then raise exception 'fee_schedule: Vallo commission is %, expected 200', c; end if;
end $$;
commit;
