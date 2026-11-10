-- =====================================================================
-- VALLO OFFERS AND THE DEAL ROOM: THE ONE SQL DROP (10 November 2026)
-- =====================================================================
-- Paste once into the Supabase SQL Editor and press Run. Safe to run twice.
-- Rollback: pending/rollback/offers_rollback.sql.
--   Part 1  sale agreements: kind 'sale', the statuses, the walls (a sale can
--           never be paid, never take a transaction, never change once agreed),
--           offer policy and requirements, helpers
--   Part 2  the doors: submit, counter, accept, decline, withdraw, ask for
--           information, stages, inspection link, dispute, expiry and reminder jobs
--   Part 3  reads, the private document vault and its access log, the admin desk
-- Tested on a local copy of the schema: supabase/tests/offers (run.sh, e2e.sql,
-- race.sh: two sellers and two tabs accepting at once give one agreement).

-- ======================= offers_01_sale_agreements.sql =======================
-- =====================================================================
-- OFFERS 1 of 3: A SALE OFFER IS A deal_agreements ROW WITH kind = 'sale'
-- (10 November 2026). NOT APPLIED. Additive and safe to run twice.
-- =====================================================================
-- No new offers table. terms_version is the counteroffer version, the two
-- confirmed-version columns are accept-this-version, and the existing snapshot
-- trigger keeps every version. This file adds only: the two statuses, the
-- columns a sale needs, the walls that keep a sale from ever taking money,
-- the policy and requirement tables, and the private helpers.
--
-- THE WALLS (database, not frontend):
--   * a sale can never be 'paid' or 'in_review' (so the rent approval and
--     payment doors cannot be reached with a sale);
--   * a sale agreement can never be linked from a transaction (Vallo takes no
--     money for a purchase, and accepting an offer creates no money record);
--   * once terms are agreed (approved) the amount, terms and version cannot
--     change, by anyone, including staff;
--   * one live offer per buyer per listing;
--   * a retried request carries an idempotency key and cannot duplicate.
--
-- ROLLBACK: pending/rollback/offers_rollback.sql.

alter type public.agreement_status add value if not exists 'withdrawn';
alter type public.agreement_status add value if not exists 'expired';

alter table public.deal_agreements
  add column if not exists reference        text,
  add column if not exists expires_at       timestamptz,
  add column if not exists sale_stage       text,
  add column if not exists awaiting_side    text,
  add column if not exists idempotency_key  text,
  add column if not exists disputed_at      timestamptz,
  add column if not exists agreed_version   integer;

alter table public.deal_agreements drop constraint if exists deal_agreements_kind_check;
alter table public.deal_agreements add constraint deal_agreements_kind_check
  check (kind in ('rent', 'stay', 'sale'));

alter table public.deal_agreements drop constraint if exists deal_agreements_sale_stage_check;
alter table public.deal_agreements add constraint deal_agreements_sale_stage_check
  check (sale_stage is null or sale_stage in
    ('offer', 'negotiating', 'agreed', 'due_diligence', 'documentation', 'closing', 'completed'));

alter table public.deal_agreements drop constraint if exists deal_agreements_awaiting_side_check;
alter table public.deal_agreements add constraint deal_agreements_awaiting_side_check
  check (awaiting_side is null or awaiting_side in ('buyer', 'seller'));

-- A sale carries its stage and a reference; a rent or stay carries neither.
alter table public.deal_agreements drop constraint if exists deal_agreements_sale_shape;
alter table public.deal_agreements add constraint deal_agreements_sale_shape
  check ((kind = 'sale' and sale_stage is not null and reference is not null)
      or (kind <> 'sale' and sale_stage is null)) not valid;

-- THE WALL ON MONEY. Compared as text so this file can run in one go with the
-- enum additions above.
alter table public.deal_agreements drop constraint if exists deal_agreements_sale_takes_no_money;
alter table public.deal_agreements add constraint deal_agreements_sale_takes_no_money
  check (kind <> 'sale' or (status::text not in ('paid', 'in_review') and paid_at is null));

alter table public.deal_agreements drop constraint if exists deal_agreements_amount_ceiling;
alter table public.deal_agreements add constraint deal_agreements_amount_ceiling
  check (amount_minor <= 100000000000000) not valid;

create unique index if not exists deal_agreements_reference_key
  on public.deal_agreements (reference) where reference is not null;
create unique index if not exists deal_agreements_idempotency_key
  on public.deal_agreements (renter_id, idempotency_key) where idempotency_key is not null;
-- One LIVE offer per buyer per listing. The other buyers' offers coexist.
create unique index if not exists deal_agreements_one_live_sale_offer
  on public.deal_agreements (listing_id, renter_id)
  where kind = 'sale' and status in ('awaiting_parties', 'approved');
create index if not exists deal_agreements_sale_listing_idx
  on public.deal_agreements (listing_id, status) where kind = 'sale';
create index if not exists deal_agreements_sale_expiry_idx
  on public.deal_agreements (expires_at) where kind = 'sale' and status = 'awaiting_parties';

