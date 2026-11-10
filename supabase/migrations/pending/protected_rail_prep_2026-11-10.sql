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
begin;

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

commit;
