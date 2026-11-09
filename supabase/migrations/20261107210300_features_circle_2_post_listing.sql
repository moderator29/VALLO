-- FEATURES: PROPERTY-POWERED POSTS (FEED_AND_CIRCLE_BRIEF.md part 2.2).
-- Agent FEATURES, 7 November 2026. For the founder to paste; the lead checks
-- it live and moves it into migrations/.
--
-- Any member may feature a genuine listing in a post (the founder: "users can
-- feature a listing in their post"). Today `posts_insert_self` lets a post
-- carry ANY listing_id, a draft or a rejected one included (checked live).
-- This holds the one rule that keeps the card honest: the listing is
-- PUBLISHED, open and not an example listing when the post is written. A
-- listing taken down later is filtered by `listings_select_published` at
-- read time, and the post shows as words only.
--
-- SHOWCASE keeps its own stricter rule (your own live listing,
-- private.enforce_showcase_listing). Additive: one function, one trigger.

set lock_timeout = '5s';

create or replace function private.enforce_genuine_post_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.listing_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.listing_id is not distinct from old.listing_id then return new; end if;
  if not exists (
    select 1 from public.listings l
     where l.id = new.listing_id
       and l.status = 'PUBLISHED'
       and l.closed_at is null
       and not coalesce(l.is_demo, false)
  ) then
    raise exception 'That listing is not live, so it cannot be featured.' using errcode = 'RM027';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_genuine_post_listing() from public, anon, authenticated;

drop trigger if exists posts_genuine_listing on public.posts;
create trigger posts_genuine_listing
  before insert on public.posts
  for each row execute function private.enforce_genuine_post_listing();