-- The history table already refuses edits; it now also knows the sale verbs.
alter table public.deal_agreement_events drop constraint if exists deal_agreement_events_action_check;
alter table public.deal_agreement_events add constraint deal_agreement_events_action_check
  check (action in ('opened', 'amended', 'confirmed', 'submitted', 'approved', 'rejected', 'cancelled', 'paid',
                    'countered', 'declined', 'withdrawn', 'expired', 'info_requested', 'info_provided',
                    'seen', 'stage', 'disputed', 'dispute_resolved', 'inspection', 'document', 'intervened',
                    'reminded', 'staff_view'));

-- A listing says whether it takes offers at all.
alter table public.listings add column if not exists offers_enabled boolean not null default true;

-- ---------------------------------------------------------------- policy
create table if not exists public.offer_policy (
  id                  boolean primary key default true check (id),
  expiry_days         integer not null default 14 check (expiry_days between 1 and 90),
  max_open_per_buyer  integer not null default 5 check (max_open_per_buyer between 1 and 50),
  max_new_per_hour    integer not null default 5 check (max_new_per_hour between 1 and 60),
  max_amount_minor    bigint  not null default 10000000000000 check (max_amount_minor > 0),
  remind_after_hours  integer not null default 72 check (remind_after_hours between 6 and 720),
  -- When an offer is agreed, mark the listing "under offer" (never "sold").
  mark_under_offer    boolean not null default false
);
insert into public.offer_policy (id) values (true) on conflict do nothing;
alter table public.offer_policy enable row level security;
revoke all on public.offer_policy from anon, authenticated;

-- Eligibility is configuration, per default, per property type or per listing.
create table if not exists public.offer_requirements (
  scope_kind  text not null check (scope_kind in ('default', 'property_type', 'listing')),
  scope_value text not null default '',
  key         text not null check (key in ('government_id', 'minimum_age', 'phone', 'email')),
  required    boolean not null,
  primary key (scope_kind, scope_value, key)
);
insert into public.offer_requirements (scope_kind, scope_value, key, required) values
  ('default', '', 'government_id', true),
  ('default', '', 'minimum_age',   true),
  ('default', '', 'phone',         false),
  ('default', '', 'email',         false)
on conflict do nothing;
alter table public.offer_requirements enable row level security;
revoke all on public.offer_requirements from anon, authenticated;

