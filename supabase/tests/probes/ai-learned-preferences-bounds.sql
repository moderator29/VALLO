-- AI-LEARNED-PREFERENCES-BOUNDS. Needs 20261101164058_ai_learned_preferences_value_small.
--  1. an oversized value is refused by the database
--  2. a member cannot write another member's preference
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"03f3dd52-ea28-4852-9abe-e5b0a67c2a43","role":"authenticated"}', true);
  begin
    insert into public.ai_learned_preferences (user_id, key, value) values ('03f3dd52-ea28-4852-9abe-e5b0a67c2a43', 'probe:big', to_jsonb(repeat('x', 2000)));
    raise exception 'PROBE_FAIL: an oversized preference was stored';
  exception when check_violation then null; end;
  begin
    insert into public.ai_learned_preferences (user_id, key, value) values ('2255d905-0f31-437e-b719-aa2e4a18e03d', 'probe:other', '"x"');
    raise exception 'PROBE_FAIL: a member wrote another member''s preference';
  exception when insufficient_privilege then null; end;
  raise exception 'PROBE_OK preferences bounded and owner-only';
end $$;
