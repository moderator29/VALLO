set lock_timeout = '5s';

-- Performance advisor: foreign keys without a covering index, on tables that grow
-- (events, purchases, ledgers, call reviews). The small staff-setting tables stay as
-- they are: an index there costs a write for no read. Plain btree; tables are small enough
-- that a normal (locking) build is instant.
create index if not exists placements_listing_id_idx on promotion.placements (listing_id);
create index if not exists purchases_ledger_entry_id_idx on promotion.purchases (ledger_entry_id);
create index if not exists purchases_placement_id_idx on promotion.purchases (placement_id);
create index if not exists purchases_price_id_idx on promotion.purchases (price_id);
create index if not exists deal_agreement_events_actor_id_idx on public.deal_agreement_events (actor_id);
create index if not exists stay_events_by_user_idx on public.stay_events (by_user);
create index if not exists call_review_entries_author_id_idx on public.call_review_entries (author_id);
create index if not exists call_review_entries_corrects_id_idx on public.call_review_entries (corrects_id);
create index if not exists ledger_customer_funds_created_by_idx on public.ledger_customer_funds (created_by);
create index if not exists ledger_marketing_float_created_by_idx on public.ledger_marketing_float (created_by);
create index if not exists ledger_vallo_revenue_created_by_idx on public.ledger_vallo_revenue (created_by);
create index if not exists guarantee_reserve_entries_created_by_idx on public.guarantee_reserve_entries (created_by);