-- A reader's last look at a deal, for the unread marker.
create table if not exists public.deal_reads (
  agreement_id uuid not null references public.deal_agreements (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (agreement_id, user_id)
);
alter table public.deal_reads enable row level security;
revoke all on public.deal_reads from anon, authenticated;

-- ------------------------------------------------------------------ walls
create or replace function private.sale_agreed_terms_are_fixed()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if old.kind = 'sale' and old.status::text = 'approved' and new.status::text = 'approved'
     and (new.amount_minor is distinct from old.amount_minor
          or new.terms is distinct from old.terms
          or new.terms_version is distinct from old.terms_version
          or new.renter_confirmed_version is distinct from old.renter_confirmed_version
          or new.owner_confirmed_version is distinct from old.owner_confirmed_version
          or new.agreed_version is distinct from old.agreed_version) then
    raise exception 'Agreed terms cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$function$;
revoke all on function private.sale_agreed_terms_are_fixed() from public, anon, authenticated;
drop trigger if exists deal_agreements_sale_terms_fixed on public.deal_agreements;
create trigger deal_agreements_sale_terms_fixed before update on public.deal_agreements
  for each row execute function private.sale_agreed_terms_are_fixed();

create or replace function private.sale_agreements_take_no_money()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.agreement_id is not null
     and exists (select 1 from public.deal_agreements a where a.id = new.agreement_id and a.kind = 'sale') then
    raise exception 'Vallo takes no money for a purchase' using errcode = '42501';
  end if;
  return new;
end;
$function$;
revoke all on function private.sale_agreements_take_no_money() from public, anon, authenticated;
drop trigger if exists transactions_no_sale_money on public.transactions;
create trigger transactions_no_sale_money before insert or update of agreement_id on public.transactions
  for each row execute function private.sale_agreements_take_no_money();

-- ---------------------------------------------------------------- helpers

-- The seller side of a listing: the lister's user.
create or replace function private.sale_seller_of(p_listing uuid)
returns uuid
language sql
stable security definer
set search_path to ''
as $function$
  select a.user_id from public.listings l join public.agents a on a.id = l.agent_id where l.id = p_listing;
$function$;

-- The live sale mandate, if any: approved, in date, not withdrawn.
create or replace function private.sale_live_mandate(p_listing uuid)
returns uuid
language sql
stable security definer
set search_path to ''
as $function$
  select m.id from public.listing_mandates m
   where m.listing_id = p_listing
     and m.kind = 'sale'
     and m.review_status::text = 'approved'
     and (m.expires_on is null or m.expires_on >= (now() at time zone 'Africa/Lagos')::date)
   order by m.reviewed_at desc nulls last limit 1;
$function$;

-- A listing that has mandate rows needs a live sale mandate to take offers. A
-- listing with none is the owner's own: the lister is the seller.
create or replace function private.sale_mandate_ok(p_listing uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select not exists (select 1 from public.listing_mandates m where m.listing_id = p_listing)
      or private.sale_live_mandate(p_listing) is not null;
$function$;

create or replace function private.sale_mandate_line(p_listing uuid)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce(
    (select jsonb_build_object('held', true, 'reviewed_on', m.reviewed_at::date, 'expires_on', m.expires_on)
       from public.listing_mandates m where m.id = private.sale_live_mandate(p_listing)),
    jsonb_build_object('held', false, 'reviewed_on', null, 'expires_on', null));
$function$;

create or replace function private.sale_requirement_on(p_listing uuid, p_key text)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce(
    (select r.required from public.offer_requirements r
       where r.scope_kind = 'listing' and r.scope_value = p_listing::text and r.key = p_key),
    (select r.required from public.offer_requirements r
       join public.listings l on l.property_type::text = r.scope_value
       where r.scope_kind = 'property_type' and l.id = p_listing and r.key = p_key),
    (select r.required from public.offer_requirements r
       where r.scope_kind = 'default' and r.key = p_key),
    false);
$function$;

-- The buyer's own eligibility, as OUTCOMES only. Never an id number, a date of
-- birth or an image: the answer is a state per requirement and one boolean.
create or replace function private.sale_eligibility(p_user uuid, p_listing uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  id_state text;
  rows jsonb := '[]'::jsonb;
  one text;
  st text;
  all_met boolean := true;
begin
  if exists (select 1 from public.identity_verifications v where v.subject_id = p_user and v.outcome = 'matched')
     or exists (select 1 from public.identity_checks c where c.subject_id = p_user and c.status in ('passed', 'approved'))
     or exists (select 1 from public.agent_documents d
                 where d.uploader_id = p_user and d.kind = 'identity' and d.review_status::text = 'approved'
                   -- A person cannot approve their own document: the reviewer must be somebody else.
                   and d.reviewed_by is not null and d.reviewed_by <> d.uploader_id) then
    id_state := 'met';
  elsif exists (select 1 from public.identity_checks c where c.subject_id = p_user and c.status = 'review')
     or exists (select 1 from public.agent_documents d
                 where d.uploader_id = p_user and d.kind = 'identity' and d.review_status::text = 'pending') then
    id_state := 'needs_review';
  elsif exists (select 1 from public.identity_checks c where c.subject_id = p_user and c.status in ('opened', 'waiting', 'retry')) then
    id_state := 'in_progress';
  else
    id_state := 'required';
  end if;

  foreach one in array array['government_id', 'minimum_age', 'phone', 'email'] loop
    if not private.sale_requirement_on(p_listing, one) then
      continue;
    end if;
    st := case one
      when 'government_id' then id_state
      -- Age is confirmed by the same government id check; it follows it.
      when 'minimum_age' then id_state
      when 'phone' then case when exists (select 1 from auth.users u where u.id = p_user and u.phone_confirmed_at is not null)
                             then 'met' else 'required' end
      else case when exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null)
                then 'met' else 'required' end
    end;
    if st <> 'met' then
      all_met := false;
    end if;
    rows := rows || jsonb_build_array(jsonb_build_object('key', one, 'state', st));
  end loop;
  return jsonb_build_object('eligible', all_met, 'requirements', rows);
end;
$function$;

create or replace function private.sale_display_name(p_user uuid)
returns text
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce(nullif(btrim(split_part(coalesce(p.display_name, ''), ' ', 1)), ''), 'A member')
    from (select 1) x left join public.profiles p on p.id = p_user;
$function$;

create or replace function private.sale_reference()
returns text
language plpgsql
volatile
set search_path to ''
as $function$
declare
  r text;
begin
  loop
    r := 'VO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.deal_agreements a where a.reference = r);
  end loop;
  return r;
end;
$function$;

-- The listing's conversation with the seller, found or made. Never raises.
create or replace function private.sale_conversation(p_listing uuid, p_buyer uuid, p_seller uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  c uuid;
begin
  select id into c from public.conversations
   where guest_id = p_buyer and agent_id = p_seller and listing_id = p_listing limit 1;
  if c is null then
    begin
      insert into public.conversations (guest_id, agent_id, listing_id, context_kind)
      values (p_buyer, p_seller, p_listing, 'listing') returning id into c;
    exception when others then
      return null;
    end;
  end if;
  return c;
end;
$function$;

-- A card in the conversation: plain words, sent as the person who acted.
create or replace function private.sale_post(p_conversation uuid, p_sender uuid, p_body text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_conversation is null then
    return;
  end if;
  begin
    insert into public.messages (conversation_id, sender_id, body) values (p_conversation, p_sender, left(p_body, 1900));
  exception when others then
    null;
  end;
end;
$function$;

-- Naira words for notices. Whole naira, grouped.
create or replace function private.sale_naira(p_minor bigint)
returns text
language sql
immutable
set search_path to ''
as $function$
  select '₦' || trim(to_char((p_minor / 100)::numeric, 'FM999G999G999G999G999G999'));
$function$;

revoke all on function private.sale_seller_of(uuid), private.sale_live_mandate(uuid), private.sale_mandate_ok(uuid),
  private.sale_mandate_line(uuid), private.sale_requirement_on(uuid, text), private.sale_eligibility(uuid, uuid),
  private.sale_display_name(uuid), private.sale_reference(), private.sale_conversation(uuid, uuid, uuid),
  private.sale_post(uuid, uuid, text), private.sale_naira(bigint) from public, anon, authenticated;

-- ======================= offers_02_sale_doors.sql =======================
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

-- ======================= offers_03_reads_documents_admin.sql =======================
-- =====================================================================
-- OFFERS 3 of 3: READS, DOCUMENTS, ADMIN (10 November 2026). NOT APPLIED.
-- Run after 1 and 2. Safe to run twice.
-- =====================================================================
-- Reads are definer functions too, so a buyer's identity data can never be
-- joined into a seller's answer: the seller gets the eligibility OUTCOME only.
-- Documents live in a private bucket; the only way to a file is a signed URL
-- the server mints after `sale_doc_access_as` has checked the caller is a
-- party and has written the access to the log. Staff use their own door,
-- which needs a written justification and is logged.

-- ---------------------------------------------------------------- documents
create table if not exists public.deal_documents (
  id             uuid primary key default gen_random_uuid(),
  agreement_id   uuid not null references public.deal_agreements (id) on delete cascade,
  category       text not null check (category in ('certificate_of_occupancy', 'deed_of_assignment', 'survey_plan',
                   'building_approval', 'agent_authorisation', 'governors_consent', 'agreement_draft',
                   'inspection_report', 'other')),
  label          text check (label is null or length(label) <= 120),
  -- requested, uploaded, under_review, approved, rejected, more_information.
  -- "uploaded" is NEVER "verified": a person looked, or nobody has.
  state          text not null default 'requested'
                 check (state in ('requested', 'uploaded', 'under_review', 'approved', 'rejected', 'more_information')),
  requested_by   uuid references auth.users (id) on delete set null,
  uploaded_by    uuid references auth.users (id) on delete set null,
  storage_path   text,
  file_name      text check (file_name is null or length(file_name) <= 200),
  mime           text check (mime is null or mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes     bigint check (size_bytes is null or size_bytes between 1 and 15728640),
  version        integer not null default 0 check (version >= 0),
  uploaded_at    timestamptz,
  reviewer_id    uuid references auth.users (id) on delete set null,
  reviewer_kind  text check (reviewer_kind is null or reviewer_kind in ('party', 'staff')),
  reviewed_at    timestamptz,
  note           text check (note is null or length(note) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint deal_documents_path_has_prefix check (storage_path is null or storage_path like agreement_id::text || '/%')
);
create index if not exists deal_documents_agreement_idx on public.deal_documents (agreement_id);
alter table public.deal_documents enable row level security;
revoke all on public.deal_documents from anon, authenticated;

create table if not exists public.deal_document_access (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.deal_documents (id) on delete cascade,
  agreement_id  uuid not null,
  actor_id      uuid references auth.users (id) on delete set null,
  kind          text not null check (kind in ('party', 'staff')),
  justification text,
  created_at    timestamptz not null default now()
);
create index if not exists deal_document_access_doc_idx on public.deal_document_access (document_id, created_at);
alter table public.deal_document_access enable row level security;
revoke all on public.deal_document_access from anon, authenticated;
drop trigger if exists deal_document_access_fixed on public.deal_document_access;
create trigger deal_document_access_fixed before update or delete on public.deal_document_access
  for each row execute function private.history_is_fixed();

-- Private. No policy on storage.objects: only the service role signs URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-documents', 'deal-documents', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Make (or find) the document row an upload will attach to.
create or replace function public.sale_doc_prepare_as(
  p_actor uuid, p_agreement uuid, p_doc uuid, p_category text, p_label text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  d public.deal_documents%rowtype;
begin
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale';
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  if ag.status::text not in ('awaiting_parties', 'approved') then
    return jsonb_build_object('status', 'locked');
  end if;
  if p_doc is not null then
    select * into d from public.deal_documents where id = p_doc and agreement_id = ag.id for update;
    if d.id is null then
      return jsonb_build_object('status', 'not_found');
    end if;
  else
    if p_category is null or p_category not in ('certificate_of_occupancy', 'deed_of_assignment', 'survey_plan',
         'building_approval', 'agent_authorisation', 'governors_consent', 'agreement_draft', 'inspection_report', 'other') then
      return jsonb_build_object('status', 'bad_request');
    end if;
    insert into public.deal_documents (agreement_id, category, label, requested_by)
    values (ag.id, p_category, left(nullif(btrim(coalesce(p_label, '')), ''), 120), p_actor) returning * into d;
  end if;
  return jsonb_build_object('status', 'ok', 'document_id', d.id, 'next_version', d.version + 1);
end;
$function$;

create or replace function public.sale_doc_request_as(p_actor uuid, p_agreement uuid, p_category text, p_label text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r jsonb;
  ag public.deal_agreements%rowtype;
begin
  r := public.sale_doc_prepare_as(p_actor, p_agreement, null, p_category, p_label);
  if r ->> 'status' = 'ok' then
    select * into ag from public.deal_agreements where id = p_agreement;
    perform private.agreement_log(ag, p_actor, 'document', ag.status, 'Requested ' || replace(p_category, '_', ' ') || '.');
    perform private.sale_tell(ag, case when p_actor = ag.renter_id then ag.owner_id else ag.renter_id end,
      'offer.document', 'A document was requested', 'On ' || ag.reference || ': ' || replace(p_category, '_', ' ') || '.');
  end if;
  return r;
end;
$function$;

-- The file is in the bucket; record it. The path must sit under this deal.
create or replace function public.sale_doc_register_as(
  p_actor uuid, p_agreement uuid, p_doc uuid, p_path text, p_file_name text, p_mime text, p_size bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  d public.deal_documents%rowtype;
begin
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale';
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into d from public.deal_documents where id = p_doc and agreement_id = ag.id for update;
  if d.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if p_path is null or p_path not like ag.id::text || '/' || d.id::text || '/%' or p_size is null or p_size <= 0 or p_size > 15728640
     or p_mime is null or p_mime not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then
    return jsonb_build_object('status', 'bad_request');
  end if;
  update public.deal_documents
     set storage_path = p_path, file_name = left(p_file_name, 200), mime = p_mime, size_bytes = p_size,
         version = version + 1, state = 'uploaded', uploaded_by = p_actor, uploaded_at = now(),
         reviewer_id = null, reviewer_kind = null, reviewed_at = null, note = null, updated_at = now()
   where id = d.id;
  perform private.agreement_log(ag, p_actor, 'document', ag.status, 'Uploaded ' || replace(d.category, '_', ' ') || ' (version ' || (d.version + 1) || ').');
  if ag.sale_stage in ('agreed', 'due_diligence') and ag.status::text = 'approved' then
    update public.deal_agreements set sale_stage = 'documentation', updated_at = now() where id = ag.id;
  end if;
  perform private.sale_tell(ag, case when p_actor = ag.renter_id then ag.owner_id else ag.renter_id end,
    'offer.document', 'A document was uploaded', 'On ' || ag.reference || ': ' || replace(d.category, '_', ' ') ||
    '. Uploaded is not the same as checked: read it before you rely on it.');
  return jsonb_build_object('status', 'ok');
end;
$function$;

-- A signed link is only minted after this says yes, and this writes the log.
create or replace function public.sale_doc_access_as(p_actor uuid, p_agreement uuid, p_doc uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  d public.deal_documents%rowtype;
begin
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale';
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into d from public.deal_documents where id = p_doc and agreement_id = ag.id;
  if d.id is null or d.storage_path is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  insert into public.deal_document_access (document_id, agreement_id, actor_id, kind) values (d.id, ag.id, p_actor, 'party');
  return jsonb_build_object('status', 'ok', 'path', d.storage_path);
end;
$function$;

-- The OTHER side reviews a document. Their "approved" says they have read it,
-- not that Vallo has verified it, and the interface says which.
create or replace function public.sale_doc_review_as(p_actor uuid, p_agreement uuid, p_doc uuid, p_decision text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  d public.deal_documents%rowtype;
  n text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_decision not in ('under_review', 'approved', 'rejected', 'more_information') then
    return jsonb_build_object('status', 'bad_request');
  end if;
  if p_decision in ('rejected', 'more_information') and (n is null or length(n) < 5) then
    return jsonb_build_object('status', 'reason_required');
  end if;
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale';
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into d from public.deal_documents where id = p_doc and agreement_id = ag.id for update;
  if d.id is null or d.state = 'requested' then
    return jsonb_build_object('status', 'not_found');
  end if;
  if d.uploaded_by = p_actor then
    return jsonb_build_object('status', 'own_document');
  end if;
  update public.deal_documents
     set state = p_decision, reviewer_id = p_actor, reviewer_kind = 'party', reviewed_at = now(), note = n, updated_at = now()
   where id = d.id;
  perform private.agreement_log(ag, p_actor, 'document', ag.status, replace(d.category, '_', ' ') || ': ' || replace(p_decision, '_', ' ') || '.');
  perform private.sale_tell(ag, d.uploaded_by, 'offer.document', 'A document was reviewed',
    'On ' || ag.reference || ': ' || replace(d.category, '_', ' ') || ' is ' || replace(p_decision, '_', ' ') || '.');
  return jsonb_build_object('status', 'ok');
end;
$function$;

-- ----------------------------------------------------------------- the reads
create or replace function public.sale_offers_list_as(p_actor uuid, p_side text)
returns jsonb
language sql
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(x.r order by x.sort_at desc), '[]'::jsonb) from (
    select
      a.updated_at as sort_at,
      jsonb_build_object(
        'id', a.id, 'reference', a.reference, 'listing_id', a.listing_id, 'listing_title', l.title,
        'thumb', (select p.storage_path from public.listing_photos p where p.listing_id = l.id order by p.position limit 1),
        'asking_minor', coalesce((a.terms ->> 'asking_minor')::bigint, l.sale_price_minor),
        'amount_minor', a.amount_minor, 'status', a.status, 'stage', a.sale_stage, 'awaiting_side', a.awaiting_side,
        'viewer_side', case when a.renter_id = p_actor then 'buyer' else 'seller' end,
        'counterparty_name', private.sale_display_name(case when a.renter_id = p_actor then a.owner_id else a.renter_id end),
        'payment_preference', a.terms ->> 'payment_preference',
        'target_closing', a.terms ->> 'target_closing',
        'submitted_at', a.submitted_at, 'updated_at', a.updated_at, 'expires_at', a.expires_at,
        'version', a.terms_version, 'disputed', a.disputed_at is not null,
        'unread', exists (select 1 from public.deal_agreement_events e
                           where e.agreement_id = a.id and e.actor_id is distinct from p_actor
                             and e.created_at > coalesce((select r.last_seen_at from public.deal_reads r
                                                           where r.agreement_id = a.id and r.user_id = p_actor), '-infinity'::timestamptz))
      ) as r
    from public.deal_agreements a
    join public.listings l on l.id = a.listing_id
    where a.kind = 'sale'
      and ((p_side = 'made' and a.renter_id = p_actor) or (p_side = 'received' and a.owner_id = p_actor))
  ) x;
$function$;

create or replace function public.sale_offer_room_as(p_actor uuid, p_agreement uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  lst public.listings%rowtype;
  side text;
begin
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale';
  if ag.id is null or p_actor not in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  side := case when p_actor = ag.renter_id then 'buyer' else 'seller' end;
  perform private.sale_seen(ag, p_actor);
  select * into ag from public.deal_agreements where id = p_agreement;
  select * into lst from public.listings where id = ag.listing_id;
  return jsonb_build_object(
    'status', 'ok',
    'viewer_side', side,
    'offer', jsonb_build_object(
      'id', ag.id, 'reference', ag.reference, 'listing_id', lst.id, 'listing_title', lst.title,
      'thumb', (select p.storage_path from public.listing_photos p where p.listing_id = lst.id order by p.position limit 1),
      'listing_price_minor', lst.sale_price_minor, 'listing_status', lst.status, 'listing_sale_status', lst.sale_status,
      'asking_minor', coalesce((ag.terms ->> 'asking_minor')::bigint, lst.sale_price_minor),
      'amount_minor', ag.amount_minor, 'status', ag.status, 'stage', ag.sale_stage, 'awaiting_side', ag.awaiting_side,
      'counterparty_name', private.sale_display_name(case when side = 'buyer' then ag.owner_id else ag.renter_id end),
      'buyer_name', private.sale_display_name(ag.renter_id), 'seller_name', private.sale_display_name(ag.owner_id),
      'payment_preference', ag.terms ->> 'payment_preference', 'target_closing', ag.terms ->> 'target_closing',
      'submitted_at', ag.submitted_at, 'updated_at', ag.updated_at, 'expires_at', ag.expires_at,
      'version', ag.terms_version, 'agreed_version', ag.agreed_version, 'decided_at', ag.decided_at,
      'decision_reason', ag.decision_reason, 'disputed', ag.disputed_at is not null,
      'open_question', coalesce((select e.action = 'info_requested' from public.deal_agreement_events e
                                  where e.agreement_id = ag.id and e.action in ('info_requested', 'info_provided')
                                  order by e.created_at desc, e.id desc limit 1), false)),
    'versions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'version', v.terms_version, 'amount_minor', v.amount_minor, 'terms', v.terms, 'at', v.created_at,
        'proposed_by', v.terms ->> 'proposed_by',
        'buyer_confirmed', (v.terms ->> 'proposed_by') = 'buyer' or ag.agreed_version = v.terms_version,
        'seller_confirmed', (v.terms ->> 'proposed_by') = 'seller' or ag.agreed_version = v.terms_version)
        order by v.terms_version)
        from public.deal_agreement_versions v where v.agreement_id = ag.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'at', e.created_at, 'action', e.action, 'note', e.note, 'version', e.terms_version,
        'actor', case when e.actor_id is null then 'system' when e.actor_id = ag.renter_id then 'buyer' else 'seller' end,
        'actor_name', case when e.actor_id is null then null else private.sale_display_name(e.actor_id) end)
        order by e.created_at, e.id)
        from public.deal_agreement_events e where e.agreement_id = ag.id and e.action <> 'staff_view'), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'category', d.category, 'label', d.label, 'state', d.state, 'version', d.version,
        'uploaded_by_name', case when d.uploaded_by is null then null else private.sale_display_name(d.uploaded_by) end,
        'uploaded_at', d.uploaded_at, 'file_name', d.file_name,
        'uploaded_by_side', case when d.uploaded_by is null then null when d.uploaded_by = ag.renter_id then 'buyer' else 'seller' end,
        'reviewed_by_name', case when d.reviewer_id is null then null else private.sale_display_name(d.reviewer_id) end,
        'reviewer_kind', d.reviewer_kind, 'reviewed_at', d.reviewed_at, 'note', d.note,
        'is_mine', d.uploaded_by = p_actor) order by d.created_at)
        from public.deal_documents d where d.agreement_id = ag.id), '[]'::jsonb),
    'mandate', private.sale_mandate_line(ag.listing_id),
    'conversation_id', private.sale_conversation(ag.listing_id, ag.renter_id, ag.owner_id),
    'inspection_id', ag.inspection_id,
    -- The seller learns the OUTCOME. Never an id number, an image or a date of birth.
    'buyer_eligible', (private.sale_eligibility(ag.renter_id, ag.listing_id) ->> 'eligible')::boolean);
end;
$function$;

-- ------------------------------------------------------------------- admin
-- All admin doors check the existing staff scope 'agreements' (admin, super
-- admin, or a granted agreements officer who has read the handbook; the
-- console's second factor is enforced inside staff_can). None of them can
-- change an amount, a version or an agreed term.

create or replace function public.admin_sale_offers_list(p_state text default null, p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.staff_can(auth.uid(), 'agreements') then
    return jsonb_build_object('status', 'forbidden');
  end if;
  return jsonb_build_object('status', 'ok', 'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'reference', a.reference, 'listing_id', a.listing_id, 'listing_title', l.title,
      'buyer_name', private.sale_display_name(a.renter_id), 'seller_name', private.sale_display_name(a.owner_id),
      'asking_minor', coalesce((a.terms ->> 'asking_minor')::bigint, l.sale_price_minor),
      'amount_minor', a.amount_minor, 'status', a.status, 'stage', a.sale_stage, 'awaiting_side', a.awaiting_side,
      'payment_preference', a.terms ->> 'payment_preference', 'version', a.terms_version,
      'submitted_at', a.submitted_at, 'updated_at', a.updated_at, 'expires_at', a.expires_at,
      'disputed', a.disputed_at is not null, 'mandate_live', private.sale_live_mandate(a.listing_id) is not null)
      order by a.updated_at desc)
    from (select * from public.deal_agreements x where x.kind = 'sale'
            and (p_state is null or x.status::text = p_state or (p_state = 'disputed' and x.disputed_at is not null))
          order by x.updated_at desc limit greatest(1, least(coalesce(p_limit, 200), 500))) a
    join public.listings l on l.id = a.listing_id), '[]'::jsonb));
