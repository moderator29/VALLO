\set ON_ERROR_STOP 1
-- staff: D is admin; R is a Roommates moderator; S is support; K is kyc
insert into public.profiles (id, display_name) values ('00000000-0000-0000-0000-0000000000a1','Rita Mod'),('00000000-0000-0000-0000-0000000000a2','Sam Support'),('00000000-0000-0000-0000-0000000000a3','Kunle KYC') on conflict do nothing;
alter type public.staff_scope add value if not exists 'roommates';
insert into public.staff_grants values ('00000000-0000-0000-0000-0000000000a1','{roommates}',null),('00000000-0000-0000-0000-0000000000a2','{support}',null),('00000000-0000-0000-0000-0000000000a3','{kyc_review}',null);
insert into public.staff_handbook_acks values ('00000000-0000-0000-0000-0000000000a1',1),('00000000-0000-0000-0000-0000000000a2',1),('00000000-0000-0000-0000-0000000000a3',1);
set role authenticated;
-- three members report E's room
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into public.reports (reporter_id, target_type, target_id, reason, category) select auth.uid(), 'roommate_listing', (select id::text from public.roommate_listings where kind='room_offer' limit 1), 'Asked me to pay before viewing', 'scam';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
insert into public.reports (reporter_id, target_type, target_id, reason, category) select auth.uid(), 'roommate_listing', (select id::text from public.roommate_listings where kind='room_offer' limit 1), 'Same scam', 'scam';
reset role;
select number, module, severity, status, report_count, team, subject_user_id is not null as has_subject, target_label from public.moderation_cases;
set role authenticated;
-- a member cannot read cases
select count(*) as member_sees_cases from public.moderation_cases;
do $$ begin perform public.admin_cases_list('{}'); raise exception 'should have failed'; exception when others then if sqlerrm='should have failed' then raise; end if; raise notice 'member refused: %', sqlerrm; end $$;
-- Roommates moderator works the case
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select (public.admin_cases_list('{"status":"open"}') ->> 'total') as rita_sees;
select public.admin_case_assign((select id from public.moderation_cases limit 1), null);
select public.admin_case_note((select id from public.moderation_cases limit 1), 'Called the reporters, both describe an upfront payment ask.');
select public.admin_case_act((select id from public.moderation_cases limit 1), 'remove_content', 'Upfront payment before viewing is a scam pattern.');
select status from public.roommate_listings where kind='room_offer' limit 1;
select public.admin_restrict_member('00000000-0000-0000-0000-00000000000e','roommates',14,'You asked renters to pay before a viewing.', (select id from public.moderation_cases limit 1)) is not null as restricted;
do $$ begin perform public.admin_restrict_member('00000000-0000-0000-0000-00000000000e','suspended',null,'Repeated scam reports here.', (select id from public.moderation_cases limit 1)); raise exception 'should have failed'; exception when others then if sqlerrm='should have failed' then raise; end if; raise notice 'mod suspend refused: %', sqlerrm; end $$;
do $$ begin perform public.admin_roommate_verifications(null); raise exception 'should have failed'; exception when others then if sqlerrm='should have failed' then raise; end if; raise notice 'mod documents refused: %', sqlerrm; end $$;
select public.admin_case_resolve((select id from public.moderation_cases limit 1), 'listing_removed', 'Removed the post and paused Roommates for 14 days.', true);
-- the restricted lister cannot express interest or post a live room
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
do $$ begin insert into public.roommate_listings (owner_id,kind,status,title,city) values (auth.uid(),'roommate_wanted','live','Need a flatmate again','Lagos'); raise exception 'should have failed'; exception when others then if sqlerrm='should have failed' then raise; end if; raise notice 'restricted refused: %', sqlerrm; end $$;
select jsonb_array_length(public.my_standing() -> 'restrictions') as e_restrictions;
select public.appeal_restriction((select id from public.member_restrictions limit 1), 'I did not ask for any payment, it was a misunderstanding.') is not null as appealed;
-- Rita (who made the decision) cannot decide the appeal; admin D can
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select jsonb_array_length(public.admin_appeals_list('open')) as open_appeals;
select public.admin_decide_appeal((select id from public.moderation_appeals limit 1), false, 'Two separate reports describe the same payment request. The restriction stands.');
-- support can view and note but not act
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select (public.admin_case_view((select id from public.moderation_cases limit 1)) -> 'can') as support_can;
do $$ begin perform public.admin_case_act((select id from public.moderation_cases limit 1), 'restore_content', 'trying to restore it'); raise exception 'should have failed'; exception when others then if sqlerrm='should have failed' then raise; end if; raise notice 'support act refused: %', sqlerrm; end $$;
-- reporter A sees the outcome
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.my_standing() -> 'reports' -> 0 ->> 'outcome' as a_sees_outcome;
-- admin overview and signals
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select public.admin_trust_overview(30) -> 'cases' ->> 'resolvedInPeriod' as resolved, public.admin_trust_overview(30) -> 'roommates' -> 'profiles' as rp;
select jsonb_array_length(public.admin_roommate_profiles('{}')) as profiles_listed, jsonb_typeof(public.admin_roommates_signals()) as signals;
select jsonb_array_length(public.admin_case_view((select id from public.moderation_cases limit 1)) -> 'events') as timeline_events;
reset role;
select count(*) as audit_rows from public.audit_log;
select title from public.notifications where user_id = '00000000-0000-0000-0000-00000000000e' order by created_at desc limit 3;
select 'TRUST_OK';
