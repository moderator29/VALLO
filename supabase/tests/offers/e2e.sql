-- End to end test of the sale offer doors on the local stub. Ends in
-- RAISE EXCEPTION 'E2E_OK' (so it always rolls back) or 'E2E_FAIL <what>'.
do $$
declare
  seller uuid := '00000000-0000-0000-0000-00000000000a';
  buyer  uuid := '00000000-0000-0000-0000-00000000000b';
  buyer2 uuid := '00000000-0000-0000-0000-00000000000c';
  poor   uuid := '00000000-0000-0000-0000-00000000000d';
  staff  uuid := '00000000-0000-0000-0000-00000000000e';
  ag uuid; ag2 uuid; lst uuid; agent uuid; r jsonb; n int; st text;
  procedure_ text;
begin
  insert into auth.users (id) values (seller), (buyer), (buyer2), (poor), (staff);
  insert into public.profiles values (seller, 'Sade Okafor'), (buyer, 'Tunde Bello'), (buyer2, 'Amaka N'), (poor, 'Poor Buyer');
  insert into public.agents (user_id) values (seller) returning id into agent;
  insert into public.listings (agent_id, title, status, listing_intent, sale_price_minor, sale_status, property_type)
    values (agent, '3-bedroom bungalow', 'PUBLISHED', 'sale', 8500000000, 'available', 'house') returning id into lst;
  insert into public.identity_verifications (subject_id, outcome) values (buyer, 'matched'), (buyer2, 'matched');
  insert into public.user_roles values (staff, 'admin');

  -- gate
  r := public.sale_offer_gate_as(buyer, lst);
  if not (r ->> 'can_offer')::boolean then raise exception 'E2E_FAIL gate should allow: %', r; end if;
  r := public.sale_offer_gate_as(poor, lst);
  if (r ->> 'can_offer')::boolean or not (r ->> 'can_open_form')::boolean then raise exception 'E2E_FAIL gate should show form but block: %', r; end if;
  r := public.sale_offer_gate_as(seller, lst);
  if r ->> 'viewer_side' <> 'seller' or r ->> 'can_open_form' = 'true' then raise exception 'E2E_FAIL seller gate: %', r; end if;

  -- refusals
  if public.sale_offer_submit_as(poor, lst, null, 'cash', null, null, null, null, 'key-poor-0001') ->> 'status' <> 'not_eligible' then raise exception 'E2E_FAIL ineligible'; end if;
  if public.sale_offer_submit_as(seller, lst, null, 'cash', null, null, null, null, 'key-self-0001') ->> 'status' <> 'own_listing' then raise exception 'E2E_FAIL own'; end if;
  foreach st in array array['0','-5','99999999999999999','1'] loop
    r := public.sale_offer_submit_as(buyer, lst, st::bigint, 'cash', null, null, null, null, 'key-bad-' || st);
    if st = '1' then
      if r ->> 'status' <> 'ok' then raise exception 'E2E_FAIL one kobo should be allowed as a figure: %', r; end if;
      perform public.sale_offer_withdraw_as(buyer, (r ->> 'agreement_id')::uuid);
    elsif r ->> 'status' not in ('bad_amount','amount_too_large') then raise exception 'E2E_FAIL amount % -> %', st, r; end if;
  end loop;
  if public.sale_offer_submit_as(buyer, lst, 8000000000, 'cash', 100, null, null, null, 'key-cash-dep1') ->> 'status' <> 'bad_payment' then raise exception 'E2E_FAIL cash with deposit'; end if;
  if public.sale_offer_submit_as(buyer, lst, 8000000000, 'instalment', null, null, null, null, 'key-inst-none') ->> 'status' <> 'bad_instalment' then raise exception 'E2E_FAIL instalment months'; end if;
  if public.sale_offer_submit_as(buyer, lst, 8000000000, 'cash', null, null, current_date - 1, null, 'key-past-0001') ->> 'status' <> 'bad_date' then raise exception 'E2E_FAIL past date'; end if;

  -- submit, idempotent replay
  r := public.sale_offer_submit_as(buyer, lst, 7800000000, 'mortgage', 1000000000, null, current_date + 90, 'Keen to inspect.', 'key-main-0001');
  if r ->> 'status' <> 'ok' then raise exception 'E2E_FAIL submit: %', r; end if;
  ag := (r ->> 'agreement_id')::uuid;
  if (public.sale_offer_submit_as(buyer, lst, 7800000000, 'mortgage', 1000000000, null, current_date + 90, 'Keen.', 'key-main-0001') ->> 'agreement_id')::uuid <> ag then raise exception 'E2E_FAIL replay made another'; end if;
  if public.sale_offer_submit_as(buyer, lst, 7000000000, 'cash', null, null, null, null, 'key-main-0002') ->> 'status' <> 'already_open' then raise exception 'E2E_FAIL second live offer'; end if;
  select count(*) into n from public.deal_agreements where kind = 'sale' and listing_id = lst and status::text = 'awaiting_parties'; if n <> 1 then raise exception 'E2E_FAIL count %', n; end if;
  -- blank amount means asking price, resolved
  r := public.sale_offer_submit_as(buyer2, lst, null, 'cash', null, null, null, null, 'key-b2-000001');
  ag2 := (r ->> 'agreement_id')::uuid;
  if (select amount_minor from public.deal_agreements where id = ag2) <> 8500000000 then raise exception 'E2E_FAIL blank should be asking'; end if;

  -- a stranger cannot see the room
  if public.sale_offer_room_as(staff, ag) ->> 'status' <> 'not_found' then raise exception 'E2E_FAIL stranger room'; end if;
  if public.sale_offer_room_as(poor, ag) ->> 'status' <> 'not_found' then raise exception 'E2E_FAIL stranger room 2'; end if;
  -- seller opens: stage moves, buyer identity stays out of it
  r := public.sale_offer_room_as(seller, ag);
  if r #>> '{offer,stage}' <> 'negotiating' then raise exception 'E2E_FAIL stage after seen: %', r #>> '{offer,stage}'; end if;
  if r::text ~* 'matched|nin|date_of_birth|legal_name' then raise exception 'E2E_FAIL identity leaked to seller'; end if;
  if (r ->> 'buyer_eligible')::boolean is not true then raise exception 'E2E_FAIL eligible outcome'; end if;

  -- turn order: buyer cannot counter against themselves; seller counters
  if public.sale_offer_counter_as(buyer, ag, 1, 7900000000, 'cash', null, null, null, null, 'k') ->> 'status' <> 'wrong_turn' then raise exception 'E2E_FAIL buyer own turn'; end if;
  if public.sale_offer_accept_as(buyer, ag, 1, 'k') ->> 'status' <> 'wrong_turn' then raise exception 'E2E_FAIL buyer accepts own offer'; end if;
  r := public.sale_offer_counter_as(seller, ag, 1, 8300000000, 'mortgage', 1000000000, null, null, 'Best I can do.', 'k');
  if r ->> 'status' <> 'ok' or (r ->> 'terms_version')::int <> 2 then raise exception 'E2E_FAIL counter: %', r; end if;
  -- stale version
  if public.sale_offer_counter_as(seller, ag, 1, 8200000000, 'cash', null, null, null, null, 'k') ->> 'status' not in ('wrong_turn','version_changed') then raise exception 'E2E_FAIL stale counter'; end if;
  if public.sale_offer_accept_as(buyer, ag, 1, 'k') ->> 'status' <> 'superseded' then raise exception 'E2E_FAIL superseded accept'; end if;
  r := public.sale_offer_counter_as(buyer, ag, 2, 8050000000, 'mortgage', 1000000000, null, null, null, 'k');
  if (r ->> 'terms_version')::int <> 3 then raise exception 'E2E_FAIL v3'; end if;
  r := public.sale_offer_counter_as(seller, ag, 3, 8150000000, 'mortgage', 1000000000, null, null, null, 'k');
  if (r ->> 'terms_version')::int <> 4 then raise exception 'E2E_FAIL v4'; end if;
  -- history survives: four snapshots, original amount intact
  select count(*) into n from public.deal_agreement_versions where agreement_id = ag; if n <> 4 then raise exception 'E2E_FAIL versions %', n; end if;
  if (select amount_minor from public.deal_agreement_versions where agreement_id = ag and terms_version = 1) <> 7800000000 then raise exception 'E2E_FAIL v1 overwritten'; end if;
  -- the seller cannot accept their own counter
  if public.sale_offer_accept_as(seller, ag, 4, 'k') ->> 'status' <> 'wrong_turn' then raise exception 'E2E_FAIL seller accepts own counter'; end if;

  -- listing suspended mid-negotiation blocks acceptance
  update public.listings set status = 'SUSPENDED' where id = lst;
  if public.sale_offer_accept_as(buyer, ag, 4, 'k') ->> 'status' <> 'listing_unavailable' then raise exception 'E2E_FAIL suspended accept'; end if;
  update public.listings set status = 'PUBLISHED' where id = lst;

  -- buyer accepts v4: agreed, no money, no sold
  r := public.sale_offer_accept_as(buyer, ag, 4, 'k');
  if r ->> 'status' <> 'ok' then raise exception 'E2E_FAIL accept: %', r; end if;
  if (select status::text from public.deal_agreements where id = ag) <> 'approved' then raise exception 'E2E_FAIL not approved'; end if;
  if (select sale_status::text from public.listings where id = lst) = 'sold' then raise exception 'E2E_FAIL marked sold'; end if;
  if public.sale_offer_accept_as(buyer, ag, 4, 'k') ->> 'replay' is distinct from 'true' then raise exception 'E2E_FAIL accept replay'; end if;
  -- the other buyer's offer cannot also be agreed
  if public.sale_offer_accept_as(seller, ag2, 1, 'k') ->> 'status' <> 'listing_has_agreed_offer' then raise exception 'E2E_FAIL double agreement'; end if;

  -- walls: no payment, no change of agreed terms, no paid / in_review
  begin insert into public.transactions (agreement_id) values (ag); raise exception 'E2E_FAIL transaction allowed'; exception when insufficient_privilege then null; end;
  begin update public.deal_agreements set amount_minor = 1 where id = ag; raise exception 'E2E_FAIL terms edited'; exception when insufficient_privilege then null; end;
  begin update public.deal_agreements set status = 'paid' where id = ag; raise exception 'E2E_FAIL paid'; exception when check_violation then null; end;
  begin update public.deal_agreements set status = 'in_review' where id = ag; raise exception 'E2E_FAIL in_review'; exception when check_violation then null; end;

  -- stages: forward one step, completed needs both sides
  if public.sale_offer_stage_as(buyer, ag, 'closing') ->> 'status' <> 'bad_stage' then raise exception 'E2E_FAIL skip stage'; end if;
  perform public.sale_offer_stage_as(buyer, ag, 'due_diligence');
  perform public.sale_offer_stage_as(seller, ag, 'documentation');
  perform public.sale_offer_stage_as(buyer, ag, 'closing');
  if public.sale_offer_stage_as(buyer, ag, 'completed') ->> 'status' <> 'waiting_for_other_side' then raise exception 'E2E_FAIL completion one side'; end if;
  if public.sale_offer_stage_as(buyer, ag, 'completed') ->> 'status' <> 'waiting_for_other_side' then raise exception 'E2E_FAIL completion same side twice'; end if;
  if public.sale_offer_stage_as(seller, ag, 'completed') ->> 'status' <> 'ok' then raise exception 'E2E_FAIL completion both'; end if;

  -- documents: private, stranger refused, uploader cannot review own file
  r := public.sale_doc_request_as(buyer, ag, 'certificate_of_occupancy', null);
  if r ->> 'status' <> 'ok' then raise exception 'E2E_FAIL doc request %', r; end if;
  r := public.sale_doc_prepare_as(seller, ag, (select id from public.deal_documents where agreement_id = ag limit 1), null, null);
  perform public.sale_doc_register_as(seller, ag, (r ->> 'document_id')::uuid, ag::text || '/' || (r ->> 'document_id') || '/1-co.pdf', 'co.pdf', 'application/pdf', 1000);
  if public.sale_doc_register_as(seller, ag, (r ->> 'document_id')::uuid, 'other/path.pdf', 'co.pdf', 'application/pdf', 1000) ->> 'status' <> 'bad_request' then raise exception 'E2E_FAIL foreign path'; end if;
  if public.sale_doc_access_as(poor, ag, (r ->> 'document_id')::uuid) ->> 'status' <> 'not_found' then raise exception 'E2E_FAIL stranger doc'; end if;
  if public.sale_doc_review_as(seller, ag, (r ->> 'document_id')::uuid, 'approved', null) ->> 'status' <> 'own_document' then raise exception 'E2E_FAIL own review'; end if;
  if public.sale_doc_review_as(buyer, ag, (r ->> 'document_id')::uuid, 'rejected', null) ->> 'status' <> 'reason_required' then raise exception 'E2E_FAIL reject needs reason'; end if;
  perform public.sale_doc_review_as(buyer, ag, (r ->> 'document_id')::uuid, 'approved', null);
  if public.sale_doc_access_as(buyer, ag, (r ->> 'document_id')::uuid) ->> 'status' <> 'ok' then raise exception 'E2E_FAIL doc access'; end if;
  select count(*) into n from public.deal_document_access; if n <> 1 then raise exception 'E2E_FAIL access not logged'; end if;

  -- decline, withdraw, expiry on the second offer set
  -- (ag2 is still live; decline by seller)
  if public.sale_offer_decline_as(buyer2, ag2, null) ->> 'status' <> 'wrong_turn' then raise exception 'E2E_FAIL buyer declines'; end if;
  if public.sale_offer_decline_as(seller, ag2, null) ->> 'status' <> 'ok' then raise exception 'E2E_FAIL decline'; end if;
  if (select decision_reason from public.deal_agreements where id = ag2) is null then raise exception 'E2E_FAIL decline reason'; end if;
  if public.sale_offer_withdraw_as(buyer2, ag2) ->> 'status' <> 'locked' then raise exception 'E2E_FAIL withdraw after decline'; end if;
  -- expiry job
  update public.deal_agreements set status = 'cancelled' where id = ag;  -- clear the agreed offer
  r := public.sale_offer_submit_as(buyer2, lst, 8000000000, 'cash', null, null, null, null, 'key-b2-000002');
  ag2 := (r ->> 'agreement_id')::uuid;
  update public.deal_agreements set expires_at = now() - interval '1 day' where id = ag2;
  if public.sale_offer_accept_as(seller, ag2, 1, 'k') ->> 'status' <> 'expired' then raise exception 'E2E_FAIL accept expired'; end if;
  update public.deal_agreements set status = 'awaiting_parties' where id = ag2;
  if (public.sale_offers_expire_due() ->> 'expired')::int <> 1 then raise exception 'E2E_FAIL expire job'; end if;
  if (select status::text from public.deal_agreements where id = ag2) <> 'expired' then raise exception 'E2E_FAIL not expired'; end if;

  -- admin: needs staff; cannot change terms
  perform set_config('request.jwt.claim.sub', poor::text, true);
  if public.admin_sale_offers_list(null, 10) ->> 'status' <> 'forbidden' then raise exception 'E2E_FAIL non staff list'; end if;
  perform set_config('request.jwt.claim.sub', staff::text, true);
  if jsonb_array_length(public.admin_sale_offers_list(null, 10) -> 'rows') < 2 then raise exception 'E2E_FAIL admin list'; end if;
  if public.admin_sale_offers_metrics() ->> 'submitted' is null then raise exception 'E2E_FAIL metrics'; end if;
  if public.admin_sale_offer_intervene(ag, 'note', 'short') ->> 'status' <> 'reason_required' then raise exception 'E2E_FAIL intervene reason'; end if;
  if public.admin_sale_offer_detail(ag) ->> 'status' <> 'ok' then raise exception 'E2E_FAIL admin detail'; end if;
  if public.admin_sale_offer_detail(ag)::text ~* 'storage_path|body' then raise exception 'E2E_FAIL admin saw path or messages'; end if;
  if public.admin_sale_doc_access((select id from public.deal_documents limit 1), 'too short') ->> 'status' <> 'reason_required' then raise exception 'E2E_FAIL staff doc reason'; end if;

  -- the joined inspection's report reaches the room: ticks and a photo count, no path
  declare insp uuid; begin
    insert into public.inspection_requests (listing_id, requester_id) values (lst, buyer) returning id into insp;
    insert into public.inspection_reports values (insp, buyer, now());
    insert into public.inspection_report_items values (insp, 'kitchen', true, 'ok'), (insp, 'safety', false, null);
    insert into public.inspection_report_photos (inspection_id, storage_path) values (insp, 'secret/path.jpg');
    update public.deal_agreements set status = 'awaiting_parties', sale_stage = 'negotiating' where id = ag;
    perform public.sale_offer_link_inspection_as(buyer, ag, insp);
    r := public.sale_offer_room_as(seller, ag);
    if jsonb_array_length(r #> '{inspection_report,items}') <> 2 or (r #>> '{inspection_report,photo_count}')::int <> 1 then raise exception 'E2E_FAIL report in room: %', r -> 'inspection_report'; end if;
    if r::text like '%secret/path%' then raise exception 'E2E_FAIL photo path leaked'; end if;
    update public.deal_agreements set status = 'cancelled' where id = ag;
  end;
  -- ADVERSARIAL: a self-approved identity document is not eligibility
  insert into public.agent_documents (uploader_id, kind, review_status, reviewed_by) values (poor, 'identity', 'approved', poor);
  if (private.sale_eligibility(poor, lst) ->> 'eligible')::boolean then raise exception 'E2E_FAIL self-approved id counted'; end if;
  insert into public.agent_documents (uploader_id, kind, review_status, reviewed_by) values (poor, 'identity', 'approved', staff);
  if not (private.sale_eligibility(poor, lst) ->> 'eligible')::boolean then raise exception 'E2E_FAIL reviewed id not counted'; end if;
  delete from public.agent_documents where uploader_id = poor;
  -- ADVERSARIAL: an agent with a mandate on file but none live cannot take offers; a live one can
  insert into public.listing_mandates (listing_id, kind, review_status, reviewed_at, expires_on) values (lst, 'sale', 'approved', now(), current_date - 1);
  if public.sale_offer_submit_as(buyer, lst, null, 'cash', null, null, null, null, 'key-mand-0001') ->> 'status' <> 'no_mandate' then raise exception 'E2E_FAIL expired mandate'; end if;
  update public.listing_mandates set expires_on = current_date + 30 where listing_id = lst;
  r := public.sale_offer_submit_as(buyer, lst, null, 'cash', null, null, null, null, 'key-mand-0002');
  if r ->> 'status' <> 'ok' then raise exception 'E2E_FAIL live mandate refused %', r; end if;
  if (select mandate_id from public.deal_agreements where id = (r ->> 'agreement_id')::uuid) is null then raise exception 'E2E_FAIL mandate not linked'; end if;
  -- mandate lapses mid-negotiation: acceptance refused
  update public.listing_mandates set expires_on = current_date - 1 where listing_id = lst;
  if public.sale_offer_accept_as(seller, (r ->> 'agreement_id')::uuid, 1, 'k') ->> 'status' <> 'no_mandate' then raise exception 'E2E_FAIL accept after mandate lapsed'; end if;
  update public.listing_mandates set expires_on = current_date + 30 where listing_id = lst;
  -- price changed under a live offer: acceptance still works and the record names both prices
  update public.listings set sale_price_minor = 9000000000 where id = lst;
  if public.sale_offer_accept_as(seller, (r ->> 'agreement_id')::uuid, 1, 'k') ->> 'status' <> 'ok' then raise exception 'E2E_FAIL accept after price change'; end if;
  if (select note from public.deal_agreement_events where agreement_id = (r ->> 'agreement_id')::uuid and action = 'approved') not like '%NGN%' and (select note from public.deal_agreement_events where agreement_id = (r ->> 'agreement_id')::uuid and action = 'approved') not like '%₦%' then raise exception 'E2E_FAIL price note'; end if;
  -- a suspended listing takes no new offer
  update public.listings set status = 'SUSPENDED' where id = lst;
  if public.sale_offer_submit_as(buyer2, lst, null, 'cash', null, null, null, null, 'key-susp-0001') ->> 'status' <> 'listing_unavailable' then raise exception 'E2E_FAIL suspended submit'; end if;

  raise exception 'E2E_OK';
end $$;
