-- The six public projections now run as the CALLER (security_invoker), so they are no longer SECURITY DEFINER
-- views. What a caller may not read directly (firm ids, credentials, review answers, roles) is reached only
-- through small helper functions that apply the same rules the views always did (published only, at least five
-- answers, no demo rows, withheld rows hidden). Column names, types and grants are unchanged.
create or replace view public.listing_lister with (security_invoker = true, security_barrier = true) as
 select l.id as listing_id, public.listing_lister_name(l.id) as lister_name
   from public.listings l where l.status = 'PUBLISHED'::public.listing_status;

create or replace view public.listing_credentials with (security_invoker = true) as
 select l.id as listing_id, c.kind, c.number, c.company_name, c.register_name, c.checked_at
   from public.listings l cross join lateral public.listing_credentials_for(l.agent_id) c
  where l.status = 'PUBLISHED'::public.listing_status and not l.is_demo;

create or replace view public.door_honesty with (security_invoker = true) as
 select l.id as listing_id, d.n as nothing_more
   from public.listings l cross join lateral (select public.door_honesty_for(l.id) as n) d
  where not l.is_demo and d.n is not null;

create or replace view public.listing_truth_summary with (security_invoker = true) as
 select l.id as listing_id, s.attended, s.as_listed, s.last_at
   from public.listings l cross join lateral public.listing_truth_for(l.id) s
  where l.status = 'PUBLISHED'::public.listing_status and not l.is_demo;

create or replace view public.person_badge with (security_invoker = true) as
 select c.user_id, t.tier
   from public.badge_candidate_ids() as c(user_id)
  cross join lateral (select public.badge_tier_of(c.user_id) as tier) t
  where t.tier <> 'none'::public.badge_tier;

create or replace view public.reviews_counted with (security_invoker = true) as
 select r.id, r.listing_id, r.booking_id, r.author_id, r.rating, r.body, r.author_label, r.created_at
   from public.reviews r
  where (r.listing_id is not null or (select auth.uid()) = r.author_id)
    and ((select auth.uid()) = r.author_id or not public.review_weight_withheld(r.id));
