-- Two staff members, each sees and changes only their own conversations.
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.copilot_threads (desk, title, turns) values ('support', 'What needs me first?', '[{"role":"user","text":"hi"}]');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.copilot_threads (desk, title, turns) values ('console', 'Second person', '[]');
do $t$
declare n integer; touched integer;
begin
  select count(*) into n from public.copilot_threads;
  if n <> 1 then raise exception 'person two sees % rows, expected 1', n; end if;
  update public.copilot_threads set title = 'stolen' where title = 'What needs me first?';
  get diagnostics touched = row_count;
  if touched <> 0 then raise exception 'person two changed a row that is not theirs'; end if;
  delete from public.copilot_threads where title = 'What needs me first?';
  get diagnostics touched = row_count;
  if touched <> 0 then raise exception 'person two deleted a row that is not theirs'; end if;
  begin
    insert into public.copilot_threads (user_id, desk, title) values ('11111111-1111-1111-1111-111111111111', 'x', 'forged');
    raise exception 'a forged owner was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.copilot_threads (desk, title, turns) values ('x', 'bad', '{"a":1}');
    raise exception 'a non-array turns was accepted';
  exception when check_violation then null;
  end;
  raise notice 'E2E_OK';
end;
$t$;
reset role;
