alter table public.ai_action_proposals add column if not exists grant_epoch integer not null default 0;

create or replace function private.ai_kind_permission(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'viewing_request' then 'bookings_viewings'
    when 'reschedule_viewing' then 'bookings_viewings'
    when 'cancel_viewing' then 'bookings_viewings'
    when 'save_listing' then 'saved_prefs'
    when 'unsave_listing' then 'saved_prefs'
    when 'payment_review' then 'payment_assist'
    else null
  end
$$;

create or replace function public.ai_proposal_create(p_kind text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  perm text := private.ai_kind_permission(p_kind);
  epoch integer;
  h text;
  new_id uuid;
  exp timestamptz := now() + interval '10 minutes';
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if perm is null then
    perform private.ai_audit(uid, 'proposal_refused', null, null, 'refused', jsonb_build_object('reason', 'unknown_kind'));
    return jsonb_build_object('ok', false, 'reason', 'unknown_kind');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 4000 then
    return jsonb_build_object('ok', false, 'reason', 'bad_payload');
  end if;
  if not exists (
    select 1 from public.ai_assistant_settings s
      join public.ai_assistant_permissions p on p.user_id = s.user_id
     where s.user_id = uid and s.enabled and p.permission = perm and p.revoked_at is null
  ) then
    perform private.ai_audit(uid, 'proposal_denied', perm, p_kind, 'denied', '{}'::jsonb);
    return jsonb_build_object('ok', false, 'reason', 'not_granted');
  end if;

  select grant_epoch into epoch from public.ai_assistant_settings where user_id = uid;
  h := encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex');

  -- At most twenty open proposals per member: the oldest are cancelled, not removed.
  update public.ai_action_proposals set status = 'cancelled', decided_at = now()
   where id in (
     select id from public.ai_action_proposals
      where user_id = uid and status = 'pending'
      order by created_at desc offset 19
   );
  -- A newer identical proposal replaces an older open one.
  update public.ai_action_proposals set status = 'cancelled', decided_at = now()
   where user_id = uid and status = 'pending' and kind = p_kind and payload_hash = h;

  insert into public.ai_action_proposals (user_id, kind, payload, payload_hash, expires_at, grant_epoch)
  values (uid, p_kind, p_payload, h, exp, coalesce(epoch, 0))
  returning id into new_id;

  perform private.ai_audit(uid, 'proposal_created', perm, p_kind, 'ok', jsonb_build_object('proposal', new_id));
  return jsonb_build_object('ok', true, 'id', new_id, 'payload_hash', h, 'expires_at', exp);
end;
$$;

create or replace function public.ai_proposal_decide(p_id uuid, p_decision text, p_payload_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pr public.ai_action_proposals;
  perm text;
  current_epoch integer;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if p_decision not in ('confirm', 'cancel') then
    return jsonb_build_object('ok', false, 'reason', 'bad_decision');
  end if;
  select * into pr from public.ai_action_proposals where id = p_id and user_id = uid for update;
  if not found then
    perform private.ai_audit(uid, 'proposal_denied', null, null, 'denied', jsonb_build_object('reason', 'not_found'));
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  perm := private.ai_kind_permission(pr.kind);
  if pr.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_decided');
  end if;
  if pr.expires_at < now() then
    update public.ai_action_proposals set status = 'expired', decided_at = now() where id = pr.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if p_payload_hash is distinct from pr.payload_hash then
    perform private.ai_audit(uid, 'proposal_denied', perm, pr.kind, 'denied', jsonb_build_object('reason', 'hash_mismatch'));
    return jsonb_build_object('ok', false, 'reason', 'hash_mismatch');
  end if;

  if p_decision = 'cancel' then
    update public.ai_action_proposals set status = 'cancelled', decided_at = now() where id = pr.id;
    perform private.ai_audit(uid, 'proposal_cancelled', perm, pr.kind, 'ok', jsonb_build_object('proposal', pr.id));
    return jsonb_build_object('ok', true, 'decision', 'cancel', 'kind', pr.kind);
  end if;

  select grant_epoch into current_epoch from public.ai_assistant_settings where user_id = uid and enabled;
  if current_epoch is null or current_epoch <> pr.grant_epoch
     or not exists (
       select 1 from public.ai_assistant_permissions p
        where p.user_id = uid and p.permission = perm and p.revoked_at is null
     ) then
    update public.ai_action_proposals set status = 'cancelled', decided_at = now() where id = pr.id;
    perform private.ai_audit(uid, 'proposal_denied', perm, pr.kind, 'denied', jsonb_build_object('reason', 'revoked'));
    return jsonb_build_object('ok', false, 'reason', 'revoked');
  end if;

  update public.ai_action_proposals set status = 'confirmed', decided_at = now() where id = pr.id;
  perform private.ai_audit(uid, 'proposal_confirmed', perm, pr.kind, 'ok', jsonb_build_object('proposal', pr.id));
  return jsonb_build_object('ok', true, 'decision', 'confirm', 'kind', pr.kind, 'payload', pr.payload);
end;
$$;

create or replace function public.ai_proposal_result(p_id uuid, p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' or octet_length(p_result::text) > 2000 then
    return jsonb_build_object('ok', false, 'reason', 'bad_result');
  end if;
  update public.ai_action_proposals
     set result = p_result
   where id = p_id and user_id = uid and status = 'confirmed' and result is null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ai_proposal_retry(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pr public.ai_action_proposals;
  made jsonb;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into pr from public.ai_action_proposals where id = p_id and user_id = uid;
  if not found or pr.status <> 'confirmed' or coalesce(pr.result->>'ok', '') <> 'false' then
    return jsonb_build_object('ok', false, 'reason', 'not_retryable');
  end if;
  made := public.ai_proposal_create(pr.kind, pr.payload);
  return made;
end;
$$;

revoke all on function private.ai_kind_permission(text) from public, anon, authenticated;
revoke all on function public.ai_proposal_create(text, jsonb) from public, anon;
revoke all on function public.ai_proposal_decide(uuid, text, text) from public, anon;
revoke all on function public.ai_proposal_result(uuid, jsonb) from public, anon;
revoke all on function public.ai_proposal_retry(uuid) from public, anon;
grant execute on function public.ai_proposal_create(text, jsonb) to authenticated;
grant execute on function public.ai_proposal_decide(uuid, text, text) to authenticated;
grant execute on function public.ai_proposal_result(uuid, jsonb) to authenticated;
grant execute on function public.ai_proposal_retry(uuid) to authenticated;
