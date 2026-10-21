-- APPLIED 21 October 2026. Makes the badge rule user_badges_not_self_granted (an admin cannot grant
-- themselves a manual badge) fully checked. It was added NOT VALID in 20261021104453 so old rows were not
-- read; zero rows broke it, so it is validated now.
set lock_timeout = '5s';
alter table public.user_badges validate constraint user_badges_not_self_granted;
