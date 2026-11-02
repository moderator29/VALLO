set lock_timeout = '5s';

-- MANUAL VERIFICATION (2 November 2026). The reviewer types the name exactly
-- as printed on the ID when approving it. That name is what the bank account
-- name is matched against, and what the person's verified identity carries.
alter table public.agent_documents add column if not exists name_on_document text
  check (name_on_document is null or length(btrim(name_on_document)) between 2 and 200);
comment on column public.agent_documents.name_on_document is
  'The name exactly as printed on an identity document, typed by the reviewer who approved it. Staff only (set_document_name).';

create or replace function public.set_document_name(p_document uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := auth.uid();
  doc public.agent_documents%rowtype;
  owner_user uuid;
begin
  if actor is null or not private.staff_can(actor, 'kyc_review') then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_name is null or length(btrim(p_name)) not between 2 and 200 then
    return jsonb_build_object('status', 'invalid_name');
  end if;
  select * into doc from public.agent_documents where id = p_document for update;
  if doc.id is null then return jsonb_build_object('status', 'not_found'); end if;
  if doc.kind <> 'identity' then return jsonb_build_object('status', 'not_identity'); end if;
  owner_user := coalesce(doc.uploader_id,
    (select a.user_id from public.agent_applications a where a.id = doc.application_id));
  if owner_user = actor then return jsonb_build_object('status', 'own_document'); end if;
  if doc.review_status <> 'pending' then return jsonb_build_object('status', 'decided'); end if;
  update public.agent_documents set name_on_document = upper(regexp_replace(btrim(p_name), '\s+', ' ', 'g'))
   where id = doc.id;
  return jsonb_build_object('status', 'ok');
end;
$fn$;
revoke all on function public.set_document_name(uuid, text) from public, anon;
grant execute on function public.set_document_name(uuid, text) to authenticated;
