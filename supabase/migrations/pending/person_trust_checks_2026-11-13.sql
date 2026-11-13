-- PERSON TRUST CHECKS (13 November 2026). UNVERIFIED DRAFT: written from the
-- migrations in this repository, never run against the live database (the
-- database connector was not reachable from the session that wrote it). Read
-- it against the live schema before pasting it.
--
-- WHAT IT IS FOR. The "Reasons to trust <name>" section on a member's public
-- page (apps/web/src/lib/trust/person-checks-read.ts) draws a check only with
-- the date it happened. Three of those dates exist today and no public read
-- carries them:
--
--   identity   public.person_badge publishes the TIER and nothing else, so a
--              page can draw the tick and cannot say when the check happened.
--   phone      public.confirmed_phones is select-own.
--   email      auth.users.email_confirmed_at is not readable by any client.
--
-- WHAT IT RETURNS, AND WHAT IT CANNOT. Four timestamps, each null when the
-- thing has not happened. No phone number, no email address, no document, no
-- name: the function has no column that could carry one. It answers only for
-- a person who holds a public page (a social_profiles row), which is the
-- surface the dates are drawn on.
--
-- THE IDENTITY DATE NEVER DISAGREES WITH THE BADGE. It is returned only when
-- public.is_checked_person(p_user) is true, which is the one derivation the
-- published tick is computed from, so a date can never appear beside no tick.
-- A person whose badge comes from a verified business and not from an agents
-- row has no dated identity rung in this schema, and gets null: no date, no
-- line, which is the rule the page already follows.
--
-- COMMUNITY PROMISE ACCEPTED (the founder, 13 November 2026). Nothing recorded
-- a member accepting the Community Promise, so there was no date to show.
-- This file adds the record: one row per member, the version of the promise
-- they accepted and when. A member writes only their own row, and only
-- through public.accept_community_promise, which takes the version and reads
-- the member from the session; no client role can insert, update or delete.
-- A visitor reads only the date, through public.person_trust_checks.
--
-- Until this is applied the reads answer nothing and the lines are simply not
-- drawn, and the "I accept" action says it could not be recorded. Nothing
-- else depends on it.

