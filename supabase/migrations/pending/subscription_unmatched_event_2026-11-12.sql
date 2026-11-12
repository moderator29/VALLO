-- A SUBSCRIPTION EVENT THAT COULD NOT BE MATCHED ONCE CAN NEVER BE APPLIED.
--
-- Backend audit, 12 November 2026. One function body. Safe to run twice. No
-- row is changed; the only difference is which rows count as a duplicate.
--
-- WHAT HAPPENS NOW.
--
-- `public.subscription_apply_event` opens with a replay guard:
--
--     perform pg_advisory_xact_lock(...);
--     if exists (select 1 from public.subscription_events e
--                 where e.provider = 'paystack' and e.mode = p_mode
--                   and e.event_key = p_event_key) then
--       return jsonb_build_object('outcome', 'duplicate');
--     end if;
--
-- and it closes, on the path where nothing could be matched, with:
--
--     if v_id is null then
--       perform private.subscription_log('paystack', p_mode, p_event_key,
--                                        p_event, null, 'unmatched', null, null, d);
--       return jsonb_build_object('outcome', 'unmatched');
--     end if;
--
-- `private.subscription_log` inserts into `public.subscription_events` with
-- `provider = 'paystack'`, `mode = p_mode` and `event_key = p_event_key`,
-- which is precisely the three-column key the guard above reads. So the
-- function records "I could not match this" under the key that means "this has
-- been dealt with", and every retry of that delivery answers `duplicate` and
-- moves nothing. Permanently.
--
-- WHY A RETRY IS NOT A THEORY. The event key for a charge is
-- `charge.success:<reference>` (`lib/subscriptions/events.ts`), the same string
-- for every redelivery, by design: that is how the webhook and the return
-- page's own verify are stopped from applying one charge twice
-- (`confirmSubscriptionCharge`, `lib/subscriptions/checkout.ts`, builds the
-- identical key on purpose). Paystack redelivers a webhook the receiver did
-- not acknowledge, and `lib/subscriptions/webhook.ts` answers HTTP 500 for an
-- apply it could not read precisely so that it will. Both of those are
-- correct. Together with the guard they mean one thing: whatever the first
-- delivery could not match, no later delivery ever will.
--
-- WHAT IT COSTS. Matching walks four routes in order (the `rm-sub-` checkout
-- reference, the stored `provider_subscription_code`, then for a charge the
-- customer code plus plan code, then for `subscription.create` the email hash
-- plus plan code). A renewal Paystack charges under a plan carries ITS own
-- reference, not ours, so the only route open to it is the third, and that
-- route needs `provider_customer_code` to be on the row already. That column
-- is written by the first `charge.success` or by `subscription.create`.
-- Paystack does not promise the order its deliveries arrive in. A renewal that
-- lands before the row that would identify it is read as `unmatched`, recorded
-- under its key, and then cannot be applied by the retry that follows: the
-- member has paid, the plan is never granted, the subscription runs down its
-- grace and expires, and the only trace is one `unmatched` row.
--
-- The same shape swallows any transient reason for a miss: the row written in
-- the other Paystack mode, a `subscription.create` for a checkout a sweep has
-- just marked `abandoned` (the match list is `incomplete, active, abandoned`,
-- so that one is in fact handled), or a plan code changed between the checkout
-- and the charge.
--
-- NOTHING HAS BEEN LOST YET, which is why this is worth running before launch
-- rather than after. On 12 November 2026 the live database held
--
--     select count(*) from public.subscription_events;    -> 0
--     select count(*) from public.member_subscriptions;   -> 0
--
-- so no subscription has been sold and no event has been burned.
--
-- THE FIX. Only a delivery that was ACTED ON closes the key. An `unmatched`
-- row stays exactly where it is, as the forensic record it was meant to be,
-- and a retry re-runs the match. A delivery that keeps missing leaves one
-- `unmatched` row per attempt, which is wanted: a handful of rows under one
-- key is the readable shape of "this kept arriving and we never knew whose it
-- was", and it is what `subscription_log`'s own `on conflict do nothing`
-- already tolerates.
--
-- Every other outcome still closes the key on the first delivery:
-- `applied`, `recorded`, `ignored`, `mismatch`, `amount_differs` and
-- `late_charge` all mean a decision was taken, and the money paths among them
-- (`ledger_append` under `'subscription:' || v_ref`) must not run twice.
--
-- The body below is `20261008200007_subscriptions_checkout.sql`'s, which is
-- also the live body, with that one predicate changed and a comment beside it.
-- Nothing else differs.

set lock_timeout = '5s';

begin;

