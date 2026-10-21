-- DB-01: a member cannot publish or verify their own business, property or
-- room; the owner's own steps (draft, edit, submit, close) still work; an
-- admin writing through their own signed-in client still decides.
--
-- 17 October 2026: since pov08 (20261013212007, decision 23 of
-- DECISIONS_2026-10-13.md) a business moves to SUBMITTED only with the Terms,
-- the Privacy Policy and the pay-on-Vallo statement in `consents.agreements`,
-- so the wizard's first save carries them as saveHostDraft writes them
-- (lib/host/actions.ts: terms, privacy, host_agreement, pay_on_vallo, each
-- {document, version, at}). The submit failed on acceptance_required before.
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  biz uuid;
  forged uuid;
  acc uuid;
  room uuid;
  n int;
  r record;
  accepted constant jsonb := jsonb_build_object('terms', '2026-10-17T09:00:00Z', 'agreements', jsonb_build_array(
    jsonb_build_object('document', 'terms', 'version', '2026-10-13', 'at', '2026-10-17T09:00:00Z'),
    jsonb_build_object('document', 'privacy', 'version', '2026-09-25', 'at', '2026-10-17T09:00:00Z'),
    jsonb_build_object('document', 'host_agreement', 'version', '2026-10-17', 'at', '2026-10-17T09:00:00Z'),
    jsonb_build_object('document', 'pay_on_vallo', 'version', '2026-10-13', 'at', '2026-10-17T09:00:00Z')));
