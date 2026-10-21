-- APPLIED 21 October 2026 (written as a draft, read against the live definition first). Check against the live definition before applying:
--   select pg_get_functiondef('public.account_deletion_blockers(uuid)'::regprocedure);
-- It must still match 20260924020602_the_purge_erases_what_it_promises_and_never_money.sql
-- apart from the lines marked NEW below; if it has drifted, re-base this on the
-- live body rather than applying it as written. Also confirm the live columns:
--   provider_arrangements (buyer_user_id, seller_user_id, amount_minor, status) and
--   its status check, rewards_ledger (member_id, amount_minor), rewards_payouts
--   (member_id, status) and its status check, and private.referral_policy_now()
--   returning payouts_enabled and withdrawal_min_minor.
--
-- WHAT IT FIXES. A deletion could start while a licensed partner held or was
-- moving money for this person, and while Vallo still owed them a rewards
-- balance or was sending one to their bank. account_deletion_blockers counted
-- rent refunds, bookings, tables, listings and businesses, and nothing of
-- either. It now answers three more numbers, and 'blocked' includes them, so
-- schedule_account_deletion (which refuses when 'blocked' is true) refuses too:
--
--   partner_held_minor          kobo in provider_arrangements where this person is
--                               the buyer or the seller and the money is held or
--                               in motion at the partner: 'payment_processing',
--                               'protected', 'release_requested', 'disputed', and
--                               'unknown' (the partner's answer was lost, so money
--                               may have moved; staff read it back).
--   rewards_withdrawable_minor  the Rewards Balance (sum of rewards_ledger) when it
--                               can actually be withdrawn: positive, at or over the
--                               policy's withdrawal minimum, and payouts on. A
--                               balance that cannot be withdrawn does not block,
--                               because a blocker with no way out is a dead end
--                               (the rule apps/web/src/lib/account-deletion/
--                               preconditions.ts is built on); the deletion screen
--                               does not hold a data-protection right hostage to a
--                               balance the person cannot move.
--   rewards_payouts_in_flight   rewards payouts 'under_review', 'processing', 'sent'
--                               or 'unknown' (the set my_rewards_summary counts as
--                               sent): money on its way to their bank.
--
-- The app reads the three numbers (readingFrom) and shows a line and a link for
-- each (blockersFrom). No row changes. Grants are kept by CREATE OR REPLACE
-- (EXECUTE for authenticated and service_role; the self-only check is unchanged).
-- Probe: supabase/tests/probes-pending/deletion-waits-for-partner-money.sql
-- (move it to probes/ once applied).

set lock_timeout = '5s';

create or replace function public.account_deletion_blockers(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_money     jsonb;
  v_listings  integer := 0;
  v_business  integer := 0;
  v_payouts   integer;
  v_held      bigint;
  -- NEW
  v_partner   bigint  := 0;
  v_rewards   bigint  := 0;
  v_reward_ok boolean := false;
  v_min       bigint;
  v_in_flight integer := 0;
begin
  if p_user is null then
    raise exception 'account_deletion_blockers needs a user'
      using errcode = 'invalid_parameter_value';
  end if;

  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user)
       is distinct from 'service_role'
     and (select auth.uid()) is distinct from p_user then
    raise exception 'account_deletion_blockers may only be asked about yourself'
      using errcode = 'insufficient_privilege';
  end if;

  v_money   := private.deletion_money_blockers(p_user);
  v_payouts := (v_money ->> 'pending_payouts')::integer;
  v_held    := (v_money ->> 'wallet_held_minor')::bigint;

  select count(*) into v_listings
    from public.listings l
    join public.agents a on a.id = l.agent_id
   where a.user_id = p_user
     and l.status = 'PUBLISHED';

  select count(*) into v_business
    from public.businesses b
   where b.owner_id = p_user
     and b.source = 'first_party'
     and (
       b.status = 'PUBLISHED'
       or exists (
         select 1 from public.accommodations a
          where a.business_id = b.id and a.status = 'PUBLISHED')
       or exists (
         select 1 from public.reservations r
          where r.business_id = b.id
            and r.status in ('PENDING', 'CONFIRMED')
            and r.reserved_for >= now())
       or (
         (v_payouts > 0 or v_held <> 0)
         and (
           exists (select 1 from public.accommodations a where a.business_id = b.id)
           or exists (select 1 from public.reservations r where r.business_id = b.id)
         )
       )
     );

  -- NEW: money a licensed partner holds or is moving for this person, either side of the deal.
  select coalesce(sum(pa.amount_minor), 0) into v_partner
    from public.provider_arrangements pa
   where (pa.buyer_user_id = p_user or pa.seller_user_id = p_user)
     and pa.status in ('unknown', 'payment_processing', 'protected', 'release_requested', 'disputed');

  -- NEW: the Rewards Balance, when it can be withdrawn, and payouts still on their way.
  select coalesce(sum(l.amount_minor), 0) into v_rewards
    from public.rewards_ledger l
   where l.member_id = p_user;

  select coalesce(p.payouts_enabled, false), p.withdrawal_min_minor
    into v_reward_ok, v_min
    from private.referral_policy_now() p;

  if not coalesce(v_reward_ok, false) or v_rewards <= 0 or v_rewards < coalesce(v_min, 0) then
    v_rewards := 0;
  end if;

  select count(*) into v_in_flight
    from public.rewards_payouts rp
   where rp.member_id = p_user
     and rp.status in ('under_review', 'processing', 'sent', 'unknown');

  return v_money || jsonb_build_object(
    'blocked', ((v_money ->> 'blocked')::boolean or v_listings > 0 or v_business > 0
                or v_partner > 0 or v_rewards > 0 or v_in_flight > 0),
    'published_listings', v_listings,
    'owned_businesses', v_business,
    'partner_held_minor', v_partner,
    'rewards_withdrawable_minor', v_rewards,
    'rewards_payouts_in_flight', v_in_flight
  );
end;
$fn$;