end;
$function$;

-- Real metrics, each with its definition on the screen. Never the value of
-- accepted offers as revenue: Vallo does not receive that money.
create or replace function public.admin_sale_offers_metrics()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  out jsonb;
begin
  if not private.staff_can(auth.uid(), 'agreements') then
    return jsonb_build_object('status', 'forbidden');
  end if;
  select jsonb_build_object(
    'status', 'ok',
    'submitted',   count(*),
    'new_7d',      count(*) filter (where a.created_at > now() - interval '7 days'),
    'awaiting_seller', count(*) filter (where a.status::text = 'awaiting_parties' and a.awaiting_side = 'seller'),
    'negotiating', count(*) filter (where a.status::text = 'awaiting_parties' and a.terms_version > 1),
    'agreed',      count(*) filter (where a.status::text = 'approved'),
    'declined',    count(*) filter (where a.status::text = 'rejected'),
    'withdrawn',   count(*) filter (where a.status::text = 'withdrawn'),
    'expired',     count(*) filter (where a.status::text = 'expired'),
    'completed',   count(*) filter (where a.sale_stage = 'completed'),
    'disputed',    count(*) filter (where a.disputed_at is not null),
    -- Acceptance rate: of offers the seller DECIDED (agreed or declined), the share agreed.
    'acceptance_rate', case when count(*) filter (where a.status::text in ('approved', 'rejected')) = 0 then null
      else round(100.0 * count(*) filter (where a.status::text = 'approved')
                 / count(*) filter (where a.status::text in ('approved', 'rejected')), 1) end,
    -- Median hours from an offer arriving to the seller's first recorded action.
    'median_response_hours', (
      select round((percentile_cont(0.5) within group (order by extract(epoch from (f.first_at - f.opened_at))) / 3600.0)::numeric, 1)
        from (select a2.created_at as opened_at,
                     (select min(e.created_at) from public.deal_agreement_events e
                       where e.agreement_id = a2.id and e.actor_id = a2.owner_id
                         and e.action in ('seen', 'countered', 'declined', 'approved', 'info_requested')) as first_at
                from public.deal_agreements a2 where a2.kind = 'sale') f
       where f.first_at is not null)
  ) into out from public.deal_agreements a where a.kind = 'sale';
  return out;
