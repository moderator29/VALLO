-- =====================================================================
-- OFFERS 2 of 3: THE DOORS (10 November 2026). NOT APPLIED. Run after 1.
-- =====================================================================
-- Every transition is validated here, in a definer function that takes the
-- caller's id from the SESSION (the server passes it; a client can never name
-- another person). Same pattern as agreement_open_rent_as and friends. Each
-- door locks the agreement row (`for update`), so two sellers, or one seller in
-- two tabs, can never produce two answers. Acceptance also takes a lock on the
-- LISTING, so two different offers cannot both be agreed at once.
--
-- WHAT A DOOR NEVER DOES: create a transaction, take money, mark a listing
-- sold, or change agreed terms. Statuses come back as words the server turns
-- into sentences.

-- A notice to one person: in the app and by email, linked to the Deal Room.
create or replace function private.sale_tell(
  p_ag public.deal_agreements, p_to uuid, p_template text, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_to is null then
    return;
  end if;
  perform private.notify(p_to, 'booking', p_title, p_body, '/offers/' || p_ag.id::text);
  perform private.email_outbox_enqueue(
    p_to, p_template,
    p_template || ':' || p_ag.id::text || ':' || p_ag.terms_version::text || ':' || p_to::text,
    jsonb_build_object('agreement_id', p_ag.id, 'reference', p_ag.reference, 'listing_id', p_ag.listing_id,
                       'amount_minor', p_ag.amount_minor, 'terms_version', p_ag.terms_version));
end;
$function$;
revoke all on function private.sale_tell(public.deal_agreements, uuid, text, text, text) from public, anon, authenticated;

-- Validates payment fields shared by a first offer and a counteroffer.
-- Returns null when fine, or the status word that refuses.
create or replace function private.sale_terms_problem(
  p_amount bigint, p_pref text, p_deposit bigint, p_months integer, p_target date, p_note text)
returns text
language plpgsql
stable
set search_path to ''
as $function$
declare
  ceiling_minor bigint;
begin
  select max_amount_minor into ceiling_minor from public.offer_policy where id;
  if p_amount is null or p_amount <= 0 then
    return 'bad_amount';
  end if;
  if p_amount > coalesce(ceiling_minor, 10000000000000) then
    return 'amount_too_large';
  end if;
  if p_pref is null or p_pref not in ('cash', 'mortgage', 'instalment') then
    return 'bad_payment';
  end if;
  if p_pref = 'cash' and (p_deposit is not null or p_months is not null) then
    return 'bad_payment';
  end if;
  if p_deposit is not null and (p_deposit < 0 or p_deposit >= p_amount) then
    return 'bad_deposit';
  end if;
  if p_pref = 'instalment' and (p_months is null or p_months < 1 or p_months > 120) then
    return 'bad_instalment';
  end if;
  if p_pref <> 'instalment' and p_months is not null then
    return 'bad_payment';
  end if;
  if p_target is not null and (p_target < (now() at time zone 'Africa/Lagos')::date
                               or p_target > (now() at time zone 'Africa/Lagos')::date + 1095) then
    return 'bad_date';
  end if;
  if p_note is not null and length(p_note) > 2000 then
    return 'note_too_long';
  end if;
  return null;
end;
$function$;
revoke all on function private.sale_terms_problem(bigint, text, bigint, integer, date, text) from public, anon, authenticated;

-- THE GATE: what the buyer sees before the form. Read only.
create or replace function public.sale_offer_gate_as(p_actor uuid, p_listing uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  lst public.listings%rowtype;
  seller uuid;
  elig jsonb;
  existing uuid;
  side text := 'none';
  reason text;
begin
  select * into lst from public.listings where id = p_listing;
  if lst.id is null or lst.listing_intent is distinct from 'sale' then
    return jsonb_build_object('status', 'not_found');
  end if;
  seller := private.sale_seller_of(lst.id);
  elig := case when p_actor is null then jsonb_build_object('eligible', false, 'requirements', '[]'::jsonb)
               else private.sale_eligibility(p_actor, lst.id) end;
  if p_actor is not null then
    select a.id into existing from public.deal_agreements a
     where a.kind = 'sale' and a.listing_id = lst.id and a.renter_id = p_actor
       and a.status::text in ('awaiting_parties', 'approved') limit 1;
    if p_actor = seller then
      side := 'seller';
    end if;
  end if;
  reason := case
    when p_actor is null then 'Sign in to make an offer.'
    when side = 'seller' then 'This is your listing. Offers appear under Offers received.'
    when lst.status::text <> 'PUBLISHED' then 'This property is not taking offers right now.'
    when lst.sale_status::text = 'sold' then 'This property has been marked sold by its lister.'
    when not lst.offers_enabled then 'The lister is not taking offers on this property.'
    when lst.sale_price_minor is null or lst.sale_price_minor <= 0 then 'This listing has no asking price yet, so there is nothing to offer on.'
    when seller is null then 'This property is not taking offers right now.'
    when not private.sale_mandate_ok(lst.id) then 'This property is not taking offers right now.'
    when existing is not null then 'You already have an offer on this property.'
    else null end;
  return jsonb_build_object(
    'status', 'ok',
    'listing_id', lst.id, 'title', lst.title,
    'asking_minor', lst.sale_price_minor,
    'negotiable', lst.price_negotiable,
    'eligibility', elig,
    'mandate', private.sale_mandate_line(lst.id),
    'can_offer', reason is null and (elig ->> 'eligible')::boolean,
    'can_open_form', reason is null,
    'reason', reason,
    'viewer_side', side,
    'existing_offer_id', existing);
end;
$function$;

-- SUBMIT. Idempotent: the same key from the same buyer returns the same offer.
create or replace function public.sale_offer_submit_as(
  p_actor uuid, p_listing uuid, p_amount_minor bigint, p_pref text,
  p_deposit_minor bigint, p_months integer, p_target date, p_note text, p_key text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  lst public.listings%rowtype;
  pol public.offer_policy%rowtype;
  seller uuid;
  ag public.deal_agreements%rowtype;
  amount bigint;
  problem text;
  elig jsonb;
begin
  if p_actor is null or p_listing is null or p_key is null or length(p_key) < 8 or length(p_key) > 100 then
    return jsonb_build_object('status', 'bad_request');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sale-offer:' || p_actor::text, 0));

  select * into ag from public.deal_agreements where renter_id = p_actor and idempotency_key = p_key;
  if ag.id is not null then
    return jsonb_build_object('status', 'ok', 'replay', true, 'agreement_id', ag.id, 'reference', ag.reference);
  end if;

  select * into lst from public.listings where id = p_listing for share;
  if lst.id is null or lst.listing_intent is distinct from 'sale' or lst.status::text <> 'PUBLISHED'
     or lst.sale_status::text = 'sold' then
    return jsonb_build_object('status', 'listing_unavailable');
  end if;
  if not lst.offers_enabled then
    return jsonb_build_object('status', 'offers_off');
  end if;
  if lst.sale_price_minor is null or lst.sale_price_minor <= 0 then
    return jsonb_build_object('status', 'no_price');
  end if;
  seller := private.sale_seller_of(lst.id);
  if seller is null then
    return jsonb_build_object('status', 'listing_unavailable');
  end if;
  if seller = p_actor then
    return jsonb_build_object('status', 'own_listing');
  end if;
  if not private.sale_mandate_ok(lst.id) then
    return jsonb_build_object('status', 'no_mandate');
  end if;
  elig := private.sale_eligibility(p_actor, lst.id);
  if not (elig ->> 'eligible')::boolean then
    return jsonb_build_object('status', 'not_eligible', 'eligibility', elig);
  end if;

  -- Blank means the asking price; the figure is resolved HERE, never stored as zero or null.
  amount := coalesce(p_amount_minor, lst.sale_price_minor);
  problem := private.sale_terms_problem(amount, p_pref, p_deposit_minor, p_months, p_target, p_note);
  if problem is not null then
    return jsonb_build_object('status', problem);
  end if;

  select * into pol from public.offer_policy where id;
  select a.* into ag from public.deal_agreements a
   where a.kind = 'sale' and a.listing_id = lst.id and a.renter_id = p_actor
     and a.status::text in ('awaiting_parties', 'approved') limit 1;
  if ag.id is not null then
    return jsonb_build_object('status', 'already_open', 'agreement_id', ag.id);
  end if;
  if (select count(*) from public.deal_agreements a
       where a.kind = 'sale' and a.renter_id = p_actor and a.created_at > now() - interval '1 hour') >= pol.max_new_per_hour then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if (select count(*) from public.deal_agreements a
       where a.kind = 'sale' and a.renter_id = p_actor and a.status::text = 'awaiting_parties') >= pol.max_open_per_buyer then
    return jsonb_build_object('status', 'too_many_open');
  end if;

  insert into public.deal_agreements
    (kind, listing_id, renter_id, owner_id, amount_minor, terms, expires_at, sale_stage, awaiting_side,
     idempotency_key, reference, renter_confirmed_version, renter_confirmed_at, mandate_id, status, submitted_at)
  values
    ('sale', lst.id, p_actor, seller, amount,
     jsonb_build_object(
       'payment_preference', p_pref, 'deposit_minor', p_deposit_minor, 'instalment_months', p_months,
       'target_closing', p_target, 'note', nullif(btrim(coalesce(p_note, '')), ''),
       'proposed_by', 'buyer', 'at_asking_price', p_amount_minor is null,
       'asking_minor', lst.sale_price_minor),
     now() + make_interval(days => pol.expiry_days), 'offer', 'seller',
     p_key, private.sale_reference(), 1, now(), private.sale_live_mandate(lst.id), 'awaiting_parties', now())
  returning * into ag;

  perform private.agreement_log(ag, p_actor, 'opened', null,
    case when p_amount_minor is null then 'Offer at the asking price.' else 'Offer made.' end);
  perform private.sale_tell(ag, seller, 'offer.received', 'New offer on ' || coalesce(lst.title, 'your property'),
    private.sale_naira(amount) || ' offered. Asking price ' || private.sale_naira(lst.sale_price_minor) || '.');
  return jsonb_build_object('status', 'ok', 'agreement_id', ag.id, 'reference', ag.reference);
end;
$function$;

-- COUNTER: the side whose turn it is proposes NEW terms. A new version; the
-- version before is kept by the snapshot trigger and is never edited.
create or replace function public.sale_offer_counter_as(
  p_actor uuid, p_agreement uuid, p_base_version integer, p_amount_minor bigint, p_pref text,
  p_deposit_minor bigint, p_months integer, p_target date, p_note text, p_key text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  lst public.listings%rowtype;
  side text;
  other uuid;
  pol public.offer_policy%rowtype;
  problem text;
  newterms jsonb;
begin
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale' for update;
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  side := case when p_actor = ag.renter_id then 'buyer' else 'seller' end;
  other := case when side = 'buyer' then ag.owner_id else ag.renter_id end;
  if ag.status::text <> 'awaiting_parties' then
    return jsonb_build_object('status', case when ag.status::text = 'expired' then 'expired' else 'locked' end,
                              'agreement_status', ag.status);
  end if;
  if ag.expires_at is not null and ag.expires_at < now() then
    update public.deal_agreements set status = 'expired', updated_at = now() where id = ag.id returning * into ag;
    perform private.agreement_log(ag, null, 'expired', 'awaiting_parties', 'Reached its expiry date.');
    return jsonb_build_object('status', 'expired');
  end if;
  if ag.awaiting_side is distinct from side then
    return jsonb_build_object('status', 'wrong_turn');
  end if;
  if p_base_version is distinct from ag.terms_version then
    return jsonb_build_object('status', 'version_changed', 'terms_version', ag.terms_version);
  end if;
  select * into lst from public.listings where id = ag.listing_id;
  if lst.status::text <> 'PUBLISHED' or lst.sale_status::text = 'sold' or p_actor is distinct from
     (case when side = 'seller' then private.sale_seller_of(ag.listing_id) else ag.renter_id end) then
    return jsonb_build_object('status', 'listing_unavailable');
  end if;
  if not private.sale_mandate_ok(ag.listing_id) then
    return jsonb_build_object('status', 'no_mandate');
  end if;
  problem := private.sale_terms_problem(p_amount_minor, p_pref, p_deposit_minor, p_months, p_target, p_note);
  if problem is not null then
    return jsonb_build_object('status', problem);
  end if;
  if p_amount_minor = ag.amount_minor and p_pref = ag.terms ->> 'payment_preference'
     and p_target is not distinct from nullif(ag.terms ->> 'target_closing', '')::date
     and p_deposit_minor is not distinct from nullif(ag.terms ->> 'deposit_minor', '')::bigint
     and p_months is not distinct from nullif(ag.terms ->> 'instalment_months', '')::integer then
    return jsonb_build_object('status', 'no_change');
  end if;
  select * into pol from public.offer_policy where id;
  newterms := jsonb_build_object(
    'payment_preference', p_pref, 'deposit_minor', p_deposit_minor, 'instalment_months', p_months,
    'target_closing', p_target, 'note', nullif(btrim(coalesce(p_note, '')), ''),
    'proposed_by', side, 'at_asking_price', false, 'asking_minor', lst.sale_price_minor);

  update public.deal_agreements
     set terms = newterms, amount_minor = p_amount_minor, terms_version = terms_version + 1,
         renter_confirmed_version = case when side = 'buyer' then terms_version + 1 else null end,
         renter_confirmed_at = case when side = 'buyer' then now() else null end,
         owner_confirmed_version = case when side = 'seller' then terms_version + 1 else null end,
         owner_confirmed_at = case when side = 'seller' then now() else null end,
         awaiting_side = case when side = 'buyer' then 'seller' else 'buyer' end,
         sale_stage = 'negotiating',
         expires_at = now() + make_interval(days => pol.expiry_days),
         updated_at = now()
   where id = ag.id returning * into ag;

  perform private.agreement_log(ag, p_actor, 'countered', 'awaiting_parties', nullif(btrim(coalesce(p_note, '')), ''));
  perform private.sale_tell(ag, other, 'offer.countered',
    case when side = 'seller' then 'Counteroffer received' else 'Revised offer received' end,
    private.sale_naira(p_amount_minor) || ' proposed (version ' || ag.terms_version || '). Your answer is waiting.');
  return jsonb_build_object('status', 'ok', 'terms_version', ag.terms_version);
end;
$function$;

-- ACCEPT: the side whose turn it is accepts THE VERSION THEY WERE LOOKING AT.
-- "Terms agreed" is all this means. No sale, no transfer, no money.
create or replace function public.sale_offer_accept_as(p_actor uuid, p_agreement uuid, p_version integer, p_key text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  lst public.listings%rowtype;
  side text;
  other uuid;
  pol public.offer_policy%rowtype;
begin
  select listing_id into lst.id from public.deal_agreements where id = p_agreement and kind = 'sale';
  if lst.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  -- One acceptance at a time per listing, then the row itself.
  perform pg_advisory_xact_lock(hashtextextended('sale-listing:' || lst.id::text, 0));
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale' for update;
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  side := case when p_actor = ag.renter_id then 'buyer' else 'seller' end;
  other := case when side = 'buyer' then ag.owner_id else ag.renter_id end;

  if ag.status::text = 'approved' and ag.agreed_version = p_version then
    return jsonb_build_object('status', 'ok', 'replay', true);
  end if;
  if ag.status::text <> 'awaiting_parties' then
    return jsonb_build_object('status', case when ag.status::text = 'expired' then 'expired' else 'locked' end,
                              'agreement_status', ag.status);
  end if;
  if ag.expires_at is not null and ag.expires_at < now() then
    update public.deal_agreements set status = 'expired', updated_at = now() where id = ag.id returning * into ag;
    perform private.agreement_log(ag, null, 'expired', 'awaiting_parties', 'Reached its expiry date.');
    return jsonb_build_object('status', 'expired');
  end if;
  if p_version is distinct from ag.terms_version then
    return jsonb_build_object('status', 'superseded', 'terms_version', ag.terms_version);
  end if;
  if ag.awaiting_side is distinct from side then
    return jsonb_build_object('status', 'wrong_turn');
  end if;
  select * into lst from public.listings where id = ag.listing_id;
  if lst.status::text <> 'PUBLISHED' or lst.sale_status::text = 'sold' or not lst.offers_enabled then
    return jsonb_build_object('status', 'listing_unavailable');
  end if;
  -- The seller on record must still be the lister, with the right to sell.
  if ag.owner_id is distinct from private.sale_seller_of(ag.listing_id) then
    return jsonb_build_object('status', 'not_a_party');
  end if;
  if not private.sale_mandate_ok(ag.listing_id) then
    return jsonb_build_object('status', 'no_mandate');
  end if;
  if exists (select 1 from public.deal_agreements o
              where o.kind = 'sale' and o.listing_id = ag.listing_id and o.id <> ag.id
                and o.status::text = 'approved' and o.sale_stage <> 'completed') then
    return jsonb_build_object('status', 'listing_has_agreed_offer');
  end if;
  if not (private.sale_eligibility(ag.renter_id, ag.listing_id) ->> 'eligible')::boolean then
    return jsonb_build_object('status', 'not_eligible');
  end if;

  update public.deal_agreements
     set renter_confirmed_version = terms_version, renter_confirmed_at = coalesce(case when side = 'buyer' then now() end, renter_confirmed_at, now()),
         owner_confirmed_version = terms_version,  owner_confirmed_at  = coalesce(case when side = 'seller' then now() end, owner_confirmed_at, now()),
         agreed_version = terms_version, status = 'approved', sale_stage = 'agreed', awaiting_side = null,
         decided_at = now(), decided_by = p_actor, updated_at = now()
   where id = ag.id returning * into ag;

  perform private.agreement_log(ag, p_actor, 'approved', 'awaiting_parties',
    'Terms agreed at version ' || ag.terms_version || ': ' || private.sale_naira(ag.amount_minor) ||
    '. Asking price when proposed ' || private.sale_naira(coalesce((ag.terms ->> 'asking_minor')::bigint, 0)) ||
    ', now ' || private.sale_naira(coalesce(lst.sale_price_minor, 0)) || '.');
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, 'sale_offer.accepted', 'deal_agreement', ag.id::text,
          jsonb_build_object('version', ag.terms_version, 'amount_minor', ag.amount_minor, 'side', side));

  select * into pol from public.offer_policy where id;
  if pol.mark_under_offer and lst.sale_status::text = 'available' then
    update public.listings set sale_status = 'under_offer' where id = lst.id;
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (p_actor, 'sale_offer.listing_under_offer', 'listing', lst.id::text, jsonb_build_object('agreement_id', ag.id));
  end if;

  perform private.sale_tell(ag, other, 'offer.agreed', 'Terms agreed',
    private.sale_naira(ag.amount_minor) || ' agreed. This is not a sale yet: the inspection, documents and transfer still have to happen.');
  return jsonb_build_object('status', 'ok');
end;
$function$;

-- DECLINE: the seller, on their turn.
create or replace function public.sale_offer_decline_as(p_actor uuid, p_agreement uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale' for update;
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  if p_actor <> ag.owner_id then
    return jsonb_build_object('status', 'wrong_turn');
  end if;
  if reason is not null and length(reason) > 1000 then
    return jsonb_build_object('status', 'note_too_long');
  end if;
  if ag.status::text <> 'awaiting_parties' then
    return jsonb_build_object('status', case when ag.status::text = 'expired' then 'expired' else 'locked' end);
  end if;
  update public.deal_agreements
     set status = 'rejected', awaiting_side = null, decided_at = now(), decided_by = p_actor,
         decision_reason = coalesce(reason, 'The seller declined this offer.'), updated_at = now()
   where id = ag.id returning * into ag;
  perform private.agreement_log(ag, p_actor, 'declined', 'awaiting_parties', reason);
  perform private.sale_tell(ag, ag.renter_id, 'offer.declined', 'Offer declined',
    'The seller declined offer ' || ag.reference || '.' || coalesce(' They said: ' || reason, ''));
  return jsonb_build_object('status', 'ok');
end;
$function$;

-- WITHDRAW: the buyer, while the offer is live or agreed but not completed.
create or replace function public.sale_offer_withdraw_as(p_actor uuid, p_agreement uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  before_status public.agreement_status;
begin
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale' for update;
  if ag.id is null or p_actor <> ag.renter_id then
    return jsonb_build_object('status', 'not_found');
  end if;
  if ag.status::text not in ('awaiting_parties', 'approved') or ag.sale_stage = 'completed' then
    return jsonb_build_object('status', 'locked', 'agreement_status', ag.status);
  end if;
  before_status := ag.status;
  update public.deal_agreements set status = 'withdrawn', awaiting_side = null, updated_at = now() where id = ag.id returning * into ag;
  perform private.agreement_log(ag, p_actor, 'withdrawn', before_status, null);
  perform private.sale_tell(ag, ag.owner_id, 'offer.withdrawn', 'Offer withdrawn',
    'The buyer withdrew offer ' || ag.reference || '.');
  return jsonb_build_object('status', 'ok');
end;
$function$;

-- REQUEST MORE INFORMATION (seller) and the buyer's answer. No terms change.
create or replace function public.sale_offer_info_as(p_actor uuid, p_agreement uuid, p_text text, p_asking boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  t text := nullif(btrim(coalesce(p_text, '')), '');
  side text;
begin
  if t is null or length(t) < 3 or length(t) > 2000 then
    return jsonb_build_object('status', 'bad_request');
  end if;
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale' for update;
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  side := case when p_actor = ag.renter_id then 'buyer' else 'seller' end;
  if ag.status::text <> 'awaiting_parties' then
    return jsonb_build_object('status', 'locked');
  end if;
  if ag.awaiting_side is distinct from side or (p_asking and side <> 'seller') or (not p_asking and side <> 'buyer') then
    return jsonb_build_object('status', 'wrong_turn');
  end if;
  update public.deal_agreements
     set awaiting_side = case when side = 'seller' then 'buyer' else 'seller' end,
         sale_stage = 'negotiating', updated_at = now()
   where id = ag.id returning * into ag;
  perform private.agreement_log(ag, p_actor, case when p_asking then 'info_requested' else 'info_provided' end,
                                'awaiting_parties', t);
  perform private.sale_post(private.sale_conversation(ag.listing_id, ag.renter_id, ag.owner_id), p_actor, t);
  perform private.sale_tell(ag, case when side = 'seller' then ag.renter_id else ag.owner_id end,
    case when p_asking then 'offer.info_requested' else 'offer.info_provided' end,
    case when p_asking then 'The seller has a question' else 'The buyer answered' end,
    'On offer ' || ag.reference || '. Open the Deal Room to read it.');
  return jsonb_build_object('status', 'ok');
end;
$function$;

-- THE SELLER OPENS THE OFFER: the stage moves from "Offer submitted" to
-- "Seller reviewing" on a recorded event, and the reader's mark is set.
create or replace function private.sale_seen(p_ag public.deal_agreements, p_actor uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.deal_reads (agreement_id, user_id, last_seen_at) values (p_ag.id, p_actor, now())
  on conflict (agreement_id, user_id) do update set last_seen_at = excluded.last_seen_at;
  if p_actor = p_ag.owner_id and p_ag.sale_stage = 'offer' and p_ag.status::text = 'awaiting_parties' then
    update public.deal_agreements set sale_stage = 'negotiating', updated_at = now() where id = p_ag.id;
    insert into public.deal_agreement_events (agreement_id, actor_id, action, from_status, to_status, terms_version, note)
    values (p_ag.id, p_actor, 'seen', p_ag.status, p_ag.status, p_ag.terms_version, 'The seller opened the offer.');
  end if;
end;
$function$;
revoke all on function private.sale_seen(public.deal_agreements, uuid) from public, anon, authenticated;

-- STAGES after agreement move forward one step at a time, on a recorded event.
-- "completed" needs BOTH sides to record it; Vallo never completes a sale.
create or replace function public.sale_offer_stage_as(p_actor uuid, p_agreement uuid, p_stage text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  order_ text[] := array['agreed', 'due_diligence', 'documentation', 'closing', 'completed'];
  cur int;
  want int;
  other_marked boolean;
begin
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale' for update;
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  if ag.status::text <> 'approved' then
    return jsonb_build_object('status', 'locked', 'agreement_status', ag.status);
  end if;
  cur := array_position(order_, ag.sale_stage);
  want := array_position(order_, p_stage);
  if want is null or cur is null or want <> cur + 1 then
    return jsonb_build_object('status', 'bad_stage');
  end if;
  if p_stage = 'completed' then
    select exists (select 1 from public.deal_agreement_events e
                    where e.agreement_id = ag.id and e.action = 'stage' and e.note = 'completed'
                      and e.actor_id is distinct from p_actor) into other_marked;
    if not other_marked then
      if exists (select 1 from public.deal_agreement_events e
                  where e.agreement_id = ag.id and e.action = 'stage' and e.note = 'completed' and e.actor_id = p_actor) then
        return jsonb_build_object('status', 'waiting_for_other_side');
      end if;
      perform private.agreement_log(ag, p_actor, 'stage', ag.status, 'completed');
      perform private.sale_tell(ag, case when p_actor = ag.renter_id then ag.owner_id else ag.renter_id end,
        'offer.stage', 'Please confirm completion', 'The other side recorded that ' || ag.reference || ' has completed. Confirm if that is right.');
      return jsonb_build_object('status', 'waiting_for_other_side');
    end if;
  end if;
  update public.deal_agreements set sale_stage = p_stage, updated_at = now() where id = ag.id returning * into ag;
  perform private.agreement_log(ag, p_actor, 'stage', ag.status, p_stage);
  return jsonb_build_object('status', 'ok', 'stage', p_stage);
end;
$function$;

-- A booked inspection joins the deal. It must be this buyer's, on this listing.
create or replace function public.sale_offer_link_inspection_as(p_actor uuid, p_agreement uuid, p_inspection uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  insp public.inspection_requests%rowtype;
begin
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale' for update;
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  if ag.status::text not in ('awaiting_parties', 'approved') then
    return jsonb_build_object('status', 'locked');
  end if;
  select * into insp from public.inspection_requests where id = p_inspection;
  if insp.id is null or insp.listing_id <> ag.listing_id or insp.requester_id <> ag.renter_id then
    return jsonb_build_object('status', 'not_found');
  end if;
  if ag.inspection_id is not null and ag.inspection_id <> insp.id then
    return jsonb_build_object('status', 'already_open');
  end if;
  if exists (select 1 from public.deal_agreements o where o.inspection_id = insp.id and o.id <> ag.id) then
    return jsonb_build_object('status', 'already_open');
  end if;
  update public.deal_agreements
     set inspection_id = insp.id,
         sale_stage = case when sale_stage = 'agreed' then 'due_diligence' else sale_stage end,
         updated_at = now()
   where id = ag.id returning * into ag;
  perform private.agreement_log(ag, p_actor, 'inspection', ag.status, 'An inspection joined the deal.');
  return jsonb_build_object('status', 'ok');
end;
$function$;

-- A DISPUTE goes through the existing report and case desk, not a parallel one.
create or replace function public.sale_offer_dispute_as(p_actor uuid, p_agreement uuid, p_reason text, p_detail text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  words text := nullif(btrim(coalesce(p_detail, '')), '');
begin
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale' for update;
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  if words is null or length(words) < 20 or length(words) > 2000 or p_reason is null then
    return jsonb_build_object('status', 'describe_more');
  end if;
  if ag.disputed_at is not null then
    return jsonb_build_object('status', 'already_open');
  end if;
  update public.deal_agreements set disputed_at = now(), updated_at = now() where id = ag.id returning * into ag;
  perform private.agreement_log(ag, p_actor, 'disputed', ag.status, left(p_reason, 80));
  insert into public.reports (reporter_id, target_type, target_id, reason, category)
  values (p_actor, 'deal', ag.id::text, 'Deal ' || ag.reference || ' (' || left(p_reason, 80) || '): ' || words,
          case when p_reason = 'scam' then 'scam' when p_reason = 'not_as_described' then 'not_as_described' else 'other' end);
  perform private.sale_tell(ag, case when p_actor = ag.renter_id then ag.owner_id else ag.renter_id end,
    'offer.disputed', 'A concern was raised', 'The other side raised a concern on ' || ag.reference || '. Vallo will look at it.');
  return jsonb_build_object('status', 'ok');
end;
$function$;

-- THE JOBS. Called by the scheduled route with the service role.
create or replace function public.sale_offers_expire_due()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  n integer := 0;
begin
  for ag in
    select * from public.deal_agreements
     where kind = 'sale' and status::text = 'awaiting_parties' and expires_at is not null and expires_at < now()
     for update skip locked
  loop
    update public.deal_agreements set status = 'expired', awaiting_side = null, updated_at = now() where id = ag.id returning * into ag;
    perform private.agreement_log(ag, null, 'expired', 'awaiting_parties', 'Reached its expiry date.');
    perform private.sale_tell(ag, ag.renter_id, 'offer.expired', 'Offer expired', 'Offer ' || ag.reference || ' reached its expiry date without an agreement.');
    perform private.sale_tell(ag, ag.owner_id, 'offer.expired', 'Offer expired', 'Offer ' || ag.reference || ' reached its expiry date without an agreement.');
    n := n + 1;
  end loop;
  return jsonb_build_object('expired', n);
end;
$function$;

create or replace function public.sale_offers_remind_due()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  hrs integer;
  n integer := 0;
begin
  select remind_after_hours into hrs from public.offer_policy where id;
  for ag in
    select * from public.deal_agreements a
     where a.kind = 'sale' and a.status::text = 'awaiting_parties' and a.updated_at < now() - make_interval(hours => hrs)
       and (a.expires_at is null or a.expires_at > now())
       and not exists (select 1 from public.deal_agreement_events e
                        where e.agreement_id = a.id and e.action = 'reminded' and e.created_at > now() - make_interval(hours => hrs))
     for update skip locked
  loop
    perform private.sale_tell(ag, case when ag.awaiting_side = 'seller' then ag.owner_id else ag.renter_id end,
      'offer.reminder', 'An offer is waiting for you',
      'Offer ' || ag.reference || ' has been waiting for your answer' ||
      coalesce(' and expires on ' || to_char(ag.expires_at at time zone 'Africa/Lagos', 'DD Mon YYYY'), '') || '.');
    perform private.agreement_log(ag, null, 'reminded', 'awaiting_parties', null);
    n := n + 1;
  end loop;
  return jsonb_build_object('reminded', n);
end;
$function$;

revoke all on function public.sale_offer_gate_as(uuid, uuid), public.sale_offer_submit_as(uuid, uuid, bigint, text, bigint, integer, date, text, text),
  public.sale_offer_counter_as(uuid, uuid, integer, bigint, text, bigint, integer, date, text, text),
  public.sale_offer_accept_as(uuid, uuid, integer, text), public.sale_offer_decline_as(uuid, uuid, text),
  public.sale_offer_withdraw_as(uuid, uuid), public.sale_offer_info_as(uuid, uuid, text, boolean),
  public.sale_offer_stage_as(uuid, uuid, text), public.sale_offer_link_inspection_as(uuid, uuid, uuid),
  public.sale_offer_dispute_as(uuid, uuid, text, text), public.sale_offers_expire_due(), public.sale_offers_remind_due()
  from public, anon, authenticated;
grant execute on function public.sale_offer_gate_as(uuid, uuid), public.sale_offer_submit_as(uuid, uuid, bigint, text, bigint, integer, date, text, text),
  public.sale_offer_counter_as(uuid, uuid, integer, bigint, text, bigint, integer, date, text, text),
  public.sale_offer_accept_as(uuid, uuid, integer, text), public.sale_offer_decline_as(uuid, uuid, text),
  public.sale_offer_withdraw_as(uuid, uuid), public.sale_offer_info_as(uuid, uuid, text, boolean),
  public.sale_offer_stage_as(uuid, uuid, text), public.sale_offer_link_inspection_as(uuid, uuid, uuid),
  public.sale_offer_dispute_as(uuid, uuid, text, text), public.sale_offers_expire_due(), public.sale_offers_remind_due()
  to service_role;
