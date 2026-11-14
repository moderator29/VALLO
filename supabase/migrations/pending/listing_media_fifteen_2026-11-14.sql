-- ============================================================================
-- NOT APPLIED. CHECKED AGAINST LIVE ON 14 NOVEMBER 2026 WITH READS ONLY: the
-- photo position check is named listing_photos_position_check (0..9), the
-- videos' trigger is listing_videos_ceiling on private.listing_video_ceiling()
-- (three), listing_photos has no ceiling trigger, and the fullest listing holds
-- five photos and videos with a highest photo position of 3, so nothing is
-- over the new shape. Only the founder applies it.
-- ============================================================================
--
-- FIFTEEN IN ALL, PHOTOS AND VIDEOS TOGETHER (the founder, 13 November 2026:
-- "image and video upload maximum should be 15").
--
-- THE PROBLEM. The database shapes a listing to ten photos (position 0..9,
-- unique) and three videos (private.listing_video_ceiling), thirteen in all and
-- never fifteen, and never four videos. The app now counts fifteen in all
-- before anything is uploaded (apps/web/src/lib/agent/listings-model.ts
-- MAX_MEDIA, checked again in addPhoto and addVideo), but within the
-- database's per-kind shape.
--
-- WHAT THIS DOES.
--   1. Photo positions 0..14 instead of 0..9.
--   2. The video ceiling counts photos AND videos together, fifteen, under the
--      same lock on the parent listing row as before.
--   3. The same fifteen-together ceiling on a photo insert, under the same
--      lock, so two uploads at once cannot both see room for one more.
-- After it runs, set MAX_PHOTOS and MAX_VIDEOS in listings-model.ts to
-- MAX_MEDIA so the app allows any mix of fifteen.
--
-- WHAT THIS DOES NOT DO. It deletes nothing and changes no existing row. No
-- listing can hold more than fifteen today (the old shape stops at thirteen),
-- so nothing is over the new ceiling. Storage bucket limits are unchanged
-- (listing-videos 100MB per object).
--
-- SAFE TO RUN TWICE: drop constraint if exists before add, create or replace,
-- drop trigger if exists before create.

begin;

alter table public.listing_photos drop constraint if exists listing_photos_position_check;
alter table public.listing_photos drop constraint if exists listing_photos_position_fifteen;
alter table public.listing_photos
  add constraint listing_photos_position_fifteen check (position >= 0 and position < 15);

create or replace function private.listing_media_ceiling()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  held integer;
begin
  -- Serialise on the parent listing, as the video ceiling always has.
  perform 1 from public.listings where id = new.listing_id for update;
  select (select count(*) from public.listing_photos where listing_id = new.listing_id)
       + (select count(*) from public.listing_videos where listing_id = new.listing_id)
    into held;
  if held >= 15 then
    raise exception 'a listing holds up to 15 photos and videos together'
      using errcode = 'check_violation',
            hint = 'Remove a photo or a video before adding another.';
  end if;
  return new;
end;
$$;

revoke all on function private.listing_media_ceiling() from public, anon, authenticated;

-- The videos' own ceiling of three becomes the shared ceiling of fifteen.
drop trigger if exists listing_videos_ceiling on public.listing_videos;
create trigger listing_videos_ceiling
  before insert on public.listing_videos
  for each row
  execute function private.listing_media_ceiling();

drop trigger if exists listing_photos_media_ceiling on public.listing_photos;
create trigger listing_photos_media_ceiling
  before insert on public.listing_photos
  for each row
  execute function private.listing_media_ceiling();

-- READ-BACK, inside the transaction: if anything is not as written, nothing is kept.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'listing_photos_position_fifteen') then
    raise exception 'the fifteen-position check on listing_photos is not there';
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.listing_photos'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ~ 'position"? < 10') then
    raise exception 'an old ten-position check is still on listing_photos';
  end if;
  if (select count(*) from pg_trigger t join pg_proc p on p.oid = t.tgfoid
       where not t.tgisinternal and p.proname = 'listing_media_ceiling'
         and t.tgname in ('listing_videos_ceiling', 'listing_photos_media_ceiling')) <> 2 then
    raise exception 'a media ceiling trigger is missing or still on the old function';
  end if;
  if has_function_privilege('authenticated', 'private.listing_media_ceiling()', 'EXECUTE')
     or has_function_privilege('anon', 'private.listing_media_ceiling()', 'EXECUTE') then
    raise exception 'the media ceiling is executable by a client role';
  end if;
end
$$;

commit;

select (select pg_get_constraintdef(oid) from pg_constraint where conname = 'listing_photos_position_fifteen') as photo_positions,
       (select count(*) from pg_trigger t join pg_proc p on p.oid = t.tgfoid
         where not t.tgisinternal and p.proname = 'listing_media_ceiling') as shared_ceiling_triggers_of_2;
