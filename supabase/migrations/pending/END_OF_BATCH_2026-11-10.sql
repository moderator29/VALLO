-- VALLO: THE END-OF-BATCH SQL BLOCK (10 November 2026)
--
-- Paste ALL of this into the Supabase SQL Editor (project uccixoonmbhrnyczyigt)
-- and press Run once. It runs as ONE transaction: if any line fails, nothing
-- at all is changed, and you send the error back.
--
-- What it does, in order:
--   1. Protected payment categories, all DISABLED, and the EscrowPay switch, OFF.
--   2. The database preparation for the EscrowPay rail (switched off).
--   3. Removes two dead Payluk database objects (no data touched).
--   4. Removes one unused feature flag row (it is off and nothing reads it).
--
-- Nothing here turns any payment on, moves money or touches a member's data.
-- Parts 1 and 2 were each dry-run against the live database inside a
-- rolled-back transaction (9 and 10 November 2026); parts 3 and 4 are two
-- drops and one row delete, checked against the live catalogue.
--
-- The last statement prints a short check. Send that result back.

begin;
set local lock_timeout = '5s';

-- ==================================================================== PART 1 of 4
-- protected_payment_categories_all_disabled_2026-11-09.sql
-- The eight protected payment categories, all disabled, with their append-only history; the switch payments_escrowpay_on (OFF) and the partner mark flag.

-- PROTECTED PAYMENT CATEGORIES, ALL DISABLED (9 November 2026).
--
-- PROTECTED_PAYMENTS_BUILD.md section 9: which deals may ever reach the
-- protected rail (EscrowPay, built and switched off). Eight categories, each
-- `approved`, `pending_approval`, `not_supported` or `disabled`; every one
-- starts DISABLED. A category becomes approved only on the provider's written
-- approval naming Vallo's use case, recorded with its reference, the date and
-- the founder's sign-off; a successful sandbox payment is not approval. The
-- code's half is apps/web/src/lib/money/protected-categories.ts.
--
-- Members never read or write these tables: the server asks
-- private.protected_category_status(), which answers 'disabled' for anything
-- it cannot find. A row is never deleted, and every change is written to the
-- append-only event table. Additive only: two new tables, four functions,
-- three triggers, two feature flag rows, both of which leave the rail OFF.


create table if not exists public.protected_payment_categories (
  category               text primary key check (category in (
                           'residential_rent', 'shortlet', 'hotel_booking', 'commercial_rent',
                           'property_sale', 'land_sale', 'event_space', 'other')),
  status                 text not null default 'disabled'
                           check (status in ('approved', 'pending_approval', 'not_supported', 'disabled')),
  provider_approval_ref  text,
  approved_at            timestamptz,
  founder_signoff_by     uuid references auth.users(id) on delete set null,
  founder_signoff_at     timestamptz,
  note                   text,
  updated_at             timestamptz not null default now(),
  constraint protected_payment_categories_approval_is_written check (
    status <> 'approved'
    or (length(btrim(coalesce(provider_approval_ref, ''))) >= 4
        and approved_at is not null
        and founder_signoff_by is not null
        and founder_signoff_at is not null))
);

comment on table public.protected_payment_categories is
  'Which deal categories may reach the protected rail. All start disabled; approved only with the provider''s written approval reference, its date and the founder''s sign-off (PROTECTED_PAYMENTS_BUILD.md section 9). Never deleted; changes logged in protected_payment_category_events.';

create table if not exists public.protected_payment_category_events (
  id           bigint generated always as identity primary key,
  category     text not null references public.protected_payment_categories(category),
  from_status  text,
  to_status    text not null,
  provider_approval_ref text,
  changed_by   uuid,
  changed_at   timestamptz not null default now(),
  note         text
);

comment on table public.protected_payment_category_events is
  'Append-only history of every change to protected_payment_categories.';

alter table public.protected_payment_categories enable row level security;
alter table public.protected_payment_category_events enable row level security;
revoke all on public.protected_payment_categories from public, anon, authenticated;
revoke all on public.protected_payment_category_events from public, anon, authenticated;

create or replace function private.protected_payment_categories_guard()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'a protected payment category is set to disabled, never deleted'
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' then
    if new.category is distinct from old.category then
      raise exception 'a category never changes its name' using errcode = 'insufficient_privilege';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists protected_payment_categories_00_guard on public.protected_payment_categories;