end;
$function$;

create or replace function public.admin_sale_offer_detail(p_agreement uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := auth.uid();
  ag public.deal_agreements%rowtype;
begin
  if not private.staff_can(actor, 'agreements') then
    return jsonb_build_object('status', 'forbidden');
  end if;
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale';
  if ag.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'sale_offer.staff_view', 'deal_agreement', ag.id::text, '{}'::jsonb);
  return jsonb_build_object(
    'status', 'ok',
    'offer', jsonb_build_object(
      'id', ag.id, 'reference', ag.reference, 'listing_id', ag.listing_id,
      'listing_title', (select l.title from public.listings l where l.id = ag.listing_id),
      'buyer_name', private.sale_display_name(ag.renter_id), 'seller_name', private.sale_display_name(ag.owner_id),
      'amount_minor', ag.amount_minor, 'status', ag.status, 'stage', ag.sale_stage, 'version', ag.terms_version,
      'asking_minor', coalesce((ag.terms ->> 'asking_minor')::bigint, 0),
      'payment_preference', ag.terms ->> 'payment_preference',
      'submitted_at', ag.submitted_at, 'updated_at', ag.updated_at,
      'agreed_version', ag.agreed_version, 'expires_at', ag.expires_at, 'disputed', ag.disputed_at is not null,
      'mandate', private.sale_mandate_line(ag.listing_id),
      'mandate_live', private.sale_live_mandate(ag.listing_id) is not null),
    'buyer_eligible', (private.sale_eligibility(ag.renter_id, ag.listing_id) ->> 'eligible')::boolean,
    'versions', coalesce((select jsonb_agg(jsonb_build_object('version', v.terms_version, 'amount_minor', v.amount_minor,
      'terms', v.terms, 'at', v.created_at) order by v.terms_version)
      from public.deal_agreement_versions v where v.agreement_id = ag.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('at', e.created_at, 'action', e.action, 'note', e.note,
      'version', e.terms_version, 'actor', case when e.actor_id is null then 'system' else private.sale_display_name(e.actor_id) end)
      order by e.created_at, e.id) from public.deal_agreement_events e where e.agreement_id = ag.id), '[]'::jsonb),
    -- Metadata only. A file is opened through admin_sale_doc_access, with a reason.
    'documents', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'category', d.category, 'state', d.state,
      'version', d.version, 'uploaded_at', d.uploaded_at) order by d.created_at)
      from public.deal_documents d where d.agreement_id = ag.id), '[]'::jsonb));
