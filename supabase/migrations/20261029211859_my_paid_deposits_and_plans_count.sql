-- The phone gate counts a member's paid deposits and plans. Those tables are
-- not readable by the member directly, so the count runs as a definer helper
-- scoped to the caller. Execute is granted to signed-in members only.
create or replace function public.my_paid_deposits_and_plans_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (select count(*) from public.reservation_deposits d where d.guest_id = (select auth.uid()) and d.paid_at is not null)
    + (select count(*) from public.member_subscriptions s where s.user_id = (select auth.uid()) and s.current_period_start is not null)
  )::integer
$$;

revoke all on function public.my_paid_deposits_and_plans_count() from public, anon;
grant execute on function public.my_paid_deposits_and_plans_count() to authenticated, service_role;
