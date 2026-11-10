-- ROOMMATES 9: AN OPTIONAL PHOTO GALLERY ON THE ROOMMATE PROFILE.
--
-- Founder, 10 Nov 2026: a person may add up to six photos (their room, their
-- space, how they live) that show on their profile page. The photos use the
-- existing public `roommate-photos` bucket and the same upload path rule as
-- room posts (`<user id>/...`).
--
-- Additive and safe to run twice. One nullable-by-default column, no new
-- table, no new grant (roommate_profiles already has select/insert/update/
-- delete for authenticated, and is in the db-06 allowlist as 'idu').
--   - `gallery` text[] not null default '{}', at most six entries.
--   - a guard trigger: a member's gallery paths must sit in their own folder.
--   - `roommate_profile_gallery(p_user)`: who may read it. The owner and staff
--     always; anyone else only while the profile is active and nobody has
--     blocked the other. It returns paths only, never contact details.

begin;

alter table public.roommate_profiles add column if not exists gallery text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roommate_profiles_gallery_max' and conrelid = 'public.roommate_profiles'::regclass) then
    alter table public.roommate_profiles add constraint roommate_profiles_gallery_max check (cardinality(gallery) <= 6);
  end if;
end $$;

create or replace function private.roommate_profile_gallery_guard()
returns trigger language plpgsql set search_path to '' as $$
declare
  p text;
begin
  if current_user not in ('authenticated', 'anon') or private.is_staff() then
    return new;
  end if;
  foreach p in array new.gallery loop
    if left(p, char_length(new.user_id::text) + 1) <> new.user_id::text || '/' or p like '%..%' then
      raise exception 'One of the photos could not be used. Upload it again.' using errcode = 'RM301';
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists roommate_profiles_gallery_guard on public.roommate_profiles;
create trigger roommate_profiles_gallery_guard before insert or update of gallery on public.roommate_profiles
  for each row execute function private.roommate_profile_gallery_guard();
revoke all on function private.roommate_profile_gallery_guard() from public, anon, authenticated;

create or replace function public.roommate_profile_gallery(p_user uuid)
returns text[] language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := (select auth.uid());
  g text[];
  st text;
begin
  select rp.gallery, rp.status into g, st from public.roommate_profiles rp where rp.user_id = p_user;
  if not found then
    return '{}';
  end if;
  if me = p_user or (select private.is_staff()) then
    return g;
  end if;
  if me is null or st <> 'active' or private.blocked_between(me, p_user) then
    return '{}';
  end if;
  return g;
end;
$$;
revoke all on function public.roommate_profile_gallery(uuid) from public, anon;
grant execute on function public.roommate_profile_gallery(uuid) to authenticated;

select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'roommate_profiles' and column_name = 'gallery') as gallery_column_expected_1,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'roommate_profile_gallery') as function_expected_1;

commit;