create trigger protected_payment_categories_00_guard
  before insert or update or delete on public.protected_payment_categories
  for each row execute function private.protected_payment_categories_guard();

/* After the row is saved (so the history's reference to it holds), every new
   category and every change of status or approval reference is logged. */
create or replace function private.protected_payment_categories_log()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status
     or new.provider_approval_ref is distinct from old.provider_approval_ref then
    insert into public.protected_payment_category_events
      (category, from_status, to_status, provider_approval_ref, changed_by, note)
    values
      (new.category, case when tg_op = 'UPDATE' then old.status end, new.status,
       new.provider_approval_ref, coalesce(new.founder_signoff_by, auth.uid()), new.note);
  end if;
  return null;
end;
$function$;

revoke all on function private.protected_payment_categories_log() from public, anon, authenticated;

drop trigger if exists protected_payment_categories_zz_log on public.protected_payment_categories;
create trigger protected_payment_categories_zz_log
  after insert or update on public.protected_payment_categories
  for each row execute function private.protected_payment_categories_log();

create or replace function private.protected_payment_category_events_append_only()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception 'the category history is append-only' using errcode = 'insufficient_privilege';
end;
$function$;

drop trigger if exists protected_payment_category_events_append_only on public.protected_payment_category_events;
create trigger protected_payment_category_events_append_only
  before update or delete on public.protected_payment_category_events
  for each row execute function private.protected_payment_category_events_append_only();

/* The one read: anything missing, unknown or unreadable is 'disabled'. */
create or replace function private.protected_category_status(p_category text)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    (select c.status from public.protected_payment_categories c where c.category = p_category),
    'disabled');
$function$;

revoke all on function private.protected_category_status(text) from public, anon, authenticated;

insert into public.protected_payment_categories (category, status, note)
select c, 'disabled', 'Seeded disabled, 9 November 2026: no written approval yet.'
  from unnest(array['residential_rent', 'shortlet', 'hotel_booking', 'commercial_rent',
                    'property_sale', 'land_sale', 'event_space', 'other']) as c
on conflict (category) do nothing;

/* The founder's switch for the new provider: OFF, and the kill switch fails
   closed on a missing or failed read. The partner mark (Option 2, "Secured
   by" beside the pay button) is the presentation choice; it draws nothing
   while the rail is off and the mark asset has not been supplied. */
insert into public.feature_flags (key, enabled, note)
values
  ('payments_escrowpay_on', false,
   'The founder''s switch for the EscrowPay protected rail. Off until the signed agreement, sandbox credentials and written category approval (PROTECTED_PAYMENTS_BUILD.md section 0). Fails closed.'),
  ('protected_partner_mark_on', true,
   'Option 2 presentation: a small Secured by mark beside the pay button on a protected payment. Off means full white label (Option 3).')
on conflict (key) do nothing;

-- ==================================================================== PART 2 of 4
-- protected_rail_prep_2026-11-10.sql
-- The protected rail's database preparation: provider id, lifecycle columns, two new states, webhook provider, protected rent switch on the new flag. Ends with self-checks.

-- PROTECTED PAYMENT RAIL, DATABASE PREPARATION (audit section 10.6, items 1 to
-- 5 and 8; 10 November 2026). Built switched off: nothing here opens,
-- funds or releases anything, and no live money row is touched (there are no
-- protected arrangements: provider_arrangements is empty).
--
-- NOT APPLIED. For the founder's end-of-batch block, after
-- protected_payment_categories_all_disabled_2026-11-09.sql (which adds the
-- payments_escrowpay_on flag, false). Safe to run twice.
--
-- What it does:
--   1. provider_arrangements.provider may also be 'escrowpay'.
--   2. The two Payluk customer ids become nullable, but a Payluk row still
--      needs both (a check keeps the old rule for the old provider).
--   3. Nullable columns the new provider's lifecycle records. None is read
--      by anything live yet.
--   4. Two new Vallo states, refund_requested and requires_review, in the
--      status check and in private.provider_arrangement_step_ok (its twin is
--      ARRANGEMENT_STEPS in apps/web/src/lib/money/arrangement-states.ts).
--   5. provider_webhook_events.provider may also be 'escrowpay'.
--   8. private.rentals_protected_pay_on() reads payments_escrowpay_on instead
--      of payments_payluk_on (both false today; rent payment is also closed
--      in code, lib/rent/payment-open.ts).
--
-- No object name contains a custody word (private.refuse_custody_objects).

