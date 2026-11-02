set lock_timeout = '5s';

-- Records a matched identity for a Dojah check: one account per NIN or BVN,
-- one identity per person. Answers 'matched', 'already' (same person, same
-- number: nothing new written), 'nin_elsewhere' or 'other_nin'. Moves the
-- agent identity rung when the subject is an agent. p_actor null = machine.
create or replace function private.dojah_match_identity(p_check uuid, p_actor uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  c public.identity_checks%rowtype;
  agent uuid;
  mine public.identity_verifications%rowtype;
begin
  select * into c from public.identity_checks where id = p_check;
  if c.id is null then return 'not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('identity_match:' || c.subject_id::text, 0));

  if exists (select 1 from public.identity_verifications v
              where v.outcome = 'matched' and v.subject_id <> c.subject_id
                and ((c.nin_hmac is not null and v.nin_hmac = c.nin_hmac)
                  or (c.bvn_hmac is not null and v.bvn_hmac = c.bvn_hmac))) then
    return 'nin_elsewhere';
  end if;

  select * into mine from public.identity_verifications v
   where v.subject_id = c.subject_id and v.outcome = 'matched'
   order by v.decided_at desc limit 1;
  if mine.id is not null then
    if (c.nin_hmac is not null and mine.nin_hmac is not null and mine.nin_hmac <> c.nin_hmac)
       or (c.bvn_hmac is not null and mine.bvn_hmac is not null and mine.bvn_hmac <> c.bvn_hmac) then
      return 'other_nin';
    end if;
    -- Same person already matched: keep the first row, fill a missing hash.
    update public.identity_verifications
       set nin_hmac = coalesce(nin_hmac, c.nin_hmac), bvn_hmac = coalesce(bvn_hmac, c.bvn_hmac)
     where id = mine.id;
  else
    insert into public.identity_verifications (subject_id, method, outcome, legal_name, nin_hmac, bvn_hmac, provider_ref, note)
    values (c.subject_id, 'dojah', 'matched', c.legal_name, c.nin_hmac, c.bvn_hmac, coalesce(c.dojah_reference, c.id::text),
            case when p_actor is null
                 then 'Government ID and selfie matched through Dojah.'
                 else 'Government ID and selfie checked through Dojah and approved by review.' end);
  end if;

  select a.id into agent from public.agents a where a.user_id = c.subject_id and not a.is_demo;
  if agent is not null then
    perform private.record_verification_check(agent, 'identity', 'passed',
      case when p_actor is null
           then 'Identity matched by Dojah (government ID and selfie, reference ' || coalesce(c.dojah_reference, c.id::text) || ').'
           else 'Dojah check approved by review (reference ' || coalesce(c.dojah_reference, c.id::text) || ').' end,
      p_actor);
  end if;
  return case when mine.id is not null then 'already' else 'matched' end;
exception when unique_violation then
  return 'nin_elsewhere';
end;
$fn$;
revoke all on function private.dojah_match_identity(uuid, uuid) from public, anon, authenticated;