begin
  -- 29 September: the console's second factor. An admin or a staff member
  -- holds their role only on a session that proved a security key, so this
  -- probe's session carries one for every admin and for the QA member (who
  -- some probes make staff), rolled back with everything else.
  insert into public.console_step_ups (user_id, session_id, expires_at)
  select console_probe_uid, '00000000-0000-4000-8000-00000000c0de', now() + interval '1 hour'
    from (select user_id from public.user_roles where role in ('admin', 'super_admin')
          union select '03f3dd52-ea28-4852-9abe-e5b0a67c2a43'::uuid
          union select '957b3bd2-cce3-425d-bba9-5cd876ca3d62'::uuid) s(console_probe_uid)
  on conflict (user_id, session_id) do update set expires_at = excluded.expires_at;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);

  -- CONTROL: the host wizard's first save (lib/host/actions.ts) as the member.
  insert into public.businesses (owner_id, source, status, kind, name, slug, consents)
  values (member, 'first_party', 'DRAFT', 'hotel', 'Probe DB-01 hotel', 'probe-db01-' || gen_random_uuid(), accepted)
  returning id into biz;
  if biz is null then raise exception 'PROBE_FAIL db-01: owner draft insert returned nothing'; end if;

  -- REFUSAL: a business created straight into PUBLISHED.
  begin
    insert into public.businesses (owner_id, kind, name, slug, status, verification_tier, source, published_at)
    values (member, 'restaurant', 'Probe DB-01 forged', 'probe-db01-f-' || gen_random_uuid(), 'PUBLISHED', 3, 'first_party', now());
    raise exception 'PROBE_FAIL db-01: member inserted a PUBLISHED business';
  exception when insufficient_privilege then null;
  end;

  -- A draft that names a tier, a reviewer and a publish date keeps none of them.
  insert into public.businesses (owner_id, kind, name, slug, status, verification_tier, verified, reviewer_id, reviewed_at, published_at, is_demo)
  values (member, 'restaurant', 'Probe DB-01 forged draft', 'probe-db01-g-' || gen_random_uuid(), 'DRAFT', 3, true, member, now(), now(), false)
  returning id into forged;
  -- Read as the service role: a member no longer selects moderator columns
  -- (DB-10 step 2); what matters is what was stored.
  reset role;
  select verification_tier, verified, reviewer_id, reviewed_at, published_at into r from public.businesses where id = forged;
  set local role authenticated;
  if r.verification_tier <> 0 or r.verified or r.reviewer_id is not null or r.reviewed_at is not null or r.published_at is not null then
    raise exception 'PROBE_FAIL db-01: forged draft kept a moderator column: %', row_to_json(r);
  end if;

  -- REFUSALS: each moderator column and each forbidden status on update.
  begin update public.businesses set verification_tier = 3 where id = biz;
    raise exception 'PROBE_FAIL db-01: owner set verification_tier';
  exception when insufficient_privilege then null; end;
  begin update public.businesses set verified = true where id = biz;
    raise exception 'PROBE_FAIL db-01: owner set verified';
  exception when insufficient_privilege then null; end;
  begin update public.businesses set reviewer_id = member, reviewed_at = now() where id = biz;
    raise exception 'PROBE_FAIL db-01: owner set reviewer';
  exception when insufficient_privilege then null; end;
  begin update public.businesses set published_at = now() where id = biz;
    raise exception 'PROBE_FAIL db-01: owner set published_at';
  exception when insufficient_privilege then null; end;
  begin update public.businesses set status = 'PUBLISHED' where id = biz;
    raise exception 'PROBE_FAIL db-01: owner set PUBLISHED';
  exception when insufficient_privilege then null; end;
  begin update public.businesses set status = 'APPROVED' where id = biz;
    raise exception 'PROBE_FAIL db-01: owner set APPROVED';
  exception when insufficient_privilege then null; end;

  -- CONTROL: descriptive edit.
  update public.businesses set description = 'Probe description' where id = biz;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-01: owner description edit rows=%', n; end if;

  -- Property and room under the member's draft business.
  insert into public.accommodations (business_id, name, slug, status)
  values (biz, 'Probe DB-01 property', 'probe-db01-a-' || gen_random_uuid(), 'DRAFT')
  returning id into acc;
  begin
    insert into public.accommodations (business_id, name, slug, status, featured)
    values (biz, 'Probe DB-01 live property', 'probe-db01-b-' || gen_random_uuid(), 'PUBLISHED', true);
    raise exception 'PROBE_FAIL db-01: owner inserted a PUBLISHED property';
  exception when insufficient_privilege then null; end;
  begin update public.accommodations set featured = true where id = acc;
    raise exception 'PROBE_FAIL db-01: owner featured the property';
  exception when insufficient_privilege then null; end;
  begin update public.accommodations set status = 'PUBLISHED' where id = acc;
    raise exception 'PROBE_FAIL db-01: owner published the property';
  exception when insufficient_privilege then null; end;
  update public.accommodations set description = 'Probe', star_rating = 3 where id = acc;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-01: owner property edit rows=%', n; end if;

  insert into public.room_types (accommodation_id, name, category, sleeps, units_total, base_rate_minor, status)
  values (acc, 'Probe room', 'double', 2, 1, 5000000, 'DRAFT')
  returning id into room;
  begin update public.room_types set status = 'PUBLISHED' where id = room;
    raise exception 'PROBE_FAIL db-01: owner published the room';
  exception when insufficient_privilege then null; end;

  -- CONTROL: submit (submitHostApplication), then close back to a draft
  -- (closeBusiness), then submit again.
  update public.businesses set status = 'SUBMITTED', submitted_at = now()
   where id = biz and owner_id = member and status in ('DRAFT', 'MORE_INFO_REQUIRED');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-01: owner submit rows=%', n; end if;
  if (select submitted_at from public.businesses where id = biz) is null then
    raise exception 'PROBE_FAIL db-01: submit left submitted_at empty';
  end if;
  update public.businesses set status = 'DRAFT' where id = biz and owner_id = member;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-01: owner close rows=%', n; end if;
  update public.businesses set status = 'SUBMITTED' where id = biz;

  -- REFUSAL: content edits once the application is with the reviewers.
  begin update public.businesses set description = 'changed after submit' where id = biz;
    raise exception 'PROBE_FAIL db-01: owner edited a submitted business';
  exception when insufficient_privilege then null; end;

  -- CONTROL: the admin decides through their own authenticated client.
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  update public.businesses
     set status = 'PUBLISHED', verification_tier = 3, reviewer_id = admin, reviewed_at = now(),
         review_notes = 'probe', published_at = now()
   where id = biz;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-01: admin publish rows=%', n; end if;
  update public.accommodations set status = 'PUBLISHED', published_at = now(), reviewer_id = admin, featured = true where id = acc;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-01: admin property publish rows=%', n; end if;
  update public.room_types set status = 'PUBLISHED' where id = room;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-01: admin room publish rows=%', n; end if;
  reset role;
  select status, verified, verification_tier into r from public.businesses where id = biz;
  set local role authenticated;
  if r.status <> 'PUBLISHED' or not r.verified or r.verification_tier <> 3 then
    raise exception 'PROBE_FAIL db-01: admin decision did not land: %', row_to_json(r);
  end if;

  -- REFUSALS: the owner rewrites what the reviewer published, or deletes it.
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  begin update public.businesses set name = 'Pay the deposit to 0123456789', phone = null where id = biz;
    raise exception 'PROBE_FAIL db-01: owner rewrote a live business';
  exception when insufficient_privilege then null; end;
  begin update public.accommodations set description = 'rewritten live' where id = acc;
    raise exception 'PROBE_FAIL db-01: owner rewrote a live property';
  exception when insufficient_privilege then null; end;
  begin update public.room_types set base_rate_minor = 1 where id = room;
    raise exception 'PROBE_FAIL db-01: owner repriced a live room';
  exception when insufficient_privilege then null; end;
  begin delete from public.room_types where id = room;
    raise exception 'PROBE_FAIL db-01: owner deleted a live room';
  exception when insufficient_privilege then null; end;
  begin delete from public.businesses where id = biz;
    raise exception 'PROBE_FAIL db-01: owner deleted a live business';
  exception when insufficient_privilege then null; end;

  -- CONTROL: the owner closes it (closeBusiness: properties first, then the
  -- business), and then edits the still-PUBLISHED room as part of the draft.
  update public.accommodations set status = 'DRAFT' where business_id = biz and status in ('PUBLISHED', 'APPROVED');
  update public.businesses set status = 'DRAFT' where id = biz and owner_id = member;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-01: owner unpublish rows=%', n; end if;
  update public.room_types set base_rate_minor = 6000000 where id = room;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-01: owner room edit under a draft business rows=%', n; end if;
  update public.businesses set description = 'edited as a draft again' where id = biz;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-01: owner edit after close rows=%', n; end if;
  delete from public.businesses where id = forged;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-01: owner delete of a draft business rows=%', n; end if;

  raise exception 'PROBE_OK db-01';
end
$$;