end;
$function$;

-- Intervention that cannot rewrite agreed terms: cancel a deal, add a note,
-- open or close a dispute. A reason of 10 characters or more, always.
create or replace function public.admin_sale_offer_intervene(p_agreement uuid, p_action text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := auth.uid();
  ag public.deal_agreements%rowtype;
  before_status public.agreement_status;
  n text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not private.staff_can(actor, 'agreements') then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_action not in ('cancel', 'note', 'flag_dispute', 'resolve_dispute') then
    return jsonb_build_object('status', 'bad_request');
  end if;
  if n is null or length(n) < 10 or length(n) > 1000 then
    return jsonb_build_object('status', 'reason_required');
  end if;
  select * into ag from public.deal_agreements where id = p_agreement and kind = 'sale' for update;
  if ag.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if actor in (ag.renter_id, ag.owner_id) then
    return jsonb_build_object('status', 'own_agreement');
  end if;
  before_status := ag.status;
  if p_action = 'cancel' then
    if ag.status::text not in ('awaiting_parties', 'approved') then
      return jsonb_build_object('status', 'locked');
    end if;
    update public.deal_agreements set status = 'cancelled', awaiting_side = null, decided_by = actor, decided_at = now(),
           decision_reason = n, updated_at = now() where id = ag.id returning * into ag;
  elsif p_action = 'flag_dispute' then
    update public.deal_agreements set disputed_at = coalesce(disputed_at, now()), updated_at = now() where id = ag.id returning * into ag;
  elsif p_action = 'resolve_dispute' then
    update public.deal_agreements set disputed_at = null, updated_at = now() where id = ag.id returning * into ag;
  end if;
  perform private.agreement_log(ag, actor, case p_action when 'cancel' then 'cancelled'
                                                          when 'resolve_dispute' then 'dispute_resolved'
                                                          when 'flag_dispute' then 'disputed' else 'intervened' end, before_status, n);
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'sale_offer.' || p_action, 'deal_agreement', ag.id::text, jsonb_build_object('note', n));
  if p_action = 'cancel' then
    perform private.sale_tell(ag, ag.renter_id, 'offer.cancelled', 'A deal was cancelled', 'Vallo cancelled ' || ag.reference || ': ' || n);
    perform private.sale_tell(ag, ag.owner_id, 'offer.cancelled', 'A deal was cancelled', 'Vallo cancelled ' || ag.reference || ': ' || n);
  end if;
  return jsonb_build_object('status', 'ok');
