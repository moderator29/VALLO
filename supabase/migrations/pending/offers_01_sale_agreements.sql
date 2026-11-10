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
                 where d.uploader_id = p_user and d.kind = 'identity' and d.review_status::text = 'approved') then
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
