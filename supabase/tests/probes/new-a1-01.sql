-- NEW-A1-01: once a listing is through review its photographs, videos and
-- amenities are fixed for the owner, over the API and in storage: no insert,
-- reorder, delete, or overwrite of the stored bytes behind an approved photo.
-- While the listing is a draft all of it works; staff can still act.
do $$
declare
  member constant uuid := gen_random_uuid(); -- a throwaway lister, see the 17 October 2026 note below
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  agent uuid;
  lid uuid := gen_random_uuid();
  photo uuid;
  amenity uuid;
  path text;
  n int;
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
  select id into amenity from public.amenities limit 1;
  -- 17 October 2026: the QA member now holds a live agents row (one side per
  -- account), so inserting a second one failed on agents_user_id_key before
  -- anything was asserted. The lister is a throwaway account made here, an
  -- ordinary account with no agents row exactly as the QA member was when this
  -- probe was written, rolled back with everything else.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'probe-new-a1-01-member-' || member || '@example.invalid', '{}', '{}', now(), now());
  insert into public.agents (user_id, display_name) values (member, 'Probe NEW-A1-01 lister') returning id into agent;
  path := member::text || '/' || lid::text || '/probe-new-a1-01.jpg';
  insert into storage.objects (bucket_id, name, owner_id) values ('listing-photos', path, member::text);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);

  -- CONTROL: a draft's media is the owner's to change.
  insert into public.listings (id, agent_id, status, title, property_type) values (lid, agent, 'DRAFT', 'Probe NEW-A1-01', 'apartment');
  insert into public.listing_photos (listing_id, storage_path, position) values (lid, path, 0) returning id into photo;
  insert into public.listing_photos (listing_id, storage_path, position) values (lid, path || '.2', 1);
  update public.listing_photos set position = 2 where listing_id = lid and position = 1;
  insert into public.listing_amenities (listing_id, amenity_id) values (lid, amenity);
  update storage.objects set metadata = '{"probe":1}' where bucket_id = 'listing-photos' and name = path;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL new-a1-01: owner storage update on a draft rows=%', n; end if;

  update public.listings set status = 'SUBMITTED' where id = lid;
  -- SCUML item 17 (live 29 Sep): an agent listing is published only on an
  -- approved mandate. It is filed here as the platform files it, outside the
  -- API role, and the admin's publish below is then the real review path.
  reset role;
  insert into public.listing_mandates (listing_id, kind, principal_name, review_status, reviewed_by, reviewed_at,
         principal_relationship, principal_verified_how, principal_verified_by, principal_verified_at)
  select id, 'letting', 'Probe Principal', 'approved', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now(),
         'owner', 'call_back', '03f3dd52-ea28-4852-9abe-e5b0a67c2a43', now()
    from public.listings where id = lid and listing_role <> 'owner' and not private.listing_has_live_mandate(id);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  update public.listings set status = 'PUBLISHED', reviewer_id = admin, reviewed_at = now(), published_at = now() where id = lid;

  -- REFUSALS: the owner changes what was reviewed.
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  begin insert into public.listing_photos (listing_id, storage_path, position) values (lid, path || '.swap', 5);
    raise exception 'PROBE_FAIL new-a1-01: owner added a photo to a live listing';
  exception when insufficient_privilege then null; end;
  begin update public.listing_photos set position = 9 where id = photo;
    raise exception 'PROBE_FAIL new-a1-01: owner reordered a live listing''s photos';
  exception when insufficient_privilege then null; end;
  begin delete from public.listing_photos where id = photo;
    raise exception 'PROBE_FAIL new-a1-01: owner removed a live listing''s photo';
  exception when insufficient_privilege then null; end;
  begin delete from public.listing_amenities where listing_id = lid;
    raise exception 'PROBE_FAIL new-a1-01: owner removed a live listing''s amenity';
  exception when insufficient_privilege then null; end;
  begin insert into public.listing_amenities (listing_id, amenity_id)
    select lid, a.id from public.amenities a where a.id <> amenity limit 1;
    raise exception 'PROBE_FAIL new-a1-01: owner added an amenity to a live listing';
  exception when insufficient_privilege then null; end;
  update storage.objects set metadata = '{"probe":2}' where bucket_id = 'listing-photos' and name = path;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'PROBE_FAIL new-a1-01: owner overwrote a live photo object rows=%', n; end if;

  -- CONTROL: a non-API caller (service role, definer functions, postgres)
  -- still acts on a live listing's media. (listing_photos has no admin RLS
  -- policy, so staff remove photos through the service role.)
  reset role;
  delete from public.listing_photos where listing_id = lid and position = 2;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL new-a1-01: service photo removal rows=%', n; end if;

  -- CONTROL: back to a draft, the owner may change it again.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  update public.listings set status = 'DRAFT' where id = lid;
  update public.listing_photos set position = 3 where id = photo;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL new-a1-01: owner reorder after unpublish rows=%', n; end if;
  update storage.objects set metadata = '{"probe":3}' where bucket_id = 'listing-photos' and name = path;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL new-a1-01: owner storage update after unpublish rows=%', n; end if;

  raise exception 'PROBE_OK new-a1-01';
end
$$;
