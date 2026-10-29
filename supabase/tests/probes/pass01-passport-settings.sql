-- PASS01 (pending migration pass01_passport_settings): a member's passport
-- switches are theirs alone.
--  1. a member writes and reads their own row (the control)
--  2. no member reads, writes or takes over another member's row
--  3. a line the passport does not have is refused by the constraint
--  4. anon has no way in, and no member can remove a row
--  5. every explicit V-100 choice was carried over as it stood
-- Everything is rolled back by the final raise.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  tag text := substr(md5(random()::text), 1, 8);
  n int; ok boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'probe-pass01-' || x.k || '-' || tag || '@example.invalid', '{}', '{}', now(), now()
    from (values (a, 'a'), (b, 'b')) as x(id, k);

  -- 1. The control: A writes and reads A's own row.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.passport_settings (user_id, enabled, hidden_lines) values (a, true, array['photo', 'reviews']);
  update public.passport_settings set enabled = false where user_id = a;
  select count(*) into n from public.passport_settings where user_id = a and enabled = false and hidden_lines = array['photo', 'reviews'];
  if n <> 1 then raise exception 'PROBE_FAIL pass01-passport-settings 1: a member could not write and read their own row'; end if;

  -- 2. A cannot write B's row, take over B's row, or read it.
  ok := false;
  begin insert into public.passport_settings (user_id, enabled) values (b, false);
  exception when others then ok := sqlstate = '42501'; end;
  if not ok then raise exception 'PROBE_FAIL pass01-passport-settings 2: a member wrote another member''s switches'; end if;
  reset role;
  insert into public.passport_settings (user_id, enabled, hidden_lines) values (b, true, array['languages']);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.passport_settings where user_id = b;
  if n <> 0 then raise exception 'PROBE_FAIL pass01-passport-settings 2: a member read another member''s switches'; end if;
  update public.passport_settings set enabled = false, hidden_lines = '{}' where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'PROBE_FAIL pass01-passport-settings 2: a member changed another member''s switches'; end if;

  -- 3. A line the passport does not have is refused (23514), even for the owner.
  ok := false;
  begin update public.passport_settings set hidden_lines = array['phone'] where user_id = a;
  exception when others then ok := sqlstate = '23514'; end;
  if not ok then raise exception 'PROBE_FAIL pass01-passport-settings 3: a line the passport does not have was accepted'; end if;
  reset role;

  -- 4. anon has no way in; a member has no grant to remove a row.
  if has_table_privilege('anon', 'public.passport_settings', 'select')
     or has_table_privilege('anon', 'public.passport_settings', 'insert')
     or has_table_privilege('anon', 'public.passport_settings', 'update') then
    raise exception 'PROBE_FAIL pass01-passport-settings 4: anon can reach the switches';
  end if;
  if has_table_privilege('authenticated', 'public.passport_settings', 'delete') then
    raise exception 'PROBE_FAIL pass01-passport-settings 4: a member can remove a row';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.passport_settings'::regclass) then
    raise exception 'PROBE_FAIL pass01-passport-settings 4: row level security is off';
  end if;

  -- (Check 5, that every V-100 choice was carried over, left with the old table: rt02 dropped
  -- public.renter_passports on 29 October 2026 after the guard confirmed the copy.)

  raise exception 'PROBE_OK pass01-passport-settings';
end
$$;
