set lock_timeout = '5s';

-- The webhook (service role) records what Dojah said and what the machine
-- decided (lib/identity/dojah/result.ts). The machine may pass or send to
-- review, never refuse. A check a person already decided is never moved by a
-- later delivery. Answers the final status, or 'not_found' / 'decided'.
create or replace function public.record_dojah_check(
  p_check uuid,
  p_status text,
  p_dojah_reference text,
  p_id_type text,
  p_legal_name text,
  p_date_of_birth text,
  p_nin_hmac text,
  p_bvn_hmac text,
  p_selfie_match numeric,
  p_liveness numeric,
  p_document_type text,
  p_country text,
  p_proxy boolean,
  p_reasons text[],
  p_files jsonb,
  p_dashboard_url text,
  p_aml jsonb,
  p_summary jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  c public.identity_checks%rowtype;
  final text := p_status;
  matched text;
  agent uuid;
  extra text[] := '{}';
begin
  if p_status not in ('waiting', 'passed', 'review', 'retry', 'abandoned') then return 'invalid'; end if;
  select * into c from public.identity_checks where id = p_check for update;
  if c.id is null then return 'not_found'; end if;
  if c.status in ('approved', 'refused', 'passed') then return 'decided'; end if;

  update public.identity_checks set
    status = p_status,
    dojah_reference = coalesce(nullif(btrim(p_dojah_reference), ''), dojah_reference),
    id_type = coalesce(p_id_type, id_type),
    legal_name = coalesce(nullif(btrim(p_legal_name), ''), legal_name),
    date_of_birth = coalesce(p_date_of_birth, date_of_birth),
    nin_hmac = coalesce(p_nin_hmac, nin_hmac),
    bvn_hmac = coalesce(p_bvn_hmac, bvn_hmac),
    selfie_match = coalesce(p_selfie_match, selfie_match),
    liveness = coalesce(p_liveness, liveness),
    document_type = coalesce(p_document_type, document_type),
    country = coalesce(p_country, country),
    proxy = coalesce(p_proxy, proxy),
    reasons = coalesce(p_reasons, '{}'),
    files = files || coalesce(p_files, '{}'::jsonb),
    dashboard_url = coalesce(p_dashboard_url, dashboard_url),
    aml = coalesce(p_aml, aml),
    summary = coalesce(p_summary, summary),
    updated_at = now()
  where id = c.id;

  if p_status = 'passed' then
    matched := private.dojah_match_identity(c.id, null);
    if matched = 'nin_elsewhere' then
      extra := array['This NIN or BVN is already matched to another Vallo account.'];
    elsif matched = 'other_nin' then
      extra := array['A different NIN or BVN from the one already matched to this account.'];
    end if;
    if matched in ('nin_elsewhere', 'other_nin', 'not_found') then
      final := 'review';
      update public.identity_checks set status = 'review', reasons = extra || reasons where id = c.id;
    end if;
  end if;

  if final = 'review' then
    select a.id into agent from public.agents a where a.user_id = c.subject_id and not a.is_demo;
    if agent is not null and not exists (select 1 from public.agent_verification_checks v
                                          where v.agent_id = agent and v.kind = 'identity' and v.status = 'passed') then
      perform private.record_verification_check(agent, 'identity', 'pending',
        'The Dojah check did not settle it on its own. Somebody should look at it on the KYC desk.', null);
    end if;
  end if;

  if final = 'passed' then
    perform private.notify(c.subject_id, 'agent', 'Your identity is confirmed',
      'Your ID and selfie matched. Thank you.', '/verification');
  elsif final = 'review' then
    perform private.notify(c.subject_id, 'agent', 'Your check is with our team',
      'A person on our team will look at your ID check and tell you.', '/verification');
  end if;
  return final;
end;
$fn$;
revoke all on function public.record_dojah_check(uuid, text, text, text, text, text, text, text, numeric, numeric, text, text, boolean, text[], jsonb, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_dojah_check(uuid, text, text, text, text, text, text, text, numeric, numeric, text, text, boolean, text[], jsonb, text, jsonb, jsonb) to service_role;
