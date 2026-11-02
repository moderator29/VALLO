set lock_timeout = '5s';

-- ASK FOR A SELFIE HOLDING THE ID, ONLY WHEN A REVIEWER DOES NOT TRUST ONE
-- (founder, 2 November 2026). It is never a step in the flow. A reviewer
-- writes why, the person is sent those words, and they answer with one photo
-- from the same message on /verification. The photo is filed as their new
-- selfie (it replaces the one in doubt), so approving it completes the
-- identity step exactly as a plain selfie would.
create table if not exists public.verification_requests (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references auth.users(id) on delete cascade,
  kind          text not null default 'selfie_with_id' check (kind in ('selfie_with_id')),
  message       text not null check (length(btrim(message)) between 12 and 600),
  status        text not null default 'open' check (status in ('open', 'answered', 'closed')),
  requested_by  uuid not null references auth.users(id),
  requested_at  timestamptz not null default now(),
  answered_at   timestamptz,
  document_id   uuid references public.agent_documents(id) on delete set null
);
create unique index if not exists verification_requests_one_open
  on public.verification_requests (subject_id) where status = 'open';
create index if not exists verification_requests_subject_idx
  on public.verification_requests (subject_id, requested_at desc);
alter table public.verification_requests enable row level security;
revoke all on public.verification_requests from public, anon, authenticated;
grant select on public.verification_requests to authenticated;
create policy verification_requests_select_own on public.verification_requests
  for select to authenticated using (subject_id = (select auth.uid()));
comment on table public.verification_requests is
  'A reviewer asking one person for one more photo (a selfie holding their ID) with the reason, and the photo they sent back. Written only through request_selfie_with_id and answer_verification_request.';

alter table public.agent_documents add column if not exists request_id uuid
  references public.verification_requests(id) on delete set null;
comment on column public.agent_documents.request_id is
  'Set when the document answers a reviewer''s request (a selfie holding the ID).';

-- The reviewer asks. Staff with kyc_review; never about themselves.
create or replace function public.request_selfie_with_id(p_subject uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := auth.uid();
  new_id uuid;
begin
  if actor is null or not private.staff_can(actor, 'kyc_review') then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_subject is null or p_subject = actor then return jsonb_build_object('status', 'own_document'); end if;
  if p_message is null or length(btrim(p_message)) not between 12 and 600 then
    return jsonb_build_object('status', 'needs_a_message');
  end if;
  if exists (select 1 from public.verification_requests r where r.subject_id = p_subject and r.status = 'open') then
    return jsonb_build_object('status', 'already_asked');
  end if;
  insert into public.verification_requests (subject_id, message, requested_by)
  values (p_subject, btrim(p_message), actor) returning id into new_id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'kyc.request.selfie_with_id', 'verification_request', new_id::text,
          jsonb_build_object('subject_user', p_subject));
  perform private.notify(p_subject, 'agent', 'One more photo, please', btrim(p_message), '/verification');
  return jsonb_build_object('status', 'ok', 'id', new_id);
end;
$fn$;
revoke all on function public.request_selfie_with_id(uuid, text) from public, anon;
grant execute on function public.request_selfie_with_id(uuid, text) to authenticated;

-- The person answers with the photo already in their own folder.
create or replace function public.answer_verification_request(p_request uuid, p_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uid uuid := auth.uid();
  req public.verification_requests%rowtype;
  replaced uuid;
  new_doc uuid;
begin
  if uid is null then return jsonb_build_object('status', 'signed_out'); end if;
  select * into req from public.verification_requests where id = p_request for update;
  if req.id is null or req.subject_id <> uid then return jsonb_build_object('status', 'not_found'); end if;
  if req.status <> 'open' then return jsonb_build_object('status', 'closed'); end if;
  if p_path is null or p_path not like uid::text || '/%' or p_path like '%..%'
     or p_path !~* '\.(jpg|jpeg|png|webp|heic|heif)$' then
    return jsonb_build_object('status', 'not_yours');
  end if;

  -- The selfie it replaces: the newest current one, so the doubtful photo
  -- leaves the identity step and this one takes its place.
  select d.id into replaced from public.agent_documents d
   where d.uploader_id = uid and d.kind = 'selfie'
     and not exists (select 1 from public.agent_documents s where s.supersedes_id = d.id)
   order by d.uploaded_at desc limit 1;

  insert into public.agent_documents (uploader_id, kind, storage_path, supersedes_id, request_id)
  values (uid, 'selfie', p_path, replaced, req.id) returning id into new_doc;
  update public.verification_requests
     set status = 'answered', answered_at = now(), document_id = new_doc
   where id = req.id;
  return jsonb_build_object('status', 'ok', 'document_id', new_doc);
end;
$fn$;
revoke all on function public.answer_verification_request(uuid, text) from public, anon;
grant execute on function public.answer_verification_request(uuid, text) to authenticated;
