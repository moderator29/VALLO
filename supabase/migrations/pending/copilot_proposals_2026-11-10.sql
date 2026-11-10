-- THE COPILOT'S SINGLE-USE RECORD (founder, 10 November 2026). One row per
-- confirmed copilot proposal, so that "a confirmed proposal works once" is
-- decided by the database and not by a memory that can be lost.
--
-- NOT APPLIED. Additive only: one new table. Nothing existing is touched,
-- dropped or narrowed. Safe to run twice (every statement is `if not exists`,
-- `create or replace` or `drop ... if exists` before `create`).
--
-- HOW IT IS USED. `app/api/admin/copilot/act/route.ts` calls
-- `confirmProposal` (`lib/admin/copilot/act.ts`), which, BEFORE the desk's
-- own server action runs, inserts one row with the signed proposal's nonce
-- through the service client, as a single atomic statement:
--   insert ... on conflict (nonce) do nothing returning nonce
-- A row back means this call won the claim; no row back means the nonce was
-- already used, so the action does not run. If the claim cannot be recorded
-- at all, the action does not run either (it fails closed). Until this table
-- exists the code falls back to its older guard (in-process memory, a
-- rate-limit counter and an audit-log lookup) and logs that it did.
--
-- NO CONTENT. The row holds the tool name and the action kind only: never the
-- proposal's arguments, never a message body, never anything a person typed.
--
-- RETENTION. A nonce only matters until its proposal expires (15 minutes), so
-- rows older than 7 days carry no protection and may be deleted. The function
-- `private.copilot_proposals_cleanup()` below does that; run it by hand or
-- from a scheduled job, it is not scheduled here.
--
-- RLS. The route reaches this table with the service client. RLS is the same
-- admin-role shape as `social_posts_2026-11-10.sql`: read and insert for an
-- admin or super admin on their own session, no update, no delete, no other
-- caller. No `private.staff_can` in a policy.

create table if not exists public.copilot_proposals (
  nonce      text primary key,
  user_id    uuid references auth.users (id) on delete set null,
  tool       text not null,
  action     text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz,
  constraint copilot_proposals_nonce_len check (char_length(nonce) between 8 and 200),
  constraint copilot_proposals_tool_len check (char_length(tool) between 1 and 100),
  constraint copilot_proposals_action_len check (char_length(action) between 1 and 100),
  constraint copilot_proposals_expiry_after_creation check (expires_at >= created_at)
);

comment on table public.copilot_proposals is
  'One row per confirmed copilot proposal, claimed with an atomic insert before the action runs so a proposal works once. Holds the tool and action kind only, never arguments. Rows older than 7 days may be deleted (private.copilot_proposals_cleanup()).';

create index if not exists copilot_proposals_expires_at_idx on public.copilot_proposals (expires_at);
create index if not exists copilot_proposals_user_id_idx on public.copilot_proposals (user_id);

alter table public.copilot_proposals enable row level security;
revoke all on table public.copilot_proposals from public, anon, authenticated;
grant select, insert on table public.copilot_proposals to authenticated;

drop policy if exists copilot_proposals_admin_read on public.copilot_proposals;
create policy copilot_proposals_admin_read on public.copilot_proposals
  for select to authenticated
  using (private.has_role((select auth.uid()), 'admin'::public.app_role)
         or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

drop policy if exists copilot_proposals_admin_insert on public.copilot_proposals;
create policy copilot_proposals_admin_insert on public.copilot_proposals
  for insert to authenticated
  with check (private.has_role((select auth.uid()), 'admin'::public.app_role)
              or private.has_role((select auth.uid()), 'super_admin'::public.app_role));

create or replace function private.copilot_proposals_cleanup()
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  removed integer;
begin
  delete from public.copilot_proposals where created_at < now() - interval '7 days';
  get diagnostics removed = row_count;
  return removed;
end;
$function$;

revoke all on function private.copilot_proposals_cleanup() from public, anon, authenticated;

-- Self-checks.
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'copilot_proposals' and c.relrowsecurity) then
    raise exception 'copilot_proposals: row level security is not on';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'copilot_proposals') <> 2 then
    raise exception 'copilot_proposals: expected exactly two policies';
  end if;
end $$;
