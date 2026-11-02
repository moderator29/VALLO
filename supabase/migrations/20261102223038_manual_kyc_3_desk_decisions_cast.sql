set lock_timeout = '5s';

-- THE VERIFICATION DESK COULD NOT DECIDE ANYTHING (found 2 November 2026).
-- review_kyc_document assigned a text CASE to the review_status enum column,
-- which Postgres refuses ("column is of type document_review_status but
-- expression is of type text"), so every Approve and Reject on /admin/kyc has
-- answered "service down" since 25 September 2026. The same function as
-- 20261102214610 with the one cast added; tested in a rolled-back transaction.
create or replace function private.review_kyc_document(acting_admin uuid, p_document uuid, p_approve boolean, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  doc public.agent_documents;
  owner_user uuid;
  target_agent uuid;
  rung text;
  group_kinds text[];
  all_approved boolean;
  has_identity boolean;
  id_name text;
begin
  if acting_admin is null or not private.staff_can(acting_admin, 'kyc_review') then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if not p_approve and (p_reason is null or char_length(btrim(p_reason)) < 8) then
    return jsonb_build_object('status', 'needs_a_reason');
  end if;

  select * into doc from public.agent_documents where id = p_document for update;
  if doc.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  owner_user := coalesce(
    doc.uploader_id,
    (select a.user_id from public.agent_applications a where a.id = doc.application_id)
  );
  if owner_user = acting_admin then
    return jsonb_build_object('status', 'own_document');
  end if;
  if p_approve and doc.kind = 'identity' and doc.name_on_document is null then
    return jsonb_build_object('status', 'needs_a_name');
  end if;

  update public.agent_documents
     set review_status = (case when p_approve then 'approved' else 'rejected' end)::public.document_review_status,
         reviewed_by = acting_admin,
         reviewed_at = now(),
         rejection_reason = case when p_approve then null else btrim(p_reason) end
   where id = doc.id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    acting_admin,
    case when p_approve then 'kyc.document.approved' else 'kyc.document.rejected' end,
    'agent_document', doc.id::text,
    jsonb_build_object(
      'kind', doc.kind,
      'subtype', doc.subtype,
      'subject_user', owner_user,
      'reason', case when p_approve then null else btrim(p_reason) end
    )
  );

  rung := case doc.kind when 'identity' then 'identity' when 'selfie' then 'identity' when 'address' then 'address' else null end;
  group_kinds := case rung when 'identity' then array['identity', 'selfie'] when 'address' then array['address'] else '{}'::text[] end;
  select a.id into target_agent from public.agents a where a.user_id = owner_user;

  if rung is not null and owner_user is not null then
    select bool_and(d.review_status = 'approved'),
           bool_or(d.kind = case rung when 'identity' then 'identity' else 'address' end and d.review_status = 'approved')
      into all_approved, has_identity
      from public.agent_documents d
     where d.kind = any (group_kinds)
       and coalesce(
             d.uploader_id,
             (select a2.user_id from public.agent_applications a2 where a2.id = d.application_id)
           ) = owner_user
       and not exists (select 1 from public.agent_documents s where s.supersedes_id = d.id);
    all_approved := coalesce(all_approved, false) and coalesce(has_identity, false);

    if target_agent is not null then
      perform private.record_verification_check(
        target_agent, rung,
        case when all_approved then 'passed' else 'pending' end,
        case when all_approved
             then case rung when 'identity' then 'ID and selfie approved by review.' else 'Documents approved by review.' end
             else 'Waiting on a document.' end,
        acting_admin
      );
    end if;

    if rung = 'identity' and all_approved
       and not exists (select 1 from public.identity_verifications v
                        where v.subject_id = owner_user and v.outcome = 'matched') then
      select d.name_on_document into id_name
        from public.agent_documents d
       where d.kind = 'identity' and d.review_status = 'approved' and d.name_on_document is not null
         and coalesce(d.uploader_id,
               (select a3.user_id from public.agent_applications a3 where a3.id = d.application_id)) = owner_user
       order by d.reviewed_at desc nulls last limit 1;
      insert into public.identity_verifications (subject_id, method, outcome, legal_name, provider_ref, note)
      values (owner_user, 'photo', 'matched', id_name, doc.id::text,
              'ID document and selfie checked by a person at Vallo.');
    end if;
  end if;

  if owner_user is not null then
    perform private.notify(
      owner_user, 'agent',
      case when p_approve then 'A document was approved' else 'A document needs redoing' end,
      case when p_approve
           then 'One of your verification documents has been accepted.'
           else btrim(p_reason) end,
      '/verification'
    );
  end if;

  return jsonb_build_object('status', 'ok', 'document_id', doc.id, 'approved', p_approve);
end;
$function$;
