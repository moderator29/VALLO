-- A ROOMMATES CARD ON A CIRCLE POST (founder, 10 November 2026: "sharing a
-- Roommates link into a Circle"). A member can share a Roommates room post or
-- a person's Roommates profile into a community they belong to; the Circle
-- post carries a small card and a link to the real page.
--
-- NOT APPLIED. Additive only: one nullable column on `public.posts`, one
-- index, two functions and two triggers. Nothing existing is dropped, narrowed
-- or rewritten. Safe to run twice. Depends on `roommates_3_integrations.sql`
-- (APPLIED: it added `posts.roommate_listing_id`, which the room card also
-- sets) and on the Circle core (applied). The app degrades to "Sharing to a
-- Circle is not open yet" until this is run.
--
-- WHAT THE CARD IS. `posts.roommate_card` is a closed jsonb object:
--   { v: 1, kind: 'room' | 'person', ref: <uuid>, title, place, summary }
-- built on the server by `lib/features/circle/roommate-card.ts` from the page
-- the sharer can already see: a room post's title, area and city, kind and
-- price; or a person's FIRST NAME, school and area, and what they are here
-- for. No phone, email, handle, photograph, street address, workplace, gender
-- or budget. The link is built from `ref` at read time and never stored.
--
-- NO auth.users COLUMN. `ref` is an id inside jsonb, not a foreign key, so
-- there is nothing to cascade. The card lives and dies with its post: a
-- removed post is a tombstone (`status = 'REMOVED'`) and is not listed.
--
-- WHY A TRIGGER AND NOT ONLY THE APP. The app builds the card, but a member
-- can call the posts API directly. The guard below refuses a card with an
-- unknown key, a wrong shape, an over-long text, a text that looks like a
-- contact detail (an at sign, a link, a run of seven or more digits), a card
-- outside a community, or a card on a reply. RLS is unchanged:
-- `posts_insert_self` and `circle_place_post` (an active member of a live
-- community) still decide who may post and where, and the content scanner,
-- the rate limits, holds and reports apply to the post exactly as to any
-- other Circle post.

set lock_timeout = '5s';

alter table public.posts add column if not exists roommate_card jsonb;

alter table public.posts drop constraint if exists posts_roommate_card_size;
alter table public.posts add constraint posts_roommate_card_size
  check (roommate_card is null or (jsonb_typeof(roommate_card) = 'object' and pg_column_size(roommate_card) <= 1500));

create index if not exists posts_roommate_card_ref_idx
  on public.posts (author_id, community_id, (roommate_card ->> 'ref'))
  where roommate_card is not null;

-- True when the text carries no contact detail.
create or replace function private.circle_card_text_ok(p_text text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  m text[];
begin
  if p_text is null then return false; end if;
  if p_text ~* '(@|https?:|www\.)' then return false; end if;
  for m in select regexp_matches(p_text, '[0-9][0-9 ().+-]*[0-9]', 'g') loop
    if char_length(regexp_replace(m[1], '[^0-9]', '', 'g')) >= 7 then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function private.circle_roommate_card_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if tg_op = 'UPDATE' then
    -- A card is written once with its post. Nobody edits it afterwards.
    if pg_trigger_depth() <= 1 then new.roommate_card := old.roommate_card; end if;
    return new;
  end if;

  if new.roommate_card is null then return new; end if;

  if new.community_id is null or new.parent_id is not null then
    raise exception 'A Roommates card goes on a Circle post, not on a reply or a feed post.' using errcode = 'RM340';
  end if;
  if jsonb_typeof(new.roommate_card) <> 'object' then
    raise exception 'That Roommates card could not be read.' using errcode = 'RM341';
  end if;
  for k in select jsonb_object_keys(new.roommate_card) loop
    if k not in ('v', 'kind', 'ref', 'title', 'place', 'summary') then
      raise exception 'That Roommates card holds more than it may.' using errcode = 'RM342';
    end if;
  end loop;
  if (new.roommate_card ->> 'v') is distinct from '1'
     or (new.roommate_card ->> 'kind') not in ('room', 'person')
     or (new.roommate_card ->> 'ref') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or jsonb_typeof(new.roommate_card -> 'title') <> 'string'
     or jsonb_typeof(new.roommate_card -> 'place') <> 'string'
     or jsonb_typeof(new.roommate_card -> 'summary') <> 'string' then
    raise exception 'That Roommates card could not be read.' using errcode = 'RM341';
  end if;
  if char_length(btrim(new.roommate_card ->> 'title')) = 0
     or char_length(new.roommate_card ->> 'title') > 140
     or char_length(new.roommate_card ->> 'place') > 160
     or char_length(new.roommate_card ->> 'summary') > 200 then
    raise exception 'That Roommates card is too long.' using errcode = 'RM343';
  end if;
  if not (private.circle_card_text_ok(new.roommate_card ->> 'title')
          and private.circle_card_text_ok(new.roommate_card ->> 'place')
          and private.circle_card_text_ok(new.roommate_card ->> 'summary')) then
    raise exception 'A Roommates card never carries contact details.' using errcode = 'RM344';
  end if;
  return new;
end;
$$;

revoke all on function private.circle_card_text_ok(text) from public, anon, authenticated;
revoke all on function private.circle_roommate_card_guard() from public, anon, authenticated;

drop trigger if exists posts_roommate_card_guard on public.posts;
create trigger posts_roommate_card_guard
  before insert or update of roommate_card on public.posts
  for each row execute function private.circle_roommate_card_guard();

-- Self-checks.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'posts' and column_name = 'roommate_card') then
    raise exception 'posts.roommate_card was not added';
  end if;
  if private.circle_card_text_ok('call 08031234567') then raise exception 'phone number was let through'; end if;
  if private.circle_card_text_ok('mail me a@b.co') then raise exception 'email was let through'; end if;
  if not private.circle_card_text_ok('Roommate wanted · ₦1,500,000/year') then raise exception 'a price was refused'; end if;
end $$;
