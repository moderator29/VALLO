-- The payout columns and the lister notice, end to end on the local stub.
-- Ends with E2E_OK, or raises at the first thing that is wrong.
do $$
declare
  ag uuid; arr uuid;
  seller uuid := gen_random_uuid();
  n int;
  v_body text;
begin
  insert into public.listings (title) values ('Two bedroom flat, Yaba') returning id into ag;
  insert into public.deal_agreements (listing_id) values (ag) returning id into ag;
  insert into public.provider_arrangements (agreement_id, reference, amount_minor, buyer_user_id, seller_user_id)
  values (ag, 'vallo-pp-1', 18000000, gen_random_uuid(), seller) returning id into arr;

  -- On its way: recorded, and no notice yet.
  update public.provider_arrangements set payout_status = 'processing', payout_updated_at = now() where id = arr;
  if (select count(*) from public.notices) <> 0 then raise exception 'E2E_FAIL processing must not tell the lister anything'; end if;

  -- Paid needs the moment it completed.
  begin
    update public.provider_arrangements set payout_status = 'paid' where id = arr;
    raise exception 'E2E_FAIL paid without payout_completed_at was accepted';
  exception when check_violation then null;
  end;

  -- Paid: one notice to the lister, with the amount that reached them.
  update public.provider_arrangements
     set payout_status = 'paid', payout_completed_at = now(), payout_reference = 'POT_1', payout_amount_minor = 17993000, payout_fee_minor = 7000
   where id = arr;
  select count(*), max(x.body) into n, v_body from public.notices x where x.uid = seller;
  if n <> 1 then raise exception 'E2E_FAIL expected one paid notice, got %', n; end if;
  if v_body not like 'NGN 179,930.00 for Two bedroom flat, Yaba%' then raise exception 'E2E_FAIL notice body: %', v_body; end if;
  if (select href from public.notices limit 1) <> '/agreements/' || ag::text || '/held' then raise exception 'E2E_FAIL notice link'; end if;

  -- The same state written again tells nobody twice.
  update public.provider_arrangements set payout_updated_at = now() where id = arr;
  update public.provider_arrangements set payout_status = 'paid' where id = arr;
  if (select count(*) from public.notices) <> 1 then raise exception 'E2E_FAIL a repeated paid told the lister twice'; end if;

  -- Reversed: a second, different notice.
  update public.provider_arrangements set payout_status = 'reversed' where id = arr;
  if (select count(*) from public.notices where title = 'The transfer to your bank did not go through') <> 1 then raise exception 'E2E_FAIL no reversed notice'; end if;

  -- Bad values are refused by the table itself.
  begin
    update public.provider_arrangements set payout_status = 'released' where id = arr;
    raise exception 'E2E_FAIL an unknown payout state was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.provider_arrangements set payout_fee_minor = -1 where id = arr;
    raise exception 'E2E_FAIL a negative fee was accepted';
  exception when check_violation then null;
  end;

  -- A notice that fails never undoes the write it rides on.
  alter table public.notices rename to notices_gone;
  update public.provider_arrangements set payout_status = 'processing' where id = arr;
  if (select payout_status from public.provider_arrangements where id = arr) <> 'processing' then raise exception 'E2E_FAIL write undone'; end if;
  update public.provider_arrangements set payout_status = 'failed' where id = arr;
  if (select payout_status from public.provider_arrangements where id = arr) <> 'failed' then raise exception 'E2E_FAIL a failed notice undid the write'; end if;
  if (select count(*) from public.notice_failures) <> 1 then raise exception 'E2E_FAIL the failed notice was not recorded'; end if;
  alter table public.notices_gone rename to notices;

  -- Members cannot write a payment record; the trigger function is not theirs to call.
  if has_table_privilege('authenticated', 'public.provider_arrangements', 'update') then raise exception 'E2E_FAIL members can update'; end if;
  if has_function_privilege('authenticated', 'private.provider_arrangements_payout_notice()', 'execute') then raise exception 'E2E_FAIL members can call the notice'; end if;

  raise exception 'E2E_OK';
end $$;
