-- VALLO: THE SECOND END-OF-BATCH SQL BLOCK (10 November 2026)
--
-- Paste ALL of this into the Supabase SQL Editor (project uccixoonmbhrnyczyigt)
-- and press Run once. It runs as ONE transaction: if any line fails, nothing
-- at all is changed, and you send the error back.
--
-- This is everything written and ready to run since the first block
-- (END_OF_BATCH_2026-11-10.sql, which you already ran). It does not repeat
-- anything from that file.
--
-- What it does, in order:
--   1. The protected payment rail's remaining server steps (switched off).
--   2. One read-only function the member's protected-payment screens use.
--   3. The database behind "Was this helpful?" on the help, guides and docs
--      pages.
--
-- Nothing here turns any payment on, moves money, publishes anything, or
-- touches a member's existing data. Every line was read by the lead against
-- the live schema it refers to. It has NOT yet been dry-run as one block
-- against live: three attempts timed out waiting on a Supabase connection
-- approval that needs a tap in the app. Each PIECE was reviewed on its own
-- terms below; if you would rather the lead confirm the whole block first,
-- say so and approve the next connection prompt when it appears.
--
-- NOT in this block, on purpose, each needing its own explicit yes from you:
--   - newsletter_default_on_2026-11-launch.sql: turns marketing emails back
--     on for 17 members whose row shows the old default they never chose
--     (one of your earlier ruling, 4 Nov). This CHANGES member data, so it
--     is not bundled into a "safe additive" block. Send a plain yes and the
--     lead will send it to you on its own.
--   - rt01_remove_retired_objects.sql: DROPS database objects. Never bundled
--     with anything else; needs your explicit yes on its own words, always.
--   - Two desks are still being built (Business Development and Social
--     Media); their own SQL will come in a later block once the lead has
--     reviewed each one.
--
-- The last statement prints a short check. Send that result back.

begin;
set local lock_timeout = '5s';

-- ==================================================================== PART 1 of 3
-- protected_rail_server_2026-11-10.sql
-- The protected rail's remaining server steps: the category map, lifecycle stamps, the payer's transfer mark, what Vallo may record itself, the provider-aware open, the named payer, and the lapsed-funding list. Switched off; changes no live row (provider_arrangements is empty).

-- PROTECTED PAYMENT RAIL, THE SERVER STEPS (audit section 10.6 items 9, 10
-- and 11; 10 November 2026). Built switched off: every door below refuses
-- while payments_escrowpay_on is off (fail closed) or the deal's category is
-- not approved, and today every category is disabled. No live row changes:
-- provider_arrangements is empty and no agreement names a payer.
--
-- NOT APPLIED. Run after END_OF_BATCH_2026-11-10.sql (applied 10 Nov), which
-- added the lifecycle columns this file stamps. One transaction; safe twice.
--
--   1. private.protected_category_for_agreement: a deal onto its category.
--   2. Lifecycle stamps and the payer's "I've made the transfer" mark,
--      written by a trigger from the recorded state, never by the browser.
--   3. provider_arrangement_observe: Vallo may also record that it ASKED for
--      a refund, that a payment needs a person (requires_review), or that a
--      member opened Vallo's own dispute (disputed; nothing moves). Funded,
--      released and refunded stay the provider's alone to report.
--   4. public.protected_payment_open: the provider-aware open (no Payluk
--      customer records), service role only.
--   5. The named payer (BUILD 6.3): somebody in Nigeria may pay a rental for
--      the tenant, recorded on the agreement with both of them consenting.
--   6. private.protected_funding_lapsed: the unfunded arrangements whose
--      genuine provider expiry has passed, for the reconcile to read back.
--      It changes nothing itself (spec: never silently reuse an expired
--      instruction, and only the provider says an arrangement is cancelled).
--
-- No object name carries a custody word (private.refuse_custody_objects).

set local lock_timeout = '5s';

