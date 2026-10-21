-- APPLIED 21 October 2026. NOBODY DECIDES THEIR OWN CASE, part 1: moderation and credentials.
-- Rebased on the live bodies before applying (the earlier draft would have replaced the live
-- permission check in record_credential, private.staff_can(actor, 'kyc_review'), with an older
-- admin-role check, and dropped the removed_at stamp that moderation_decide sets on posts).
-- Adds only: own_content (a moderator never releases or removes their own post, story, comment
-- or bio) and own_record (nobody records a register check on themselves).
set lock_timeout = '5s';

-- 1. from 20260929012228_moderation_staff_decisions_land_through_moderation_decide.sql
create or replace function public.moderation_decide(p_target text, p_id uuid, p_decision text, p_reason text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $fn$
declare
  actor  uuid := (select auth.uid());
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
  n      integer := 0;
begin
  if actor is null or not private.staff_can(actor, 'moderation') then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_id is null or p_target not in ('post', 'story', 'comment', 'bio')
     or p_decision not in ('RELEASE', 'REMOVE')
     or (reason is not null and char_length(reason) > 400) then
    return jsonb_build_object('status', 'invalid');
  end if;
  if p_decision = 'REMOVE' and reason is null then
    return jsonb_build_object('status', 'reason_needed');
  end if;
  -- NOBODY DECIDES THEIR OWN WORDS. A moderator whose own post, story,
  -- comment or bio is held leaves it for another moderator.
  if (p_target = 'bio' and p_id = actor)
     or (p_target = 'post' and exists (select 1 from public.posts x where x.id = p_id and x.author_id = actor))
     or (p_target = 'story' and exists (select 1 from public.stories x where x.id = p_id and x.author_id = actor))
     or (p_target = 'comment' and exists (select 1 from public.story_comments x where x.id = p_id and x.author_id = actor)) then
    return jsonb_build_object('status', 'own_content');
  end if;

  perform set_config('vallo.moderation_actor', actor::text, true);

  if p_target = 'bio' then
    update public.social_profiles
       set bio_status = case when p_decision = 'RELEASE' then 'LIVE' else 'REMOVED' end::public.social_status,
           bio = case when p_decision = 'REMOVE' then null else bio end
     where user_id = p_id and bio_status = 'HELD'::public.social_status;
  elsif p_target = 'post' then
    update public.posts
       set status = case when p_decision = 'RELEASE' then 'LIVE' else 'REMOVED' end::public.social_status,
           hold_reason = case when p_decision = 'REMOVE' then reason end,
           hidden_by = case when p_decision = 'REMOVE' then actor end,
           removed_at = case when p_decision = 'REMOVE' then now() else removed_at end
     where id = p_id and status = 'HELD'::public.social_status;
  elsif p_target = 'story' then
    update public.stories
       set status = case when p_decision = 'RELEASE' then 'LIVE' else 'REMOVED' end::public.social_status,
           hold_reason = case when p_decision = 'REMOVE' then reason end,
           hidden_by = case when p_decision = 'REMOVE' then actor end,
           removed_at = case when p_decision = 'REMOVE' then now() else removed_at end
     where id = p_id and status = 'HELD'::public.social_status;
  else
    update public.story_comments
       set status = case when p_decision = 'RELEASE' then 'LIVE' else 'REMOVED' end::public.social_status,
           hold_reason = case when p_decision = 'REMOVE' then reason end
     where id = p_id and status = 'HELD'::public.social_status;
  end if;
  get diagnostics n = row_count;

  perform set_config('vallo.moderation_actor', '', true);

  if n = 0 then
    return jsonb_build_object('status', 'gone');
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor,
          case when p_decision = 'RELEASE' then 'moderation.release' else 'moderation.remove' end,
          p_target, p_id::text,
          jsonb_build_object('decision', p_decision, 'reason', reason));

  return jsonb_build_object('status', 'ok');
end;
$fn$;

-- 8. from 20260928224407_v87_lasrera_esvarbon_and_cac_as_dated_credentials.sql
create or replace function public.record_credential(
  p_subject uuid, p_kind text, p_number text, p_company text, p_source text, p_register_name text
)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not private.staff_can(actor, 'kyc_review') then
    return 'forbidden';
  end if;
  -- Nobody records a register check on themselves.
  if p_subject = actor then return 'own_record'; end if;
  if p_kind not in ('lasrera', 'esvarbon', 'cac_director') then return 'invalid'; end if;
  if p_number is null or length(btrim(p_number)) < 2 then return 'invalid'; end if;
  if (p_kind = 'cac_director') <> (p_company is not null and length(btrim(p_company)) >= 2) then return 'invalid'; end if;
  /* This is the desk's door, and the desk reads registers by hand. The
     aggregator will write through its own service-role path, so a member of
     staff cannot claim an aggregator check here, and a CAC directorship,
     which only the aggregator can see, is refused. */
  if coalesce(p_source, 'register_by_hand') <> 'register_by_hand' then return 'invalid'; end if;
  if p_kind = 'cac_director' then return 'needs_aggregator'; end if;
  if p_register_name is null or length(btrim(p_register_name)) < 2 then return 'no_name'; end if;

  insert into public.credentials (subject_id, kind, number, company_name, register_name, source, checked_at, checked_by)
  values (p_subject, p_kind, btrim(p_number), nullif(btrim(coalesce(p_company, '')), ''),
          nullif(btrim(coalesce(p_register_name, '')), ''),
          'register_by_hand', now(), actor)
  on conflict (subject_id, kind) do update
    set number = excluded.number, company_name = excluded.company_name, register_name = excluded.register_name,
        source = excluded.source, checked_at = now(), checked_by = actor;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'credential.checked', 'user', p_subject::text,
          jsonb_build_object('kind', p_kind, 'source', 'register_by_hand'));
  return 'recorded';
end;
$fn$;