create or replace function public.subscription_apply_event(p_mode text, p_event text, p_event_key text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  d jsonb := coalesce(p_data, '{}'::jsonb);
  s public.member_subscriptions;
  t public.member_subscriptions;
  v_id uuid;
  v_user uuid;
  v_ref text := nullif(d ->> 'reference', '');
  v_amount bigint := case when (d ->> 'amount_minor') ~ '^[0-9]{1,15}$' then (d ->> 'amount_minor')::bigint end;
  v_currency text := nullif(d ->> 'currency', '');
  v_paid_at timestamptz := coalesce(nullif(d ->> 'paid_at', '')::timestamptz, now());
  v_customer text := nullif(d ->> 'customer_code', '');
  v_email_sha text := lower(nullif(d ->> 'email_sha256', ''));
  v_plan_code text := nullif(d ->> 'plan_code', '');
  v_sub_code text := nullif(d ->> 'subscription_code', '');
  v_token text := nullif(d ->> 'email_token', '');
  v_next timestamptz := nullif(d ->> 'next_payment_date', '')::timestamptz;
  v_period_end timestamptz := nullif(d ->> 'period_end', '')::timestamptz;
  v_pstatus text := nullif(d ->> 'provider_status', '');
  v_paid boolean := coalesce((d ->> 'paid')::boolean, false);
  v_grace interval := private.subscription_grace();
  v_outcome text := 'applied';
  v_from text;
  v_end timestamptz;
  v_other_live boolean;
begin
  if p_mode is null or p_mode not in ('test', 'live') then
    raise exception 'subscription_apply_event: mode must be test or live' using errcode = '22023';
  end if;
  if p_event not in ('charge.success', 'subscription.create', 'subscription.not_renew', 'subscription.disable',
                     'invoice.create', 'invoice.update', 'invoice.payment_failed') then
    return jsonb_build_object('outcome', 'ignored');
  end if;
  if p_event_key is null or length(p_event_key) < 8 or length(p_event_key) > 300 then
    raise exception 'subscription_apply_event: an event key is required' using errcode = '22023';
  end if;

  -- One delivery at a time per event, then the replay check.
  perform pg_advisory_xact_lock(hashtextextended('subscription_event:' || p_mode || ':' || p_event_key, 0));
  -- AN UNMATCHED DELIVERY IS A RECORD, NOT A DECISION (12 November 2026).
  -- `private.subscription_log` writes EVERY outcome to this same table under
  -- this same key, 'unmatched' included, so a delivery that could not be
  -- matched the first time answered 'duplicate' on every retry afterwards and
  -- could never be applied. Only a delivery that was ACTED ON closes the key.
  if exists (select 1 from public.subscription_events e
              where e.provider = 'paystack' and e.mode = p_mode and e.event_key = p_event_key
                and e.outcome <> 'unmatched') then
    return jsonb_build_object('outcome', 'duplicate');
  end if;

  -- Which subscription this is about, without locking yet.
  if v_ref is not null and v_ref like 'rm-sub-%' then
    select ms.id into v_id from public.member_subscriptions ms where ms.checkout_reference = v_ref and ms.mode = p_mode;
  end if;
  if v_id is null and v_sub_code is not null then
    select ms.id into v_id from public.member_subscriptions ms
     where ms.provider_subscription_code = v_sub_code and ms.mode = p_mode;
  end if;
  if v_id is null and p_event = 'charge.success' and v_customer is not null and v_plan_code is not null then
    select ms.id into v_id from public.member_subscriptions ms
     where ms.kind = 'paid' and ms.mode = p_mode and ms.provider_customer_code = v_customer
       and ms.provider_plan_code = v_plan_code
     order by (ms.status in ('active', 'past_due', 'non_renewing')) desc, ms.created_at desc limit 1;
  end if;
  if v_id is null and p_event = 'subscription.create' and v_email_sha is not null and v_plan_code is not null then
    select ms.id into v_id from public.member_subscriptions ms
     where ms.kind = 'paid' and ms.mode = p_mode and ms.provider_subscription_code is null
       and ms.checkout_email_sha256 = v_email_sha and ms.provider_plan_code = v_plan_code
       and ms.status in ('incomplete', 'active', 'abandoned')
     order by (ms.status = 'active') desc, ms.created_at desc limit 1;
  end if;
  if v_id is null then
    perform private.subscription_log('paystack', p_mode, p_event_key, p_event, null, 'unmatched', null, null, d);
    return jsonb_build_object('outcome', 'unmatched');
  end if;

  -- Lock order everywhere: the member, then the rows.
  select ms.user_id into v_user from public.member_subscriptions ms where ms.id = v_id;
  perform pg_advisory_xact_lock(hashtextextended('subscription:' || v_user::text, 0));
  select * into s from public.member_subscriptions where id = v_id for update;
  v_from := s.status;

  if p_event = 'charge.success' then
    if s.status in ('incomplete', 'abandoned') then
      -- The first charge.
      v_other_live := exists (select 1 from public.member_subscriptions o
                               where o.user_id = s.user_id and o.id <> s.id and o.kind = 'paid'
                                 and o.status in ('active', 'past_due', 'non_renewing'));
      if v_amount is distinct from s.amount_minor or v_currency is distinct from s.currency then
        update public.member_subscriptions
           set status = 'mismatch', end_reason = 'amount_or_currency', ended_at = now(), updated_at = now(),
               provider_customer_code = coalesce(v_customer, provider_customer_code)
         where id = s.id;
        v_outcome := 'mismatch';
      elsif v_other_live then
        -- Money for a second subscription while one is live: not granted twice; the desk refunds.
        update public.member_subscriptions
           set status = 'mismatch', end_reason = 'already_subscribed', ended_at = now(), updated_at = now(),
               provider_customer_code = coalesce(v_customer, provider_customer_code)
         where id = s.id;
        v_outcome := 'mismatch';
      else
        -- Paying during a trial ends the trial: the paid month starts now.
        for t in select * from public.member_subscriptions
                  where user_id = s.user_id and kind = 'trial' and status = 'trialing' for update loop
          perform private.subscription_grant_end(t.id, now());
          update public.member_subscriptions
             set status = 'converted', ended_at = now(), end_reason = 'paid', updated_at = now()
           where id = t.id;
          perform private.subscription_log('vallo', null, 'trial.converted:' || t.id::text, 'trial.converted', t.id,
                                           'applied', 'trialing', 'converted');
        end loop;
        v_end := coalesce(v_next, v_paid_at + interval '1 month');
        update public.member_subscriptions
           set status = 'active', current_period_start = v_paid_at, current_period_end = v_end,
               provider_customer_code = coalesce(v_customer, provider_customer_code),
               ended_at = null, end_reason = null, updated_at = now()
         where id = s.id;
        perform private.subscription_grant_until(s.id, v_end + v_grace);
        if p_mode = 'live' and v_ref is not null then
          perform private.ledger_append('vallo_revenue', 'subscription:' || v_ref, 'FEE_CHARGED', 'in', v_amount, v_currency,
            'paystack', v_ref, null, 'direct', 'confirmed',
            jsonb_build_object('kind', 'subscription', 'subscription_id', s.id, 'plan_key', s.plan_key, 'charge', 'first'),
            null, s.user_id);
        end if;
      end if;
    elsif s.status in ('active', 'past_due', 'non_renewing', 'expired') then
      -- A renewal. Money already taken is always recorded.
      v_other_live := exists (select 1 from public.member_subscriptions o
                               where o.user_id = s.user_id and o.id <> s.id
                                 and o.status in ('trialing', 'active', 'past_due', 'non_renewing'));
      if p_mode = 'live' and v_ref is not null and v_amount is not null and v_amount > 0 and v_currency is not null then
        perform private.ledger_append('vallo_revenue', 'subscription:' || v_ref, 'FEE_CHARGED', 'in', v_amount, v_currency,
          'paystack', v_ref, null, 'direct', 'confirmed',
          jsonb_build_object('kind', 'subscription', 'subscription_id', s.id, 'plan_key', s.plan_key, 'charge', 'renewal'),
          null, s.user_id);
      end if;
      if s.status = 'expired' and v_other_live then
        v_outcome := 'late_charge';
      else
        v_end := greatest(coalesce(s.current_period_end, v_paid_at), coalesce(v_next, v_paid_at + interval '1 month'));
        update public.member_subscriptions
           set status = case when status in ('past_due', 'expired') then 'active' else status end,
               current_period_start = v_paid_at, current_period_end = v_end,
               provider_customer_code = coalesce(v_customer, provider_customer_code),
               ended_at = null, end_reason = null, updated_at = now()
         where id = s.id;
        perform private.subscription_grant_until(s.id, v_end + case when s.status = 'non_renewing' then interval '0' else v_grace end);
        if v_amount is distinct from s.amount_minor then v_outcome := 'amount_differs'; end if;
      end if;
    else
      -- cancelled, converted, mismatch: money on a finished subscription.
      if p_mode = 'live' and v_ref is not null and v_amount is not null and v_amount > 0 and v_currency is not null then
        perform private.ledger_append('vallo_revenue', 'subscription:' || v_ref, 'FEE_CHARGED', 'in', v_amount, v_currency,
          'paystack', v_ref, null, 'direct', 'confirmed',
          jsonb_build_object('kind', 'subscription', 'subscription_id', s.id, 'plan_key', s.plan_key, 'charge', 'late'),
          null, s.user_id);
      end if;
      v_outcome := 'late_charge';
    end if;

  elsif p_event = 'subscription.create' then
    update public.member_subscriptions
       set provider_subscription_code = coalesce(provider_subscription_code, v_sub_code),
           provider_email_token = coalesce(v_token, provider_email_token),
           provider_customer_code = coalesce(provider_customer_code, v_customer),
           current_period_end = case when status = 'active' and v_next is not null then v_next else current_period_end end,
           updated_at = now()
     where id = s.id;
    if s.status = 'active' and v_next is not null then
      perform private.subscription_grant_until(s.id, v_next + v_grace);
    elsif s.status <> 'active' then
      v_outcome := 'recorded';
    end if;

  elsif p_event = 'subscription.not_renew' then
    if s.status in ('active', 'past_due') then
      update public.member_subscriptions
         set status = 'non_renewing', cancel_requested_at = coalesce(cancel_requested_at, now()), updated_at = now(),
             provider_email_token = coalesce(v_token, provider_email_token)
       where id = s.id;
      -- No renewal is coming: the plan runs to the end of the paid period, no grace.
      perform private.subscription_grant_until(s.id, greatest(coalesce(s.current_period_end, now()), now()));
    else
      v_outcome := 'recorded';
    end if;

  elsif p_event = 'subscription.disable' then
    if s.status in ('active', 'non_renewing') and s.current_period_end > now() then
      update public.member_subscriptions
         set status = 'non_renewing', cancel_requested_at = coalesce(cancel_requested_at, now()), updated_at = now()
       where id = s.id;
      perform private.subscription_grant_until(s.id, s.current_period_end);
    elsif s.status in ('active', 'past_due', 'non_renewing') then
      update public.member_subscriptions
         set status = 'cancelled', ended_at = now(), end_reason = coalesce(end_reason, 'disabled'), updated_at = now()
       where id = s.id;
      perform private.subscription_grant_end(s.id, now());
    else
      v_outcome := 'recorded';
    end if;

  elsif p_event = 'invoice.create' then
    v_outcome := 'recorded';

  elsif p_event = 'invoice.update' and (v_paid or v_pstatus = 'success') then
    v_end := coalesce(v_next, v_period_end);
    v_other_live := exists (select 1 from public.member_subscriptions o
                             where o.user_id = s.user_id and o.id <> s.id
                               and o.status in ('trialing', 'active', 'past_due', 'non_renewing'));
    if s.status in ('active', 'past_due', 'non_renewing') or (s.status = 'expired' and not v_other_live) then
      if v_end is not null then
        v_end := greatest(coalesce(s.current_period_end, v_end), v_end);
        update public.member_subscriptions
           set status = case when status in ('past_due', 'expired') then 'active' else status end,
               current_period_end = v_end, ended_at = null, end_reason = null, updated_at = now()
         where id = s.id;
        perform private.subscription_grant_until(s.id, v_end + case when s.status = 'non_renewing' then interval '0' else v_grace end);
      elsif s.status in ('past_due', 'expired') then
        update public.member_subscriptions set status = 'active', ended_at = null, end_reason = null, updated_at = now()
         where id = s.id;
        perform private.subscription_grant_until(s.id, greatest(coalesce(s.current_period_end, now()), now()) + v_grace);
      else
        v_outcome := 'recorded';
      end if;
    else
      v_outcome := 'recorded';
    end if;

  elsif p_event = 'invoice.payment_failed' or (p_event = 'invoice.update' and v_pstatus = 'failed') then
    if s.status = 'active' then
      update public.member_subscriptions set status = 'past_due', updated_at = now() where id = s.id;
    else
      v_outcome := 'recorded';
    end if;

  else
    v_outcome := 'recorded';
  end if;

  select * into t from public.member_subscriptions where id = s.id;
  perform private.subscription_log('paystack', p_mode, p_event_key, p_event, s.id, v_outcome, v_from, t.status, d);
  return jsonb_build_object('outcome', v_outcome, 'subscription_id', s.id, 'status', t.status,
                            'user_id', s.user_id, 'plan_key', s.plan_key);
end;
$$;

commit;

-- Verification, read only. The predicate is now in the body:
--   select pg_get_functiondef('public.subscription_apply_event(text,text,text,jsonb)'::regprocedure)
--            like '%e.outcome <> ''unmatched''%';
--     -- expect true
--
-- And the behaviour, which `supabase/tests/probes-pending/
-- subscription-unmatched-event-can-retry.sql` checks end to end: the same
-- unmatchable delivery answers `unmatched` twice rather than `unmatched` then
-- `duplicate`, while a delivery that WAS acted on still answers `duplicate`
-- on its second arrival.