end;
$function$;

-- A staff member opens a deal document: a reason in writing, and it is logged.
create or replace function public.admin_sale_doc_access(p_document uuid, p_justification text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := auth.uid();
  d public.deal_documents%rowtype;
  j text := nullif(btrim(coalesce(p_justification, '')), '');
begin
  if not private.staff_can(actor, 'agreements') then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if j is null or length(j) < 20 then
    return jsonb_build_object('status', 'reason_required');
  end if;
  select * into d from public.deal_documents where id = p_document;
  if d.id is null or d.storage_path is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  insert into public.deal_document_access (document_id, agreement_id, actor_id, kind, justification)
  values (d.id, d.agreement_id, actor, 'staff', j);
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'sale_offer.document_opened', 'deal_document', d.id::text, jsonb_build_object('justification', j));
  return jsonb_build_object('status', 'ok', 'path', d.storage_path);
end;
$function$;

revoke all on function public.sale_doc_prepare_as(uuid, uuid, uuid, text, text), public.sale_doc_request_as(uuid, uuid, text, text),
  public.sale_doc_register_as(uuid, uuid, uuid, text, text, text, bigint), public.sale_doc_access_as(uuid, uuid, uuid),
  public.sale_doc_review_as(uuid, uuid, uuid, text, text), public.sale_offers_list_as(uuid, text),
  public.sale_offer_room_as(uuid, uuid) from public, anon, authenticated;
grant execute on function public.sale_doc_prepare_as(uuid, uuid, uuid, text, text), public.sale_doc_request_as(uuid, uuid, text, text),
  public.sale_doc_register_as(uuid, uuid, uuid, text, text, text, bigint), public.sale_doc_access_as(uuid, uuid, uuid),
  public.sale_doc_review_as(uuid, uuid, uuid, text, text), public.sale_offers_list_as(uuid, text),
  public.sale_offer_room_as(uuid, uuid) to service_role;

-- Staff doors take their identity from the session, like admin_decide_agreement.
revoke all on function public.admin_sale_offers_list(text, integer), public.admin_sale_offers_metrics(),
  public.admin_sale_offer_detail(uuid), public.admin_sale_offer_intervene(uuid, text, text),
  public.admin_sale_doc_access(uuid, text) from public, anon;
grant execute on function public.admin_sale_offers_list(text, integer), public.admin_sale_offers_metrics(),
  public.admin_sale_offer_detail(uuid), public.admin_sale_offer_intervene(uuid, text, text),
  public.admin_sale_doc_access(uuid, text) to authenticated, service_role;
