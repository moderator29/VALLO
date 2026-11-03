create or replace function public.listing_lister_name(p_listing uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case l.listing_role
           when 'owner'::public.listing_role then null::text
           when 'firm'::public.listing_role then public.lister_firm_name(l.firm_id)
           else public.lister_agent_name(l.agent_id)
         end
    from public.listings l where l.id = p_listing
$$;
revoke all on function public.listing_lister_name(uuid) from public;
grant execute on function public.listing_lister_name(uuid) to anon, authenticated, service_role;
-- The two name pieces are internal to it: callers go through listing_lister_name only.
revoke execute on function public.lister_agent_name(uuid), public.lister_firm_name(uuid) from anon, authenticated;
