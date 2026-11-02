set lock_timeout = '5s';

-- A person on the KYC desk decides a Dojah check in review (or overrides a
-- retry). The actor is auth.uid(), never an argument. Nobody decides their own.
-- Refusing needs a reason the person is sent word for word; it leaves the
-- identity rung pending (the document route stays open), it never fails it.
create or replace function public.decide_identity_check(p_check uuid, p_approve boolean, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := auth.uid();
  c public.identity_checks%rowtype;
  matched text;
  agent uuid;
begin
  if actor is null or not private.staff_can(actor, 'kyc_review') then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if not p_approve and (p_note is null or char_length(btrim(p_note)) < 8) then
    return jsonb_build_object('status', 'needs_a_reason');
  end if;
  select * into c from public.identity_checks where id = p_check for update;
  if c.id is null then return jsonb_build_object('status', 'not_found'); end if;
  if c.subject_id = actor then return jsonb_build_object('status', 'own_check'); end if;
  if c.status in ('approved', 'refused', 'passed') then return jsonb_build_object('status', 'decided'); end if;
  if c.status = 'opened' then return jsonb_build_object('status', 'not_finished'); end if;
  if p_approve and c.legal_name is null then return jsonb_build_object('status', 'no_record'); end if;

  if p_approve then
    matched := private.dojah_match_identity(c.id, actor);
    if matched in ('nin_elsewhere', 'other_nin', 'not_found') then
      return jsonb_build_object('status', matched);
    end if;
  else
    select a.id into agent from public.agents a where a.user_id = c.subject_id and not a.is_demo;
    if agent is not null and not exists (select 1 from public.agent_verification_checks v
                                          where v.agent_id = agent and v.kind = 'identity' and v.status = 'passed') then
      perform private.record_verification_check(agent, 'identity', 'pending',
        'Dojah check refused by review: ' || left(btrim(p_note), 400), actor);
    end if;
  end if;

  update public.identity_checks
     set status = case when p_approve then 'approved' else 'refused' end,
         decided_by = actor, decided_at = now(),
         decision_note = nullif(left(btrim(coalesce(p_note, '')), 1000), ''),
         updated_at = now()
   where id = c.id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, case when p_approve then 'kyc.identity_check.approved' else 'kyc.identity_check.refused' end,
          'identity_check', c.id::text,
          jsonb_build_object('subject_user', c.subject_id, 'dojah_reference', c.dojah_reference,
                             'reason', case when p_approve then null else btrim(p_note) end));

  perform private.notify(c.subject_id, 'agent',
    case when p_approve then 'Your identity is confirmed' else 'Your ID check needs redoing' end,
    case when p_approve then 'Our team checked your ID and selfie. Thank you.' else btrim(p_note) end,
    '/verification');
  return jsonb_build_object('status', 'ok', 'approved', p_approve);
end;
$fn$;
revoke all on function public.decide_identity_check(uuid, boolean, text) from public, anon;
grant execute on function public.decide_identity_check(uuid, boolean, text) to authenticated;
