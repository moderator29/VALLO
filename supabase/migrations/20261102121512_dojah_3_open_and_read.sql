set lock_timeout = '5s';

-- The signed-in person opens a check. Answers jsonb:
--   {status:'opened', id}    a new row (or the open one from the last two hours)
--   {status:'verified'}      already matched: nothing to do
--   {status:'in_review'}     a check is with the desk
--   {status:'limit'}         three opened today
--   {status:'signed_out'}
create or replace function public.open_identity_check(p_environment text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uid uuid := auth.uid();
  existing uuid;
  opened_today integer;
  new_id uuid;
begin
  if uid is null then return jsonb_build_object('status', 'signed_out'); end if;
  if p_environment not in ('sandbox', 'live') then return jsonb_build_object('status', 'invalid'); end if;
  perform pg_advisory_xact_lock(hashtextextended('open_identity_check:' || uid::text, 0));

  if exists (select 1 from public.identity_verifications v where v.subject_id = uid and v.outcome = 'matched') then
    return jsonb_build_object('status', 'verified');
  end if;
  if exists (select 1 from public.identity_checks c where c.subject_id = uid and c.status in ('review', 'waiting')
              and c.created_at > now() - interval '7 days') then
    return jsonb_build_object('status', 'in_review');
  end if;

  select c.id into existing from public.identity_checks c
   where c.subject_id = uid and c.status = 'opened' and c.environment = p_environment
     and c.created_at > now() - interval '2 hours'
   order by c.created_at desc limit 1;
  if existing is not null then return jsonb_build_object('status', 'opened', 'id', existing); end if;

  select count(*) into opened_today from public.identity_checks c
   where c.subject_id = uid and c.created_at > now() - interval '24 hours';
  if opened_today >= 3 then return jsonb_build_object('status', 'limit'); end if;

  insert into public.identity_checks (subject_id, environment) values (uid, p_environment) returning id into new_id;
  return jsonb_build_object('status', 'opened', 'id', new_id);
end;
$fn$;
revoke all on function public.open_identity_check(text) from public, anon;
grant execute on function public.open_identity_check(text) to authenticated;

-- What the person sees about their own latest check: never the hashes, the
-- scores or the reasons (those are for the desk), only where it stands.
create or replace function public.my_identity_check()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select case
    when auth.uid() is null then jsonb_build_object('status', 'signed_out')
    when exists (select 1 from public.identity_verifications v where v.subject_id = auth.uid() and v.outcome = 'matched')
      then jsonb_build_object('status', 'verified',
             'legal_name', (select v.legal_name from public.identity_verifications v
                             where v.subject_id = auth.uid() and v.outcome = 'matched' order by v.decided_at desc limit 1))
    else coalesce(
      (select jsonb_build_object('status', c.status, 'id', c.id, 'at', c.updated_at,
                                 'note', case when c.status = 'refused' then c.decision_note end)
         from public.identity_checks c where c.subject_id = auth.uid()
        order by c.created_at desc limit 1),
      jsonb_build_object('status', 'none'))
  end;
$fn$;
revoke all on function public.my_identity_check() from public, anon;
grant execute on function public.my_identity_check() to authenticated;
