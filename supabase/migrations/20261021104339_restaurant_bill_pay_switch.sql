-- APPLIED 21 October 2026 (written as a draft, read against the live definition first). RESTAURANT BILL PAYMENT BEHIND ITS OWN SWITCH.
--
-- What it fixes: paying a table's bill through Vallo was gated only by the
-- Paystack key (set in production for stays), the commission (set to 200 bps
-- on 13 October 2026) and the restaurant's payout subaccount. The founder's
-- rule (HANDOFF section 2) is that it stays OFF until the keys and each
-- restaurant's subaccount exist and the flow has passed in Paystack test mode.
-- The app now reads a fail-closed switch, `restaurant_bill_pay`
-- (apps/web/src/lib/reservations/bill-pay.ts). This makes the database refuse
-- too, so nothing but the switch can open a bill checkout.
--
--   1. Seeds `feature_flags.restaurant_bill_pay` OFF (a missing row also reads off).
--   2. `private.restaurant_bill_pay_on()`, fail-closed.
--   3. `public.restaurant_bill_open` answers `switched_off` while it is off.
--      Settling (`restaurant_bill_settle`) and reopening are untouched, so a
--      bill whose checkout already opened is still recorded from the signed
--      webhook and the diner's return.
--
-- BEFORE APPLYING: read the live definition
--   select pg_get_functiondef('public.restaurant_bill_open(uuid, uuid, text)'::regprocedure);
-- and check it still matches 20261013062923_restaurant_seating_h_bill_functions.sql
-- (the body below is that one with step 0 added). Then check the grants after.
-- To switch bill payment on after the test-mode run:
--   update public.feature_flags set enabled = true where key = 'restaurant_bill_pay';
set lock_timeout = '5s';

insert into public.feature_flags (key, enabled, note)
values ('restaurant_bill_pay', false, 'Paying a restaurant bill through Vallo (Paystack split to the restaurant, 2 percent commission). Off until the keys, each restaurant''s subaccount and a Paystack test-mode run are done.')
on conflict (key) do nothing;

create or replace function private.restaurant_bill_pay_on()
returns boolean language sql stable security definer set search_path to '' as $fn$
  select coalesce((select f.enabled from public.feature_flags f where f.key = 'restaurant_bill_pay'), false);
$fn$;
revoke all on function private.restaurant_bill_pay_on() from public, anon, authenticated;

create or replace function public.restaurant_bill_open(p_bill uuid, p_guest uuid, p_mode text)
returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare
  b public.restaurant_bills%rowtype;
  owner uuid;
  sub text;
  bps integer;
  commission bigint;
begin
  select * into b from public.restaurant_bills where id = p_bill for update;
  if b.id is null or b.guest_id is distinct from p_guest then
    return jsonb_build_object('status', 'not_found');
  end if;
  if b.status = 'pending' and b.provider_ref is not null then
    return jsonb_build_object('status', 'pending', 'reference', b.provider_ref, 'amount_minor', b.amount_minor,
                              'authorization_url', b.authorization_url, 'access_code', b.access_code);
  end if;
  if b.status = 'paid' then
    return jsonb_build_object('status', 'already_paid');
  end if;
  -- 0. The switch. A checkout already open (above) is handed back so it can
  --    finish; a new one is never opened while it is off.
  if not private.restaurant_bill_pay_on() then
    return jsonb_build_object('status', 'switched_off');
  end if;
  if b.status <> 'awaiting_payment' then
    return jsonb_build_object('status', 'awaiting_restaurant');
  end if;
  select s.bill_commission_bps into bps from public.restaurant_money_settings s where s.id;
  if bps is null then
    return jsonb_build_object('status', 'not_priced');
  end if;
  select bz.owner_id into owner from public.businesses bz where bz.id = b.business_id;
  if owner is null then
    select a.user_id into owner
      from public.reservations r join public.listings l on l.id = r.listing_id join public.agents a on a.id = l.agent_id
     where r.id = b.reservation_id;
  end if;
  sub := private.payee_subaccount(owner);
  if sub is null then
    return jsonb_build_object('status', 'payee_not_set_up');
  end if;
  commission := (b.amount_minor * bps) / 10000;
  update public.restaurant_bills
     set status = 'pending', provider_ref = 'rm-bill-' || gen_random_uuid()::text, paystack_mode = p_mode,
         payee_user_id = owner, payee_subaccount_code = sub, commission_bps = bps,
         commission_minor = commission, restaurant_share_minor = b.amount_minor - commission,
         authorization_url = null, access_code = null, updated_at = now()
   where id = b.id
  returning * into b;
  return jsonb_build_object('status', 'ok', 'reference', b.provider_ref, 'amount_minor', b.amount_minor,
                            'payee_subaccount_code', b.payee_subaccount_code,
                            'restaurant_share_minor', b.restaurant_share_minor, 'commission_minor', b.commission_minor);
end $fn$;
revoke all on function public.restaurant_bill_open(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.restaurant_bill_open(uuid, uuid, text) to service_role;
