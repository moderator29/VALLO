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