-- 1
alter table public.provider_arrangements drop constraint if exists provider_arrangements_provider_check;
alter table public.provider_arrangements
  add constraint provider_arrangements_provider_check check (provider = any (array['payluk'::text, 'escrowpay'::text]));

-- 2
alter table public.provider_arrangements alter column buyer_customer_id drop not null;
alter table public.provider_arrangements alter column seller_customer_id drop not null;
alter table public.provider_arrangements drop constraint if exists provider_arrangements_payluk_customers_check;
alter table public.provider_arrangements
  add constraint provider_arrangements_payluk_customers_check
  check (provider <> 'payluk' or (buyer_customer_id is not null and seller_customer_id is not null));

-- 3
alter table public.provider_arrangements
  add column if not exists category text,
  add column if not exists provider_reference text,
  add column if not exists environment text,
  add column if not exists accepted_agreement_version integer,
  add column if not exists funding_instructions jsonb,
  add column if not exists funding_expires_at timestamptz,
  add column if not exists funded_at timestamptz,
  add column if not exists release_requested_at timestamptz,
  add column if not exists release_confirmed_at timestamptz,
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refund_confirmed_at timestamptz,
  add column if not exists last_provider_check_at timestamptz,
  add column if not exists last_webhook_at timestamptz,
  add column if not exists last_reconcile_at timestamptz,
  add column if not exists last_reconcile_result text,
  add column if not exists review_reason text;

alter table public.provider_arrangements drop constraint if exists provider_arrangements_environment_check;
alter table public.provider_arrangements
  add constraint provider_arrangements_environment_check
  check (environment is null or environment = any (array['sandbox'::text, 'production'::text]));
alter table public.provider_arrangements drop constraint if exists provider_arrangements_review_reason_check;
alter table public.provider_arrangements
  add constraint provider_arrangements_review_reason_check
  check (review_reason is null or length(review_reason) between 3 and 1000);

-- 4
alter table public.provider_arrangements drop constraint if exists provider_arrangements_status_check;
alter table public.provider_arrangements
  add constraint provider_arrangements_status_check check (status = any (array[
    'preparing'::text, 'unknown'::text, 'failed'::text, 'awaiting_payment'::text, 'payment_processing'::text,
    'protected'::text, 'release_requested'::text, 'released'::text, 'disputed'::text, 'refunded'::text,
    'split'::text, 'cancelled'::text, 'refund_requested'::text, 'requires_review'::text]));

create or replace function private.provider_arrangement_step_ok(p_from text, p_to text)
 returns boolean
 language sql
 immutable
 set search_path to ''
as $function$
  select case p_from
    when 'preparing' then p_to in ('unknown', 'failed', 'awaiting_payment')
    when 'unknown' then p_to in ('failed', 'awaiting_payment', 'payment_processing', 'protected', 'disputed',
                                 'released', 'refunded', 'split', 'cancelled', 'requires_review')
    when 'awaiting_payment' then p_to in ('payment_processing', 'protected', 'disputed', 'released', 'refunded',
                                          'split', 'cancelled', 'requires_review')
    -- Back to awaiting_payment only when the provider refused before charging.
    when 'payment_processing' then p_to in ('awaiting_payment', 'protected', 'disputed', 'released', 'refunded', 'split',
                                            'requires_review')
    when 'protected' then p_to in ('release_requested', 'disputed', 'released', 'refunded', 'split',
                                   'refund_requested', 'requires_review')
    -- Back to protected only when the provider refused the release request.
    when 'release_requested' then p_to in ('protected', 'disputed', 'released', 'refunded', 'split', 'requires_review')
    when 'disputed' then p_to in ('released', 'refunded', 'split', 'refund_requested', 'requires_review')
    -- Back to protected only when the provider refused the refund instruction.
    when 'refund_requested' then p_to in ('protected', 'disputed', 'refunded', 'requires_review')
    -- A person resolves a review; money still moves only on the provider's word.
    when 'requires_review' then p_to in ('protected', 'release_requested', 'refund_requested', 'disputed',
                                         'released', 'refunded', 'failed', 'cancelled')
    else false
  end
$function$;