-- 1 ---------------------------------------------------------------------
create or replace function private.protected_category_for_agreement(p_agreement uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when a.id is null then 'other'
    when l.listing_intent = 'sale' then case when l.property_type = 'land' then 'land_sale' else 'property_sale' end
    when a.kind = 'stay' and a.accommodation_id is not null then 'hotel_booking'
    when a.kind = 'stay' then 'shortlet'
    when a.kind = 'rent' and l.property_type in ('shop', 'office') then 'commercial_rent'
    when a.kind = 'rent' then 'residential_rent'
    else 'other'
  end
  from (select p_agreement as id) k
  left join public.deal_agreements a on a.id = k.id
  left join public.listings l on l.id = a.listing_id;
$function$;

revoke all on function private.protected_category_for_agreement(uuid) from public, anon, authenticated;

-- 2 ---------------------------------------------------------------------
alter table public.provider_arrangements add column if not exists transfer_reported_at timestamptz;

create or replace function private.provider_arrangements_stamp()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.status is distinct from old.status then
    case new.status
      when 'protected' then new.funded_at := coalesce(new.funded_at, now());
      when 'release_requested' then new.release_requested_at := coalesce(new.release_requested_at, now());
      when 'released' then new.release_confirmed_at := coalesce(new.release_confirmed_at, now());
      when 'refund_requested' then new.refund_requested_at := coalesce(new.refund_requested_at, now());
      when 'refunded' then new.refund_confirmed_at := coalesce(new.refund_confirmed_at, now());
      else null;
    end case;
  end if;
  if new.status_observed_at is distinct from old.status_observed_at then
    if new.status_source = 'provider_webhook' then new.last_webhook_at := now(); end if;
    if new.status_source = 'provider_readback' then new.last_reconcile_at := now(); end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists provider_arrangements_10_stamp on public.provider_arrangements;
create trigger provider_arrangements_10_stamp
  before update on public.provider_arrangements
  for each row execute function private.provider_arrangements_stamp();

/* The payer says they transferred: a request to look again, nothing more.
   It never moves the status (spec screen 3). Service role, the payer's own
   arrangement only, and only while it waits for money. */
create or replace function public.protected_payment_transfer_reported(p_arrangement uuid, p_payer uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  a public.provider_arrangements%rowtype;
begin
  select * into a from public.provider_arrangements where id = p_arrangement for update;
  if a.id is null or a.buyer_user_id is distinct from p_payer then return 'not_found'; end if;
  if a.provider <> 'escrowpay' then return 'not_found'; end if;
  if a.status <> 'awaiting_payment' then return 'not_waiting'; end if;
  update public.provider_arrangements set transfer_reported_at = coalesce(transfer_reported_at, now()) where id = a.id;
  insert into public.provider_arrangement_events (arrangement_id, from_status, to_status, source, detail)
  values (a.id, a.status, a.status, 'vallo', jsonb_build_object('payer_reported_transfer', true));
  return 'ok';
end;
$function$;

revoke all on function public.protected_payment_transfer_reported(uuid, uuid) from public, anon, authenticated;
grant execute on function public.protected_payment_transfer_reported(uuid, uuid) to service_role;

-- 3 ---------------------------------------------------------------------
-- The live function, unchanged except the one line naming what Vallo itself
-- may record: it ASKED (a payment, a release, a refund), it got no answer
-- (unknown), or a person must look (requires_review).
CREATE OR REPLACE FUNCTION public.provider_arrangement_observe(p_arrangement uuid, p_to_status text, p_source text, p_provider_state text DEFAULT NULL::text, p_provider_status text DEFAULT NULL::text, p_provider_arrangement_id text DEFAULT NULL::text, p_provider_payment_token text DEFAULT NULL::text, p_provider_amount_minor bigint DEFAULT NULL::bigint, p_provider_fee_minor bigint DEFAULT NULL::bigint, p_milestones jsonb DEFAULT NULL::jsonb, p_provider_event_key text DEFAULT NULL::text, p_detail jsonb DEFAULT '{}'::jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.provider_arrangements%rowtype;
  m jsonb;
  ms text;
  verdict text;
begin
  select * into a from public.provider_arrangements where id = p_arrangement for update;
  if not found then return 'not_found'; end if;

  -- A provider id that is not this record's is a contradiction a person reads.
  if p_provider_arrangement_id is not null and a.provider_arrangement_id is not null
     and p_provider_arrangement_id <> a.provider_arrangement_id then
    insert into public.provider_arrangement_events (arrangement_id, from_status, to_status, source, provider_state,
                                                    provider_status, provider_event_key, refused, detail)
    values (a.id, a.status, a.status, p_source, p_provider_state, p_provider_status, p_provider_event_key, true,
            coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('refused', 'id_mismatch', 'reported_id', p_provider_arrangement_id));
    return 'id_mismatch';
  end if;
  -- The provider's amount (naira converted to kobo at the boundary) must be the record's.
  if p_provider_amount_minor is not null and p_provider_amount_minor <> a.amount_minor then
    insert into public.provider_arrangement_events (arrangement_id, from_status, to_status, source, provider_state,
                                                    provider_status, provider_event_key, refused, detail)
    values (a.id, a.status, a.status, p_source, p_provider_state, p_provider_status, p_provider_event_key, true,
            coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('refused', 'amount_mismatch',
                                                                  'reported_amount_minor', p_provider_amount_minor));
    return 'amount_mismatch';
  end if;
  -- Vallo itself may only say it asked (a payment, a release, a refund), that
  -- it got no answer (unknown), that a person must look (requires_review), or
  -- that a member opened Vallo's own dispute process (disputed: the money
  -- stays where it is, nothing moves). Funded, released and refunded are the
  -- provider's alone to report.
  if p_source = 'vallo' and p_to_status not in ('payment_processing', 'release_requested', 'refund_requested',
                                                 'requires_review', 'disputed', 'unknown') then
    return 'refused';
  end if;

  if a.status = p_to_status then
    verdict := 'same';
  elsif private.provider_arrangement_step_ok(a.status, p_to_status) then
    verdict := 'changed';
  else
    insert into public.provider_arrangement_events (arrangement_id, from_status, to_status, source, provider_state,
                                                    provider_status, provider_event_key, refused, detail)
    values (a.id, a.status, a.status, p_source, p_provider_state, p_provider_status, p_provider_event_key, true,
            coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('refused_transition_to', p_to_status));
    return 'refused';
  end if;

  update public.provider_arrangements set
    status = p_to_status,
    status_source = case when verdict = 'changed' then p_source else status_source end,
    status_observed_at = now(),
    provider_state = coalesce(p_provider_state, provider_state),
    provider_status = coalesce(p_provider_status, provider_status),
    provider_arrangement_id = coalesce(provider_arrangement_id, p_provider_arrangement_id),
    provider_payment_token = coalesce(provider_payment_token, p_provider_payment_token),
    provider_fee_minor = coalesce(p_provider_fee_minor, provider_fee_minor)
  where id = a.id;

  if p_milestones is not null and jsonb_typeof(p_milestones) = 'array' then
    for m in select value from jsonb_array_elements(p_milestones) loop
      ms := lower(coalesce(m ->> 'status', ''));
      update public.provider_arrangement_milestones pm set
        provider_milestone_id = coalesce(pm.provider_milestone_id, m ->> 'provider_milestone_id'),
        provider_status = coalesce(m ->> 'status', pm.provider_status),
        -- Only forward: a released milestone is never pending again.
        status = case when ms in ('released', 'refunded', 'split') and pm.status in ('pending', 'release_requested') then ms
                      else pm.status end,
        released_at = case when ms = 'released' then coalesce(pm.released_at, (m ->> 'released_at')::timestamptz, now())
                           else pm.released_at end
      where pm.arrangement_id = a.id
        and (pm.provider_milestone_id = m ->> 'provider_milestone_id'
             or (pm.provider_milestone_id is null and pm.position = (m ->> 'position')::int));
    end loop;
  end if;

  if verdict = 'changed' then
    insert into public.provider_arrangement_events (arrangement_id, from_status, to_status, source, provider_state,
                                                    provider_status, provider_event_key, detail)
    values (a.id, a.status, p_to_status, p_source, p_provider_state, p_provider_status, p_provider_event_key,
            coalesce(p_detail, '{}'::jsonb));
  end if;
  return verdict;
end $function$;

-- 5 (before 4, which reads it) ------------------------------------------
alter table public.deal_agreements
  add column if not exists named_payer_id uuid references auth.users (id) on delete restrict,
  add column if not exists named_payer_by_renter_at timestamptz,
  add column if not exists named_payer_accepted_at timestamptz;

alter table public.deal_agreements drop constraint if exists deal_agreements_named_payer_check;
alter table public.deal_agreements
  add constraint deal_agreements_named_payer_check
  check (named_payer_id is null or (named_payer_id <> renter_id and named_payer_id <> owner_id));

/* The tenant names a payer (or clears one). The payer's own consent is
   cleared whenever the name changes, so it is always consent to THIS deal. */
create or replace function public.agreement_name_payer(p_agreement uuid, p_payer uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
begin
  select * into ag from public.deal_agreements where id = p_agreement for update;
  if ag.id is null or ag.renter_id is distinct from auth.uid() then return 'not_found'; end if;
  if ag.kind <> 'rent' then return 'rent_only'; end if;
  if ag.paid_at is not null or exists (select 1 from public.provider_arrangements pa
                                        where pa.agreement_id = ag.id and pa.status not in ('failed', 'cancelled')) then
    return 'payment_started';
  end if;
  if p_payer is not null and (p_payer = ag.renter_id or p_payer = ag.owner_id) then return 'bad_payer'; end if;
  if p_payer is not null and not exists (select 1 from auth.users u where u.id = p_payer) then return 'bad_payer'; end if;
  update public.deal_agreements
     set named_payer_id = p_payer,
         named_payer_by_renter_at = case when p_payer is null then null else now() end,
         named_payer_accepted_at = null
   where id = ag.id;
  return 'ok';
end;
$function$;

revoke all on function public.agreement_name_payer(uuid, uuid) from public, anon;
grant execute on function public.agreement_name_payer(uuid, uuid) to authenticated;

/* The named payer accepts, as themselves. */
create or replace function public.agreement_accept_payer(p_agreement uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
begin
  select * into ag from public.deal_agreements where id = p_agreement for update;
  if ag.id is null or ag.named_payer_id is distinct from auth.uid() then return 'not_found'; end if;
  if ag.named_payer_by_renter_at is null then return 'not_named'; end if;
  update public.deal_agreements set named_payer_accepted_at = coalesce(named_payer_accepted_at, now()) where id = ag.id;
  return 'ok';
end;
$function$;

revoke all on function public.agreement_accept_payer(uuid) from public, anon;
grant execute on function public.agreement_accept_payer(uuid) to authenticated;

-- 4 ---------------------------------------------------------------------
create or replace function public.protected_payment_open(p_agreement uuid, p_accepted_version integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ag public.deal_agreements%rowtype;
  live public.provider_arrangements%rowtype;
  arr public.provider_arrangements%rowtype;
  v_category text;
  v_payer uuid;
begin
  if not coalesce((select f.enabled from public.feature_flags f where f.key = 'payments_escrowpay_on'), false) then
    return jsonb_build_object('status', 'switched_off');
  end if;
  select * into ag from public.deal_agreements where id = p_agreement for update;
  if ag.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if ag.status <> 'approved' or ag.kind not in ('rent', 'stay') then
    return jsonb_build_object('status', 'not_payable', 'kind', ag.kind, 'agreement_status', ag.status);
  end if;
  -- The payer accepted THIS version of the agreement (spec screen 2).
  if p_accepted_version is distinct from ag.terms_version then
    return jsonb_build_object('status', 'agreement_changed', 'terms_version', ag.terms_version);
  end if;
  v_category := private.protected_category_for_agreement(ag.id);
  -- A sale is never paid on Vallo, at any stage (founder rule (c), 9 Nov 2026).
  if v_category in ('property_sale', 'land_sale', 'other') then
    return jsonb_build_object('status', 'not_offered', 'category', v_category);
  end if;
  if private.protected_category_status(v_category) <> 'approved' then
    return jsonb_build_object('status', 'category_not_approved', 'category', v_category);
  end if;
  if private.rail_for_agreement(ag.id) is distinct from 'escrow' then
    return jsonb_build_object('status', 'not_escrow');
  end if;
  if exists (select 1 from public.transactions t
              where t.status in ('PENDING', 'SUCCESSFUL')
                and (t.agreement_id = ag.id or (ag.booking_id is not null and t.booking_id = ag.booking_id))) then
    return jsonb_build_object('status', 'card_payment_started');
  end if;
  select * into live from public.provider_arrangements
   where agreement_id = ag.id and status not in ('failed', 'cancelled');
  if live.id is not null then
    return jsonb_build_object('status', 'exists', 'id', live.id, 'reference', live.reference,
                              'arrangement_status', live.status);
  end if;
  -- The fee table's top band (lib/money/protected-fees.ts): above it no fee
  -- can be quoted, so nothing opens.
  if ag.amount_minor <= 0 or ag.amount_minor > 5000000000 then
    return jsonb_build_object('status', 'amount_out_of_range');
  end if;
  -- A named payer pays only once both the tenant and the payer consented.
  v_payer := case when ag.named_payer_id is not null and ag.named_payer_by_renter_at is not null
                       and ag.named_payer_accepted_at is not null then ag.named_payer_id
                  else ag.renter_id end;

  insert into public.provider_arrangements (agreement_id, provider, kind, reference, amount_minor,
                                            buyer_user_id, seller_user_id, category, accepted_agreement_version)
  values (ag.id, 'escrowpay', 'standard', 'vallo-pp-' || replace(gen_random_uuid()::text, '-', ''), ag.amount_minor,
          v_payer, ag.owner_id, v_category, p_accepted_version)
  returning * into arr;
  insert into public.provider_arrangement_events (arrangement_id, from_status, to_status, source, detail)
  values (arr.id, null, 'preparing', 'vallo',
          jsonb_build_object('agreement_id', ag.id, 'provider', 'escrowpay', 'category', v_category,
                             'accepted_version', p_accepted_version, 'amount_minor', ag.amount_minor,
                             'named_payer', v_payer <> ag.renter_id));
  return jsonb_build_object('status', 'ok', 'id', arr.id, 'reference', arr.reference, 'amount_minor', arr.amount_minor,
                            'category', v_category);
end;
$function$;

revoke all on function public.protected_payment_open(uuid, integer) from public, anon, authenticated;
grant execute on function public.protected_payment_open(uuid, integer) to service_role;

-- 6 ---------------------------------------------------------------------
create or replace function private.protected_funding_lapsed(p_limit integer default 20)
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select a.id
    from public.provider_arrangements a
   where a.provider = 'escrowpay'
     and a.status = 'awaiting_payment'
     and a.funding_expires_at is not null
     and a.funding_expires_at < now()
   order by a.funding_expires_at
   limit greatest(1, least(p_limit, 100));
$function$;

revoke all on function private.protected_funding_lapsed(integer) from public, anon, authenticated;

-- Self-checks.
do $check$
begin
  if private.protected_category_for_agreement(gen_random_uuid()) <> 'other' then
    raise exception 'protected_rail_server: an unknown agreement must map to other';
  end if;
  if (public.protected_payment_open(gen_random_uuid(), 1) ->> 'status') <> 'switched_off'
     and coalesce((select enabled from public.feature_flags where key = 'payments_escrowpay_on'), false) = false then
    raise exception 'protected_rail_server: the open must refuse while the switch is off';
  end if;
end
$check$;

-- ==================================================================== PART 2 of 3
-- protected_category_read_2026-11-10.sql
-- One read-only function the member's own screens use to ask which category a deal is in. Depends on part 1.

-- PROTECTED PAYMENT SCREENS, THE CATEGORY READ (10 November 2026).
--
-- NOT APPLIED. Run AFTER protected_rail_server_2026-11-10.sql, which adds
-- private.protected_category_for_agreement (this calls it), and after
-- END_OF_BATCH_2026-11-10.sql (applied), which added
-- private.protected_category_status. Additive: one read-only function.
-- Safe to run twice. Changes no row.
--
-- Why: the member's screens (apps/web/src/lib/money/protected-read.ts) read
-- under the member's own session, and the private schema is closed to them.
-- This answers one question for one agreement the caller is a party to:
-- which category the database puts the deal in, and that category's status.
-- A party is the renter, the owner, or the named payer (named_payer_id,
-- added by protected_rail_server_2026-11-10.sql).
-- Anyone else, and any agreement it cannot find, is told 'disabled'. It never
-- says more than the two words, and the code treats a missing function, an
-- error or any word but 'approved' as disabled, so the screens stay dark
-- until this is applied AND a category is approved in writing.
--
-- No object name carries a custody word (private.refuse_custody_objects).

set local lock_timeout = '5s';

create or replace function public.protected_category_status_for_agreement(p_agreement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_party boolean;
  v_category text;
begin
  select exists (
    select 1 from public.deal_agreements a
     where a.id = p_agreement
       and (select auth.uid()) is not null
       and (select auth.uid()) in (a.renter_id, a.owner_id, a.named_payer_id)
  ) into v_party;
  if not coalesce(v_party, false) then
    return jsonb_build_object('category', 'other', 'status', 'disabled');
  end if;
  v_category := private.protected_category_for_agreement(p_agreement);
  return jsonb_build_object(
    'category', v_category,
    'status', coalesce(private.protected_category_status(v_category), 'disabled'));
end;
$function$;

revoke all on function public.protected_category_status_for_agreement(uuid) from public, anon;
grant execute on function public.protected_category_status_for_agreement(uuid) to authenticated;

-- Self-check: a stranger (no session here) is told disabled.
do $check$
begin
  if (public.protected_category_status_for_agreement(gen_random_uuid()) ->> 'status') <> 'disabled' then
    raise exception 'protected_category_read: a stranger was not told disabled';
  end if;
end
$check$;

-- ==================================================================== PART 3 of 3
-- docs_page_feedback_2026-11-10.sql
-- The 'Was this helpful?' control on the help, guides and docs pages: one table, one write function (rate-limited by the app), a staff summary. The control stays hidden on every page until this is applied.

-- NOT APPLIED. Written 10 November 2026 (DOCS_AND_PRESENCE_UPGRADE.md 4.6,
-- "a was this helpful that writes to the support desk").
--
-- WHY A NEW TABLE. The support desk's only write path is support_tickets,
-- which needs a name and an email and files a ticket a person must answer: a
-- "No" on a help answer is not a ticket, and filing one per tap would bury
-- the real queue. So the answer goes to its own small table, and the desk
-- reads a summary of it per page.
--
-- WHAT IT ADDS, additive and idempotent, nothing removed:
--   public.doc_feedback               one row per answer: the page (a path
--                                     under /help, /guides or /docs, with an
--                                     optional #section), yes or no, an
--                                     optional note of at most 500 characters,
--                                     the member when signed in (null for a
--                                     visitor), when. RLS on, no direct grant
--                                     to anon or authenticated.
--   public.submit_doc_feedback(...)   the one write, for anon and members:
--                                     checks the page shape and the note,
--                                     stamps auth.uid(). The app rate-limits
--                                     it before calling (bucket doc_feedback).
--   public.doc_feedback_ready()       answers true. The app draws the control
--                                     only once this function exists, so the
--                                     control stays hidden until this file is
--                                     applied.
--   public.staff_doc_feedback_summary(p_days)
--                                     for staff only (private.is_staff()):
--                                     per page, the yes and no counts in the
--                                     window and the latest notes, so the desk
--                                     can see which pages are failing. No
--                                     admin screen reads it yet.
--
-- Check after applying: select public.doc_feedback_ready(); returns true;
-- as anon, select public.submit_doc_feedback('/help#refunds', false, 'test')
-- returns true and a row exists; select * from public.doc_feedback as anon
-- returns nothing (no grant).
set lock_timeout = '5s';

create table if not exists public.doc_feedback (
  id uuid primary key default gen_random_uuid(),
  page text not null check (length(page) <= 200 and page ~ '^/(help|guides|docs)(/[a-z0-9-]+)?(#[a-z0-9-]+)?$'),
  helpful boolean not null,
  note text check (note is null or length(btrim(note)) between 1 and 500),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists doc_feedback_page_created on public.doc_feedback (page, created_at desc);
alter table public.doc_feedback enable row level security;
revoke all on table public.doc_feedback from public, anon, authenticated;
grant select, insert on table public.doc_feedback to service_role;

create or replace function public.submit_doc_feedback(p_page text, p_helpful boolean, p_note text default null)
returns boolean language plpgsql volatile security definer set search_path to '' as $fn$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_page is null or p_helpful is null then return false; end if;
  if length(p_page) > 200 or p_page !~ '^/(help|guides|docs)(/[a-z0-9-]+)?(#[a-z0-9-]+)?$' then return false; end if;
  if v_note is not null and length(v_note) > 500 then v_note := left(v_note, 500); end if;
  insert into public.doc_feedback (page, helpful, note, user_id)
  values (p_page, p_helpful, v_note, (select auth.uid()));
  return true;
end;
$fn$;
revoke all on function public.submit_doc_feedback(text, boolean, text) from public, anon, authenticated;
grant execute on function public.submit_doc_feedback(text, boolean, text) to anon, authenticated;

create or replace function public.doc_feedback_ready()
returns boolean language sql immutable set search_path to '' as $fn$ select true $fn$;
revoke all on function public.doc_feedback_ready() from public, anon, authenticated;
grant execute on function public.doc_feedback_ready() to anon, authenticated;

create or replace function public.staff_doc_feedback_summary(p_days integer default 30)
returns table (page text, helpful bigint, not_helpful bigint, latest_notes text[], last_at timestamptz)
language plpgsql stable security definer set search_path to '' as $fn$
begin
  if not private.is_staff() then
    raise exception 'staff only' using errcode = 'insufficient_privilege';
  end if;
  return query
    select f.page,
           count(*) filter (where f.helpful),
           count(*) filter (where not f.helpful),
           (array_agg(f.note order by f.created_at desc) filter (where f.note is not null))[1:5],
           max(f.created_at)
      from public.doc_feedback f
     where f.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
     group by f.page
     order by count(*) filter (where not f.helpful) desc, max(f.created_at) desc;
end;
$fn$;
revoke all on function public.staff_doc_feedback_summary(integer) from public, anon, authenticated;
grant execute on function public.staff_doc_feedback_summary(integer) to authenticated;

-- ==================================================================== CHECK
select
  public.doc_feedback_ready() as doc_feedback_ready,
  (select enabled from public.feature_flags where key = 'payments_escrowpay_on') as escrowpay_switch_still_off,
  (select count(*) from information_schema.routines where routine_schema = 'public' and routine_name = 'protected_payment_open') as protected_open_exists,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'deal_agreements' and column_name = 'named_payer_id') as named_payer_column_exists;

commit;
