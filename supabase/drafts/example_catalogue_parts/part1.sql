-- THE EXAMPLE CATALOGUE, PART 1 OF 6: the account, the credits table and the one check.
--
-- supabase/drafts/example_catalogue_2026-11-26.sql cut into 6 pastes,
-- because 168 KB does not fit in a message. RUN THEM IN ORDER, one at a
-- time, each on its own. Every part is a transaction, so a part either
-- happens or it does not; parts 2 to 6 refuse to start out of order; and
-- part 6 counts everything and fails the paste if a number is wrong.
-- Running a part twice changes nothing.
--
-- Why each thing in here is the way it is: the header of the single-file
-- version in the repository.

begin;

/* ------------------------------------------- 1. the examples account */

-- No password, no identity row, so nobody can sign in as it. It exists to own
-- the example collection and to put a name other than a real person's on the
-- "Listed by" line.
-- `confirmed_at` is NOT in this list on purpose: on the platform it is
-- `generated always as (least(email_confirmed_at, phone_confirmed_at))`, and
-- an insert that names a generated column is refused.
--
-- `email_confirmed_at` is left null on purpose too. Confirming an address
-- fires `enqueue_welcome_email`, and a welcome to a mailbox that does not
-- exist is a bounce and a queue row for nothing. Nothing signs in as this
-- account, so there is nothing for a confirmation to unlock.
--
-- The name arrives as first_name and surname because `handle_new_user`
-- composes `profiles.display_name` from those, so the profile is right the
-- first time and no UPDATE is needed. An UPDATE here would fire
-- `sync_social_identity_from_profile`, which revalidates the handle, and the
-- handle validator refuses anything containing "vallo".
insert into auth.users (
  instance_id, id, aud, role, email,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values (
  '00000000-0000-0000-0000-000000000000',
  'e0000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'examples@vallo.ng',
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"first_name": "Vallo", "surname": "Examples"}'::jsonb,
  now(), now(), false, false
)
on conflict (id) do nothing;

-- A fallback only: `handle_new_user` has normally made this row already.
insert into public.profiles (id, display_name)
values ('e0000000-0000-4000-8000-000000000001', 'Vallo Examples')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
values ('e0000000-0000-4000-8000-000000000001', 'user'), ('e0000000-0000-4000-8000-000000000001', 'agent')
on conflict do nothing;

-- role 'owner': Vallo is not acting as anybody's agent here, and an agent row
-- would be claiming a mandate from a landlord who does not exist.
--
-- `agents.user_id` is unique, so one account holds one agent row. If the
-- examples account somehow already holds a different one, stop and say which,
-- rather than failing on the raw constraint and leaving the founder to read a
-- key name. On the live project as counted on 26 November this account does
-- not exist at all, so the insert below is the first row it gets.
do $agent$
declare
  v_other uuid;
begin
  select id into v_other from public.agents
   where user_id = 'e0000000-0000-4000-8000-000000000001' and id <> 'e0000000-0000-4000-8000-000000000003' limit 1;
  if v_other is not null then
    raise exception 'the examples account already holds agent %. Retire that row, or point this file at it, before running this.', v_other;
  end if;

  insert into public.agents (id, user_id, display_name, type, status, verified, verification_tier, is_demo, role)
  values ('e0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'Vallo Examples', 'individual', 'APPROVED', false, 0, true, 'owner')
  on conflict (id) do nothing;
end
$agent$;

/* -------------------------------- 2. photo credits, and the one check */

-- Reference data: who took a photograph, keyed by the path or URL the photo
-- rows carry. Keyed by the value rather than by a photo row id because one
-- photograph is used by several listings and the credit belongs to the
-- photograph, not to the row.
create table if not exists public.photo_credits (
  storage_path       text primary key,
  source             text not null,
  source_id          text,
  photographer       text not null,
  photographer_url   text,
  photo_url          text,
  alt_text           text,
  created_at         timestamptz not null default now(),
  constraint photo_credits_source_known check (source in ('unsplash', 'own', 'lister'))
);

comment on table public.photo_credits is
  'Who took a photograph, by the path or URL the photo rows carry. Unsplash requires the credit; a lister''s own photograph does not need one.';

alter table public.photo_credits enable row level security;

drop policy if exists photo_credits_select_all on public.photo_credits;
create policy photo_credits_select_all on public.photo_credits for select using (true);

grant select on public.photo_credits to anon, authenticated;

-- The narrowing. Same refusal as before for every scheme and every host, with
-- one literal exception. See the header.
alter table public.listing_photos drop constraint if exists listing_photos_path_not_url;
alter table public.listing_photos add constraint listing_photos_path_not_url
  check (
    storage_path like 'https://images.unsplash.com/%'
    or (storage_path !~ '^[A-Za-z][A-Za-z0-9+.-]*:' and storage_path !~ '^//'
        and position('\' in storage_path) = 0 and position('..' in storage_path) = 0)
  );

alter table public.accommodation_photos drop constraint if exists accommodation_photos_path_not_url;
alter table public.accommodation_photos add constraint accommodation_photos_path_not_url
  check (
    storage_path like 'https://images.unsplash.com/%'
    or (storage_path !~ '^[A-Za-z][A-Za-z0-9+.-]*:' and storage_path !~ '^//'
        and position('\' in storage_path) = 0 and position('..' in storage_path) = 0)
  );

alter table public.business_photos drop constraint if exists business_photos_path_not_url;
alter table public.business_photos add constraint business_photos_path_not_url
  check (
    storage_path like 'https://images.unsplash.com/%'
    or (storage_path !~ '^[A-Za-z][A-Za-z0-9+.-]*:' and storage_path !~ '^//'
        and position('\' in storage_path) = 0 and position('..' in storage_path) = 0)
  );

commit;