-- 5
alter table public.provider_webhook_events drop constraint if exists provider_webhook_events_provider_check;
alter table public.provider_webhook_events
  add constraint provider_webhook_events_provider_check
  check (provider = any (array['payluk'::text, 'paystack'::text, 'yellowcard'::text, 'dojah'::text, 'escrowpay'::text]));

-- 8
create or replace function private.rentals_protected_pay_on()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce((select f.enabled from public.feature_flags f where f.key = 'payments_escrowpay_on'), false);
$function$;

-- Self-checks: fail the whole block rather than leave it half right.
do $check$
begin
  if not private.provider_arrangement_step_ok('protected', 'refund_requested')
     or not private.provider_arrangement_step_ok('refund_requested', 'refunded')
     or not private.provider_arrangement_step_ok('requires_review', 'protected')
     or private.provider_arrangement_step_ok('released', 'requires_review')
     or private.provider_arrangement_step_ok('refunded', 'released')
     or private.provider_arrangement_step_ok('refund_requested', 'released') then
    raise exception 'protected_rail_prep: step table is wrong';
  end if;
  if private.rentals_protected_pay_on() and not coalesce((select enabled from public.feature_flags where key = 'payments_escrowpay_on'), false) then
    raise exception 'protected_rail_prep: rentals_protected_pay_on reads the wrong flag';
  end if;
end
$check$;

-- ==================================================================== PART 3 of 4
-- payluk_dead_objects_2026-11-09.sql
-- Two dead Payluk objects: a never-called function and a duplicate trigger. No row touched.

-- Payluk clearing, the database half that is safe now (founder, 9 November
-- 2026: database objects are never dropped automatically; they go into his
-- one SQL block with a line each saying what it was and why it is safe).
-- Checked live on 9 November 2026 before writing this file.

-- 1. public.ledger_record_payluk_commission(uuid, bigint, text, uuid).
--    WHAT IT WAS: the escrow rail's commission posting (out of customer funds,
--    into revenue), written for Payluk because Payluk could not split a payment.
--    WHY IT IS SAFE: no code has ever called it. Its only wrapper,
--    recordEscrowCommission in lib/ledger/record.ts, had no caller and was
--    removed as dead code the same day; pg_depend shows nothing depending on
--    it; the b2-ledger probe's assertions about it were retired with a dated
--    note. No ledger row is touched: dropping a function removes no history.
drop function if exists public.ledger_record_payluk_commission(uuid, bigint, text, uuid);

-- 2. The trigger provider_arrangements_00_payable and its function.
--    WHAT IT WAS: the first agreement-payable check on a new arrangement.
--    WHY IT IS SAFE: provider_arrangements_00_payable_gate runs the SAME check
--    (private.agreement_payable) on every insert, and also on a status change
--    into payment_processing, so the older trigger adds nothing; both were
--    firing on every insert. Compared live, function body against function body.
drop trigger if exists provider_arrangements_00_payable on public.provider_arrangements;
drop function if exists private.provider_arrangements_payable();

-- ==================================================================== PART 4 of 4
-- retire_unread_flag_rentals_protected_pay_2026-11-10.sql
-- One flag row nothing reads (false). No behaviour changes.

-- Retire one feature flag that nothing reads (removal audit, 10 November 2026).
--
-- `rentals_protected_pay` was the switch for protected rent payment. It was
-- superseded by `payments_payluk_on` (which `private.rentals_protected_pay_on()`
-- reads) and is now read by nothing: no application code (grep of apps/web/src)
-- and no database function (pg_proc search on 10 November 2026). It is false.
-- Deleting the row changes no behaviour: a missing flag reads as off.
--
-- NOT APPLIED. For the founder's end-of-batch block. Deletes one row only.

delete from public.feature_flags
where key = 'rentals_protected_pay'
  and enabled = false;

-- ==================================================================== CHECK
select
  (select count(*) from public.protected_payment_categories where status = 'disabled') as categories_disabled,
  (select enabled from public.feature_flags where key = 'payments_escrowpay_on') as escrowpay_switch_on,
  (select count(*) from public.feature_flags where key = 'rentals_protected_pay') as unused_flag_left,
  private.rentals_protected_pay_on() as protected_rent_on,
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'provider_arrangements_provider_check') as providers_allowed,
  (select count(*) from pg_trigger where tgname = 'provider_arrangements_00_payable') as duplicate_trigger_left;

commit;
