-- NOT APPLIED. Written 10 November 2026 (DOCS_AND_PRESENCE_UPGRADE.md 4.6,
-- "a was this helpful that writes to the support desk").
--
-- WHY A NEW TABLE. The support desk's only write path is support_tickets,
-- which needs a name and an email and files a ticket a person must answer: a
-- "No" on a help answer is not a ticket, and filing one per tap would bury
-- the real queue. So the answer goes to its own small table, and the desk
-- reads a summary of it per page.
--
-- WHAT IT ADDS, additive and idempotent, nothing removed:
--   public.doc_feedback               one row per answer: the page (a path
--                                     under /help, /guides or /docs, with an
--                                     optional #section), yes or no, an
--                                     optional note of at most 500 characters,
--                                     the member when signed in (null for a
--                                     visitor), when. RLS on, no direct grant
--                                     to anon or authenticated.
--   public.submit_doc_feedback(...)   the one write, for anon and members:
--                                     checks the page shape and the note,
--                                     stamps auth.uid(). The app rate-limits
--                                     it before calling (bucket doc_feedback).
--   public.doc_feedback_ready()       answers true. The app draws the control
--                                     only once this function exists, so the
--                                     control stays hidden until this file is
--                                     applied.
--   public.staff_doc_feedback_summary(p_days)
--                                     for staff only (private.is_staff()):
--                                     per page, the yes and no counts in the
--                                     window and the latest notes, so the desk
--                                     can see which pages are failing. No
--                                     admin screen reads it yet.
--
-- Check after applying: select public.doc_feedback_ready(); returns true;
-- as anon, select public.submit_doc_feedback('/help#refunds', false, 'test')
-- returns true and a row exists; select * from public.doc_feedback as anon
-- returns nothing (no grant).
set lock_timeout = '5s';

create table if not exists public.doc_feedback (
  id uuid primary key default gen_random_uuid(),
  page text not null check (length(page) <= 200 and page ~ '^/(help|guides|docs)(/[a-z0-9-]+)?(#[a-z0-9-]+)?$'),
  helpful boolean not null,
  note text check (note is null or length(btrim(note)) between 1 and 500),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists doc_feedback_page_created on public.doc_feedback (page, created_at desc);
alter table public.doc_feedback enable row level security;
revoke all on table public.doc_feedback from public, anon, authenticated;
grant select, insert on table public.doc_feedback to service_role;

create or replace function public.submit_doc_feedback(p_page text, p_helpful boolean, p_note text default null)
returns boolean language plpgsql volatile security definer set search_path to '' as $fn$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_page is null or p_helpful is null then return false; end if;
  if length(p_page) > 200 or p_page !~ '^/(help|guides|docs)(/[a-z0-9-]+)?(#[a-z0-9-]+)?$' then return false; end if;
  if v_note is not null and length(v_note) > 500 then v_note := left(v_note, 500); end if;
  insert into public.doc_feedback (page, helpful, note, user_id)
  values (p_page, p_helpful, v_note, (select auth.uid()));
  return true;
end;
$fn$;
revoke all on function public.submit_doc_feedback(text, boolean, text) from public, anon, authenticated;
grant execute on function public.submit_doc_feedback(text, boolean, text) to anon, authenticated;

create or replace function public.doc_feedback_ready()
returns boolean language sql immutable set search_path to '' as $fn$ select true $fn$;
revoke all on function public.doc_feedback_ready() from public, anon, authenticated;
grant execute on function public.doc_feedback_ready() to anon, authenticated;

create or replace function public.staff_doc_feedback_summary(p_days integer default 30)
returns table (page text, helpful bigint, not_helpful bigint, latest_notes text[], last_at timestamptz)
language plpgsql stable security definer set search_path to '' as $fn$
begin
  if not private.is_staff() then
    raise exception 'staff only' using errcode = 'insufficient_privilege';
  end if;
  return query
    select f.page,
           count(*) filter (where f.helpful),
           count(*) filter (where not f.helpful),
           (array_agg(f.note order by f.created_at desc) filter (where f.note is not null))[1:5],
           max(f.created_at)
      from public.doc_feedback f
     where f.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
     group by f.page
     order by count(*) filter (where not f.helpful) desc, max(f.created_at) desc;
end;
$fn$;
revoke all on function public.staff_doc_feedback_summary(integer) from public, anon, authenticated;
grant execute on function public.staff_doc_feedback_summary(integer) to authenticated;
