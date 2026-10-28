set lock_timeout = '5s';
create or replace function public.my_invite_step()
returns text
language sql
stable
security definer
set search_path = ''
as $fn$
  /* The invited member's own next step toward counting for the person who
     invited them: 'phone', 'setup' or 'email', or null when they were not
     invited, already count, or nothing is missing. Never says who invited
     them and never a risk reason. */
  select case w.first_missing
           when 'phone_verified' then 'phone'
           when 'onboarding_completed' then 'setup'
           when 'email_verified' then 'email'
         end
    from public.referrals r
    join lateral (
      select (select u.k from unnest(c.requirement_keys) with ordinality as u(k, ord)
               where private.referral_requirement_check(u.k, r.referred_id, c.requirement_params -> u.k) is not null
               order by u.ord limit 1) as first_missing
        from public.referral_campaigns c
       where c.status = 'active' and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now())
         and (c.id = r.campaign_id
              or c.kind = (select o.kind from public.referral_campaigns o where o.id = r.campaign_id)
              or (r.campaign_id is null and c.kind = 'consumer'))
       order by (c.id = r.campaign_id) desc, c.starts_at desc
       limit 1
    ) w on true
   where r.referred_id = (select auth.uid()) and r.status = 'attributed'
   limit 1;
$fn$;
revoke all on function public.my_invite_step() from public, anon;
grant execute on function public.my_invite_step() to authenticated;
