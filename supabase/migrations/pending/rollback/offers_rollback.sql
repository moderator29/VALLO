-- ROLLBACK for offers_01/02/03 (10 November 2026). Safe only while no sale
-- offers exist, or after the founder has accepted losing them. The two enum
-- values 'withdrawn' and 'expired' CANNOT be removed from agreement_status
-- (Postgres has no DROP VALUE); they are harmless and stay.
drop function if exists public.admin_sale_doc_access(uuid, text), public.admin_sale_offer_intervene(uuid, text, text),
  public.admin_sale_offer_detail(uuid), public.admin_sale_offers_metrics(), public.admin_sale_offers_list(text, integer),
  public.sale_offer_room_as(uuid, uuid), public.sale_offers_list_as(uuid, text), public.sale_doc_review_as(uuid, uuid, uuid, text, text),
  public.sale_doc_access_as(uuid, uuid, uuid), public.sale_doc_register_as(uuid, uuid, uuid, text, text, text, bigint),
  public.sale_doc_request_as(uuid, uuid, text, text), public.sale_doc_prepare_as(uuid, uuid, uuid, text, text),
  public.sale_offers_remind_due(), public.sale_offers_expire_due(), public.sale_offer_dispute_as(uuid, uuid, text, text),
  public.sale_offer_link_inspection_as(uuid, uuid, uuid), public.sale_offer_stage_as(uuid, uuid, text),
  public.sale_offer_info_as(uuid, uuid, text, boolean), public.sale_offer_withdraw_as(uuid, uuid),
  public.sale_offer_decline_as(uuid, uuid, text), public.sale_offer_accept_as(uuid, uuid, integer, text),
  public.sale_offer_counter_as(uuid, uuid, integer, bigint, text, bigint, integer, date, text, text),
  public.sale_offer_submit_as(uuid, uuid, bigint, text, bigint, integer, date, text, text), public.sale_offer_gate_as(uuid, uuid);
drop function if exists private.sale_seen(public.deal_agreements, uuid), private.sale_terms_problem(bigint, text, bigint, integer, date, text),
  private.sale_tell(public.deal_agreements, uuid, text, text, text), private.sale_naira(bigint), private.sale_post(uuid, uuid, text),
  private.sale_conversation(uuid, uuid, uuid), private.sale_reference(), private.sale_display_name(uuid),
  private.sale_eligibility(uuid, uuid), private.sale_requirement_on(uuid, text), private.sale_mandate_line(uuid),
  private.sale_mandate_ok(uuid), private.sale_live_mandate(uuid), private.sale_seller_of(uuid);
drop trigger if exists transactions_no_sale_money on public.transactions;
drop trigger if exists deal_agreements_sale_terms_fixed on public.deal_agreements;
drop function if exists private.sale_agreements_take_no_money(), private.sale_agreed_terms_are_fixed();
drop table if exists public.deal_document_access, public.deal_documents, public.deal_reads, public.offer_requirements, public.offer_policy;
-- The private bucket 'deal-documents' is left in place on purpose: Supabase refuses a direct
-- DELETE on storage tables (use the Storage page to remove it by hand if you ever want to).
-- Only when no sale rows remain:
delete from public.deal_agreements where kind = 'sale';
alter table public.deal_agreements drop constraint if exists deal_agreements_sale_takes_no_money, drop constraint if exists deal_agreements_sale_shape,
  drop constraint if exists deal_agreements_sale_stage_check, drop constraint if exists deal_agreements_awaiting_side_check,
  drop constraint if exists deal_agreements_amount_ceiling;
alter table public.deal_agreements drop constraint if exists deal_agreements_kind_check;
alter table public.deal_agreements add constraint deal_agreements_kind_check check (kind in ('rent', 'stay'));
drop index if exists deal_agreements_reference_key, deal_agreements_idempotency_key, deal_agreements_one_live_sale_offer,
  deal_agreements_sale_listing_idx, deal_agreements_sale_expiry_idx;
alter table public.deal_agreements drop column if exists reference, drop column if exists expires_at, drop column if exists sale_stage,
  drop column if exists awaiting_side, drop column if exists idempotency_key, drop column if exists disputed_at, drop column if exists agreed_version;
alter table public.deal_agreement_events drop constraint if exists deal_agreement_events_action_check;
alter table public.deal_agreement_events add constraint deal_agreement_events_action_check
  check (action in ('opened', 'amended', 'confirmed', 'submitted', 'approved', 'rejected', 'cancelled', 'paid'));
alter table public.listings drop column if exists offers_enabled;
