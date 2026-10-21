-- APPLIED 21 October 2026. NOBODY DECIDES THEIR OWN CASE, part 2: refunds, referrals, rewards
-- payouts and manual badges. Each function matched the live body apart from the added lines.
-- The badge rule (user_badges_not_self_granted) was added NOT VALID, so old rows were not read;
-- it is validated in 20261021105557 once zero rows were found to break it.
set lock_timeout = '5s';

-- 4. from 20260929001248_money_v24_refund_clock_to_paystack_initiation_and_success.sql
create or replace function public.decide_refund_request(p_request uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $fn$
declare
  q public.refund_requests%rowtype;
  caller uuid := (select auth.uid());
begin
  if not (private.has_role(caller, 'admin'::public.app_role)
          or private.has_role(caller, 'super_admin'::public.app_role)) then
    return jsonb_build_object('status', 'not_allowed');
  end if;
  select * into q from public.refund_requests where id = p_request;
  if q.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  -- Nobody decides a refund on a stay they booked or host.
  if caller = q.guest_id or exists (
       select 1 from public.bookings b
         join public.listings l on l.id = b.listing_id
         join public.agents a on a.id = l.agent_id
        where b.id = q.booking_id and a.user_id = caller) then
    return jsonb_build_object('status', 'own_booking');
  end if;
  if p_decision not in ('declined', 'refunded') then
    return jsonb_build_object('status', 'bad_decision');
  end if;
  if p_decision = 'declined' and nullif(btrim(coalesce(p_note, '')), '') is null then
    return jsonb_build_object('status', 'needs_reason');
  end if;
  -- DECIDED means Paystack accepted the refund, never that a row was typed.
  if p_decision = 'refunded' and private.refund_request_initiated_at(q.id) is null then
    return jsonb_build_object('status', 'no_refund_initiated');
  end if;
  insert into public.refund_request_decisions (request_id, decision, note, decided_by)
  values (q.id, p_decision, left(nullif(btrim(coalesce(p_note, '')), ''), 1000), caller)
  on conflict (request_id) do nothing;
  if not found then
    return jsonb_build_object('status', 'already_decided');
  end if;
  if p_decision = 'declined' then
    begin
      perform private.notify(q.guest_id, 'booking'::public.notification_kind,
        'Support answered your refund request', 'Open the booking to read the answer.', '/bookings/' || q.booking_id);
    exception when others then
      null;
    end;
  end if;
  return jsonb_build_object('status', 'ok');
end;
$fn$;

-- 5. from 20261006154817_b4_referral_campaigns.sql
create or replace function public.admin_referral_decide(p_referral uuid, p_decision text, p_reason text)
returns text language plpgsql security definer set search_path = '' as $fn$
declare r public.referrals; actor uuid := (select auth.uid());
begin
  if not private.is_staff() then raise exception 'Staff only.' using errcode = '42501'; end if;
  if coalesce(length(btrim(p_reason)), 0) < 8 then raise exception 'Say why, in a sentence.' using errcode = '22023'; end if;
  select * into r from public.referrals where id = p_referral for update;
  if r.id is null then return 'not_found'; end if;
  -- Nobody decides a referral they invited or were invited by.
  if actor in (r.referrer_id, r.referred_id) then return 'own_referral'; end if;
  if p_decision = 'approve' and r.status = 'under_review' then
    perform private.referral_move(r.id, 'approved', p_reason, actor);
  elsif p_decision = 'reject' and r.status = 'under_review' then
    perform private.referral_move(r.id, 'rejected', p_reason, actor);
    perform private.referral_reverse(r.id, p_reason, actor);
  elsif p_decision = 'reverse' then
    perform private.referral_reverse(r.id, p_reason, actor);
  elsif p_decision = 'review' and r.status in ('pending','approved','available') then
    perform private.referral_move(r.id, 'under_review', p_reason, actor);
  else
    return 'refused';
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'referral_' || p_decision, 'referral', r.id::text, jsonb_build_object('reason', p_reason, 'from', r.status));
  return (select status from public.referrals where id = p_referral);
end $fn$;

-- 6. from 20261013193153_cbh01_chargeback_hold_enforced.sql
create or replace function public.admin_rewards_payout_decide(p_payout uuid, p_decision text, p_reason text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $fn$
declare p public.rewards_payouts;
begin
  if not private.is_staff() then raise exception 'Staff only.' using errcode = '42501'; end if;
  if coalesce(length(btrim(p_reason)), 0) < 8 then raise exception 'Say why, in a sentence.' using errcode = '22023'; end if;
  select * into p from public.rewards_payouts where id = p_payout for update;
  if p.id is null then return 'refused'; end if;
  -- Nobody releases, refuses or closes their own payout.
  if p.member_id = (select auth.uid()) then return 'own_payout'; end if;
  if p_decision = 'fail_unsent' then
    if p.status not in ('processing','sent','unknown') or p.created_at > now() - interval '24 hours' then
      return 'refused';
    end if;
    if length(btrim(p_reason)) < 20 then
      raise exception 'Say what the provider dashboard showed.' using errcode = '22023';
    end if;
    perform private.rewards_payout_fail(p.id, 'never sent (staff): ' || p_reason);
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'rewards_payout_failed_unsent', 'rewards_payout', p.id::text,
            jsonb_build_object('reason', p_reason, 'prior_status', p.status, 'transfer_initiated_at', p.transfer_initiated_at));
    return 'failed';
  end if;
  if p.status <> 'under_review' then return 'refused'; end if;
  if p_decision = 'release' then
    if p.recipient_code is null then return 'no_recipient'; end if;
    -- THE PAYOUT RULE: only a finance override lets a held member's payout go.
    if private.chargeback_hold_blocks('rewards_payout', p.id, p.member_id) then
      perform private.chargeback_hold_refused('rewards_payout', p.id, p.member_id, 'rewards_payout_release');
      return 'chargeback_hold';
    end if;
    update public.rewards_payouts set status = 'processing' where id = p.id;
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'rewards_payout_released', 'rewards_payout', p.id::text, jsonb_build_object('reason', p_reason));
    return 'processing';
  elsif p_decision = 'refuse' then
    perform private.rewards_payout_fail(p.id, 'refused on review: ' || p_reason);
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'rewards_payout_refused', 'rewards_payout', p.id::text, jsonb_build_object('reason', p_reason));
    return 'failed';
  end if;
  return 'refused';
end $fn$;

-- 7. A manual badge names somebody other than the holder.
alter table public.user_badges
  add constraint user_badges_not_self_granted
  check (granted_by is null or granted_by <> user_id) not valid;
