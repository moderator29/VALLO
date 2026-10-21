-- POV01 (pending migration pov01_payer_rail_choice_columns): the payer's
-- choice is stored on the agreement and only as 'escrow' or 'card' with its
-- moment; a policy row's payer_may_choose is history like every other
-- column, and only a rent escrow row may offer a choice.
-- Everything is rolled back by the final raise.
do $$
declare
  guest constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  v_sale uuid; v_owner uuid; insp uuid;
  ag uuid;
  pol uuid;
  refused boolean;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'deal_agreements' and column_name = 'payer_rail_choice')
     or not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'deal_agreements' and column_name = 'payer_rail_chosen_at')
     or not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'payment_rail_policy' and column_name = 'payer_may_choose') then
    raise exception 'PROBE_FAIL pov01-payer-rail-choice-columns: a column is missing';
  end if;

  select id into ag from public.deal_agreements order by created_at desc limit 1;
  if ag is null then
    -- No agreement yet on this database: draw one up on a sale listing (rolled back).
    -- 17 October 2026: on the live database the example collection's agents row
    -- (e0000000-...-0002) no longer belongs to the example lister but to the QA
    -- member, who is the payer here, so every sale listing was the payer's own
    -- (the CI run of 17 October failed with "listing <NULL> has no owner").
    -- The fixture gives the row back to the example lister and
    -- points the example sales at it, for this transaction only, so a sale with
    -- another owner exists again. Nothing asserted below changes. Rolled back.
    update public.agents set user_id = 'e0000000-0000-4000-8000-000000000001'
     where id = 'e0000000-0000-4000-8000-000000000002'
       and user_id is distinct from 'e0000000-0000-4000-8000-000000000001'
       and not exists (select 1 from public.agents x where x.user_id = 'e0000000-0000-4000-8000-000000000001');
    update public.listings set agent_id = 'e0000000-0000-4000-8000-000000000002'
     where id in ('ed000000-0000-4000-8000-000000000004',
                  'ed000000-0000-4000-8000-000000000006',
                  'ed000000-0000-4000-8000-000000000012',
                  'ed000000-0000-4000-8000-000000000014')
       and agent_id is distinct from 'e0000000-0000-4000-8000-000000000002';
    select l.id, a.user_id into v_sale, v_owner from public.listings l join public.agents a on a.id = l.agent_id
     where l.listing_intent = 'sale' and a.user_id is not null and a.user_id <> guest limit 1;
    insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
           principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
    select id, 'sale', 'Probe Principal', 'approved', v_owner, now(), 'owner', 'call_back', v_owner, now()
      from public.listings where id = v_sale and listing_role <> 'owner' and not private.listing_has_live_mandate(id);
    update public.listings set is_demo = false where id = v_sale;
    insert into public.inspection_requests (listing_id, requester_id, lister_id, requested_at)
    values (v_sale, guest, v_owner, now()) returning id into insp;
    insert into public.deal_agreements (kind, listing_id, inspection_id, renter_id, owner_id, amount_minor, terms)
    values ('rent', v_sale, insp, guest, v_owner, 900000000, '{"total_minor": 900000000}') returning id into ag;
  end if;
  if ag is null then
    raise exception 'PROBE_FAIL pov01-payer-rail-choice-columns: fixtures missing (an agreement)';
  end if;

  -- 1. An unknown word is refused.
  refused := false;
  begin
    update public.deal_agreements set payer_rail_choice = 'wallet', payer_rail_chosen_at = now() where id = ag;
  exception when check_violation then refused := true;
  end;
  if not refused then
    raise exception 'PROBE_FAIL pov01-payer-rail-choice-columns: a choice other than escrow or card was stored';
  end if;

  -- 2. A choice without its moment is refused.
  refused := false;
  begin
    update public.deal_agreements set payer_rail_choice = 'card', payer_rail_chosen_at = null where id = ag;
  exception when check_violation then refused := true;
  end;
  if not refused then
    raise exception 'PROBE_FAIL pov01-payer-rail-choice-columns: a choice was stored without its moment';
  end if;

  -- 3. Both words, with the moment, are stored.
  update public.deal_agreements set payer_rail_choice = 'card', payer_rail_chosen_at = now() where id = ag;
  update public.deal_agreements set payer_rail_choice = 'escrow', payer_rail_chosen_at = now() where id = ag;

  -- 4. A sale row can never offer a choice.
  refused := false;
  begin
    insert into public.payment_rail_policy (listing_intent, rail, payer_may_choose, precedence, reason)
    values ('sale', 'escrow', true, 0, 'PROBE pov01: a sale offering card, rolled back');
  exception when check_violation then refused := true;
  end;
  if not refused then
    raise exception 'PROBE_FAIL pov01-payer-rail-choice-columns: a sale row offered the payer a choice';
  end if;

  -- 5. payer_may_choose is history: the guard refuses changing it.
  select id into pol from public.payment_rail_policy where effective_to is null limit 1;
  refused := false;
  begin
    update public.payment_rail_policy set payer_may_choose = not payer_may_choose where id = pol;
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then
    raise exception 'PROBE_FAIL pov01-payer-rail-choice-columns: a policy row''s choice was edited in place';
  end if;

  -- 6. Members hold no write on the agreement: the choice goes through the RPC.
  if has_table_privilege('authenticated', 'public.deal_agreements', 'update')
     and has_column_privilege('authenticated', 'public.deal_agreements', 'payer_rail_choice', 'update') then
    raise exception 'PROBE_FAIL pov01-payer-rail-choice-columns: a member can write the choice directly';
  end if;

  raise exception 'PROBE_OK pov01-payer-rail-choice-columns';
end
$$;
