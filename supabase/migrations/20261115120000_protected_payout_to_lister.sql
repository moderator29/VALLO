-- THE PAYOUT TO THE LISTER, RECORDED (15 November 2026).
--
-- The founder chose automatic payout: once the bank releases a protected
-- payment, the payment partner sends it straight on to the lister's own bank
-- account, and Vallo's balance at the partner never carries a member's money.
-- This file lets Vallo record that last step from the partner's own word, so
-- the lister is told "paid to your bank" only once the partner says so.
--
--   1. Five columns on public.provider_arrangements for the payout: its state,
--      the partner's payout id, the amount and fee, and when it was last heard
--      of and when it completed. Written by the server (service role) from the
--      partner's signed webhook or a read-back; members read them under the
--      existing parties-read policy and cannot write them.
--   2. A notice to the lister when the payout completes, fails or is reversed,
--      once per state (private.notify_once), never undoing the write it rides on.
--
-- NOT APPLIED. Additive only: no live row changes, no function is replaced,
-- provider_arrangements is empty today. One transaction; safe to run twice.
-- No object name carries a custody word (private.refuse_custody_objects).
begin;
set local lock_timeout = '5s';

-- 1 ---------------------------------------------------------------------
alter table public.provider_arrangements
  add column if not exists payout_status text,
  add column if not exists payout_reference text,
  add column if not exists payout_amount_minor bigint,
  add column if not exists payout_fee_minor bigint,
  add column if not exists payout_updated_at timestamptz,
  add column if not exists payout_completed_at timestamptz;

alter table public.provider_arrangements drop constraint if exists provider_arrangements_payout_status_check;
alter table public.provider_arrangements
  add constraint provider_arrangements_payout_status_check
  check (payout_status is null or payout_status in ('processing', 'paid', 'failed', 'reversed'));

alter table public.provider_arrangements drop constraint if exists provider_arrangements_payout_amounts_check;
alter table public.provider_arrangements
  add constraint provider_arrangements_payout_amounts_check
  check ((payout_amount_minor is null or payout_amount_minor >= 0) and (payout_fee_minor is null or payout_fee_minor >= 0));

-- A paid payout carries the moment it completed.
alter table public.provider_arrangements drop constraint if exists provider_arrangements_payout_paid_at_check;
alter table public.provider_arrangements
  add constraint provider_arrangements_payout_paid_at_check
  check (payout_status is distinct from 'paid' or payout_completed_at is not null);

-- 2 ---------------------------------------------------------------------
create or replace function private.provider_arrangements_payout_notice()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  place text;
  amt text;
  href text;
  key text;
begin
  begin
    if new.payout_status is not distinct from old.payout_status or new.payout_status = 'processing' then
      return new;
    end if;
    select * into ag from public.deal_agreements where id = new.agreement_id;
    place := coalesce(
      (select l.title from public.listings l where l.id = ag.listing_id),
      (select ac.name from public.accommodations ac where ac.id = ag.accommodation_id),
      'your agreement');
    amt := 'NGN ' || to_char(coalesce(new.payout_amount_minor, new.amount_minor)::numeric / 100, 'FM999,999,999,990.00');
    href := '/agreements/' || new.agreement_id::text || '/held';
    key := 'arrangement:' || new.id::text || ':payout:' || new.payout_status;
    if new.payout_status = 'paid' then
      perform private.notify_once(key, new.seller_user_id, 'booking', 'Paid to your bank',
        amt || ' for ' || place || ' was sent to your bank account by Vallo''s payment partner. Banks usually show it the same day.', href);
    elsif new.payout_status in ('failed', 'reversed') then
      perform private.notify_once(key, new.seller_user_id, 'booking', 'The transfer to your bank did not go through',
        'The payment for ' || place || ' was released to you, but the transfer to your bank account did not complete. '
        || 'Vallo is following it up with the payment partner. Check that your bank account on Vallo is correct.', href);
    end if;
  exception when others then
    declare
      v_state text := sqlstate;
      v_message text := sqlerrm;
    begin
      perform private.notice_failed('protected payout notice', 'deal_agreement', new.agreement_id::text, v_state, v_message);
    exception when others then
      raise warning '[notify] protected payout notice failed: %', v_state;
    end;
  end;
  return new;
end;
$function$;

revoke all on function private.provider_arrangements_payout_notice() from public, anon, authenticated;

drop trigger if exists provider_arrangements_zz_payout_notice on public.provider_arrangements;
create trigger provider_arrangements_zz_payout_notice
  after update of payout_status on public.provider_arrangements
  for each row execute function private.provider_arrangements_payout_notice();

-- Self-checks.
do $check$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'provider_arrangements' and column_name = 'payout_completed_at') then
    raise exception 'protected_payout_to_lister: the payout columns are missing';
  end if;
  if has_table_privilege('authenticated', 'public.provider_arrangements', 'update') then
    raise exception 'protected_payout_to_lister: members must not be able to write a payment record';
  end if;
end
$check$;

commit;

-- Read-back (run after; expects 6 rows and false):
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'provider_arrangements' and column_name like 'payout_%';
-- select has_table_privilege('authenticated', 'public.provider_arrangements', 'update');
