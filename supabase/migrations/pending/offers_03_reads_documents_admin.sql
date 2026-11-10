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
    -- The eight-item report a buyer's inspection produced: ticks and notes and a photo COUNT, never a file path.
    'inspection_report', (select jsonb_build_object(
        'submitted_at', r.submitted_at,
        'items', coalesce((select jsonb_agg(jsonb_build_object('item', i.item, 'checked', i.checked, 'note', i.note) order by i.item)
                             from public.inspection_report_items i where i.inspection_id = r.inspection_id), '[]'::jsonb),
        'photo_count', (select count(*) from public.inspection_report_photos p where p.inspection_id = r.inspection_id))
      from public.inspection_reports r where r.inspection_id = ag.inspection_id and r.submitted_at is not null),
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
