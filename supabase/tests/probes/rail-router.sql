-- RAIL ROUTER (Session 2, 7.4; migration payment_rail_router_policy_and_transaction_rail):
-- every listing type resolves to the rail the founder's decision of 5 October
-- names; every sale is milestone escrow whoever lists it; an apartment with no
-- lister kind and an equally ranked disagreeing pair both fail closed; a
-- policy row can be neither deleted nor rewritten; members cannot read the
-- policy or call the resolver; a transaction's rail cannot change once set.
--
-- 17 October 2026: a registered business's apartment is no longer direct. The
-- founder's ruling of 13 October 2026 (D73 as refined, DECISIONS_2026-10-13.md
-- row 21; migration 20261013170400_pov02_rent_and_shortlet_policy_rows, which
-- names this move) makes every rent and shortlet escrow by default with the
-- payer's choice of card, so the business apartment row is now escrow and
-- lets the payer choose. The probe asserts that instead of direct; every
-- other assertion is unchanged.
do $$
declare
  r record;
  t text;
  k text;
  refused boolean;
begin
  foreach t in array enum_range(null::public.property_type)::text[] loop
    r := public.resolve_payment_rail(t::public.property_type, 'rent', 'individual');
    if r.rail is null then raise exception 'PROBE_FAIL rail-router: % (individual, rent) did not resolve', t; end if;
    if t in ('hotel', 'restaurant') and r.rail <> 'direct' then raise exception 'PROBE_FAIL rail-router: % should be direct', t; end if;
    if t not in ('hotel', 'restaurant') and r.rail <> 'escrow' then raise exception 'PROBE_FAIL rail-router: % (individual) should be escrow, got %', t, r.rail; end if;
    r := public.resolve_payment_rail(t::public.property_type, 'rent', 'business');
    if r.rail is null then raise exception 'PROBE_FAIL rail-router: % (business, rent) did not resolve', t; end if;
    foreach k in array array['individual', 'business'] loop
      r := public.resolve_payment_rail(t::public.property_type, 'sale', k::public.agent_type);
      if r.rail is distinct from 'escrow' or r.milestones is distinct from true then
        raise exception 'PROBE_FAIL rail-router: a sale of % by % should be milestone escrow, got %/%', t, k, r.rail, r.milestones;
      end if;
    end loop;
  end loop;
  r := public.resolve_payment_rail('apartment', 'rent', 'business');
  if r.rail is distinct from 'escrow' or not private.rail_policy_lets_payer_choose(r.policy_id) then
    raise exception 'PROBE_FAIL rail-router: a business apartment should be escrow with the payer''s choice of card, got %', r.rail;
  end if;
  r := public.resolve_payment_rail('apartment', 'rent', null);
  if r.rail is not null then raise exception 'PROBE_FAIL rail-router: an apartment with no lister kind resolved'; end if;

  insert into public.payment_rail_policy (property_type, listing_intent, lister_kind, rail, reason)
  values ('shop', 'rent', 'business', 'direct', 'probe row, rolled back'),
         ('shop', 'rent', 'business', 'escrow', 'probe row, rolled back');
  r := public.resolve_payment_rail('shop', 'rent', 'business');
  if r.rail is not null or r.policy_id is not null then
    raise exception 'PROBE_FAIL rail-router: an equally ranked disagreeing pair did not fail closed';
  end if;

  refused := false;
  begin
    delete from public.payment_rail_policy where property_type = 'hotel';
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL rail-router: a policy row was deleted'; end if;
  refused := false;
  begin
    update public.payment_rail_policy set rail = 'escrow' where property_type = 'hotel';
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL rail-router: a policy row was rewritten'; end if;
  refused := false;
  begin
    update public.payment_rail_policy set effective_to = now() - interval '1 day' where property_type = 'hotel';
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL rail-router: a policy row was retired into the past'; end if;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  refused := false;
  begin
    perform 1 from public.payment_rail_policy limit 1;
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL rail-router: a member read the policy'; end if;
  refused := false;
  begin
    r := public.resolve_payment_rail('hotel', 'rent', 'business');
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'PROBE_FAIL rail-router: a member called the resolver'; end if;
  reset role;

  if exists (select 1 from pg_trigger where tgname = 'transactions_00_rail_is_fixed' and not tgenabled = 'O') then
    raise exception 'PROBE_FAIL rail-router: the rail-is-fixed trigger is disabled';
  end if;

  raise exception 'PROBE_OK rail-router';
end
$$;