-- 1. The acceptance record.
create table if not exists public.community_promise_acceptances (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  promise_version text not null check (promise_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  accepted_at     timestamptz not null default now()
);

comment on table public.community_promise_acceptances is
  'One row per member who accepted the Community Promise: the version (its date) and when. Written only by public.accept_community_promise for the caller; read by its owner, and by visitors as a date only through public.person_trust_checks.';

revoke all on public.community_promise_acceptances from public, anon, authenticated;
grant select on public.community_promise_acceptances to authenticated;
alter table public.community_promise_acceptances enable row level security;

drop policy if exists community_promise_acceptances_select_own on public.community_promise_acceptances;
create policy community_promise_acceptances_select_own on public.community_promise_acceptances
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 2. The member accepts. The member is the session's, never an argument.
--    Accepting the same version again keeps the first date; a newer version
--    replaces the row with the new version and today's date.
create or replace function public.accept_community_promise(p_version text)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  me uuid := (select auth.uid());
  at timestamptz;
begin
  if me is null then
    raise exception 'sign in to accept the Community Promise' using errcode = '42501';
  end if;
  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'not a promise version' using errcode = '22023';
  end if;
  insert into public.community_promise_acceptances as a (user_id, promise_version)
  values (me, p_version)
  on conflict (user_id) do update
    set promise_version = excluded.promise_version,
        accepted_at = case when a.promise_version = excluded.promise_version then a.accepted_at else now() end
  returning a.accepted_at into at;
  return at;
end
$fn$;

comment on function public.accept_community_promise(text) is
  'The signed-in member accepts the Community Promise at the given version. Returns the acceptance date. Keeps the first date when the same version is accepted again.';

revoke all on function public.accept_community_promise(text) from public, anon;
grant execute on function public.accept_community_promise(text) to authenticated;

-- 3. The dates a visitor may read.

create or replace function public.person_trust_checks(p_user uuid)
returns table (
  identity_seen_at   timestamptz,
  phone_confirmed_at timestamptz,
  email_confirmed_at timestamptz,
  promise_accepted_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $fn$
  select
    case
      when public.is_checked_person(p_user) then (
        select max(ab.verified_at)
          from public.agents a
          join public.agent_badges ab on ab.agent_id = a.id
         where a.user_id = p_user
           and ab.verified
      )
    end as identity_seen_at,
    (select cp.confirmed_at from public.confirmed_phones cp where cp.user_id = p_user) as phone_confirmed_at,
    (select u.email_confirmed_at from auth.users u where u.id = p_user) as email_confirmed_at,
    (select pa.accepted_at from public.community_promise_acceptances pa where pa.user_id = p_user) as promise_accepted_at
   where exists (select 1 from public.social_profiles sp where sp.user_id = p_user);
$fn$;

comment on function public.person_trust_checks(uuid) is
  'The dates behind a member''s public trust checks: identity (agent_badges.verified_at, only while is_checked_person holds), mobile confirmed, email confirmed, Community Promise accepted. Dates only: no number, address, document or name. Null means it has not happened and draws nothing.';

revoke all on function public.person_trust_checks(uuid) from public;
grant execute on function public.person_trust_checks(uuid) to anon, authenticated;

-- 4. A lister's register entries, for their public page (the founder's
--    "agent's licence checked"). public.credentials is keyed by the person
--    and is select-own; the listing page reads it through
--    public.listing_credentials. This is the same fact by person: which
--    register, the name the register shows (or the company, for a CAC
--    directorship) and the date. NEVER THE NUMBER: the registration number is
--    printed on a listing, where a renter can look it up against the lister
--    in front of them, and has no place on a profile a stranger can read.
--    Entries older than a year are not returned, as on a listing.
create or replace function public.person_register_checks(p_user uuid)
returns table (
  kind          text,
  register_name text,
  company_name  text,
  checked_at    timestamptz
)
language sql
stable
security definer
set search_path to ''
as $fn$
  select c.kind, c.register_name, c.company_name, c.checked_at
    from public.credentials c
   where c.subject_id = p_user
     and c.checked_at > now() - interval '1 year'
     and exists (select 1 from public.social_profiles sp where sp.user_id = p_user)
   order by c.kind;
$fn$;

comment on function public.person_register_checks(uuid) is
  'A member''s dated register entries from the last year (LASRERA, ESVARBON, CAC directorship) for their public page: the register, the name it shows or the company, and the date. Never the registration number.';

revoke all on function public.person_register_checks(uuid) from public;
grant execute on function public.person_register_checks(uuid) to anon, authenticated;

-- Read back. Raises, so a partial state never commits.
do $check$
begin
  if not has_function_privilege('authenticated', 'public.person_trust_checks(uuid)', 'EXECUTE') then
    raise exception 'person_trust_checks: authenticated cannot execute it';
  end if;
  if not has_function_privilege('authenticated', 'public.person_register_checks(uuid)', 'EXECUTE') then
    raise exception 'person_register_checks: authenticated cannot execute it';
  end if;
  if has_table_privilege('anon', 'public.credentials', 'SELECT') then
    raise exception 'credentials: anon can read the table itself';
  end if;
  if has_function_privilege('anon', 'public.accept_community_promise(text)', 'EXECUTE') then
    raise exception 'accept_community_promise: anon can execute it';
  end if;
  if has_table_privilege('authenticated', 'public.community_promise_acceptances', 'INSERT')
     or has_table_privilege('authenticated', 'public.community_promise_acceptances', 'UPDATE')
     or has_table_privilege('authenticated', 'public.community_promise_acceptances', 'DELETE')
     or has_table_privilege('anon', 'public.community_promise_acceptances', 'SELECT') then
    raise exception 'community_promise_acceptances: a client role can write it, or anon can read it';
  end if;
  if has_function_privilege('anon', 'public.is_checked_person(uuid)', 'EXECUTE') then
    raise exception 'person_trust_checks: is_checked_person became callable by anon';
  end if;
end
$check$;
