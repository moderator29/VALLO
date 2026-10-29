-- Small SECURITY DEFINER helpers that carry ONLY the restricted piece of each public projection,
-- so the six public views can run as the caller (security_invoker) and stop being flagged.
create or replace function public.review_weight_withheld(p_review uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.weight_withheld w where w.kind = 'review' and w.subject_id = p_review) $$;

create or replace function public.lister_agent_name(p_agent uuid)
returns text language sql stable security definer set search_path = ''
as $$ select nullif(btrim(a.display_name), '') from public.agents a where a.id = p_agent $$;

create or replace function public.lister_firm_name(p_firm uuid)
returns text language sql stable security definer set search_path = ''
as $$ select nullif(btrim(b.name), '') from public.businesses b where b.id = p_firm $$;

create or replace function public.listing_credentials_for(p_agent uuid)
returns table (kind text, number text, company_name text, register_name text, checked_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.kind::text, c.number::text, c.company_name::text, c.register_name::text, c.checked_at
    from public.agents a
    join public.credentials c on c.subject_id = a.user_id
   where a.id = p_agent and not a.is_demo and c.checked_at > (now() - interval '365 days')
$$;

create or replace function public.door_honesty_for(p_listing uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select (count(*) filter (where t.paid_extra = 'no'))::integer
    from public.tenancy_reviews t
   where t.listing_id = p_listing and t.weight_withheld_reason is null
  having count(*) filter (where t.paid_extra = 'no') >= 5
$$;

create or replace function public.listing_truth_for(p_listing uuid)
returns table (attended integer, as_listed integer, last_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with latest as (
    select distinct on (t.respondent_id) t.respondent_id, t.agent_matched, t.property_matched, t.answered_at
      from public.inspection_truth t
     where t.listing_id = p_listing and t.weight_withheld_reason is null
     order by t.respondent_id, t.answered_at desc
  )
  select (count(*))::integer,
         (count(*) filter (where x.agent_matched = 'yes' and x.property_matched = 'yes'))::integer,
         date_trunc('month', max(x.answered_at))
    from latest x
   where coalesce((select f.enabled from public.feature_flags f where f.key = 'truth_public_count'), false)
  having count(*) >= 5
$$;

create or replace function public.badge_candidate_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select ur.user_id from public.user_roles ur
  union select a.user_id from public.agents a
  union select b.owner_id from public.businesses b where b.owner_id is not null
$$;

create or replace function public.badge_tier_of(p_user uuid)
returns public.badge_tier language sql stable security definer set search_path = ''
as $$ select private.badge_tier_for(p_user) $$;

revoke all on function public.review_weight_withheld(uuid), public.lister_agent_name(uuid), public.lister_firm_name(uuid),
  public.listing_credentials_for(uuid), public.door_honesty_for(uuid), public.listing_truth_for(uuid),
  public.badge_candidate_ids(), public.badge_tier_of(uuid) from public;
grant execute on function public.review_weight_withheld(uuid), public.lister_agent_name(uuid), public.lister_firm_name(uuid),
  public.listing_credentials_for(uuid), public.door_honesty_for(uuid), public.listing_truth_for(uuid),
  public.badge_candidate_ids(), public.badge_tier_of(uuid) to anon, authenticated, service_role;
