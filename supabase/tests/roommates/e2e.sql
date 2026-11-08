\set ON_ERROR_STOP 1
-- Test members: A (student, Lagos), B (student, Lagos, compatible), C (Abuja, smoker), D (admin), E (lister, no roommate profile)
insert into public.profiles (id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','Ada'),('00000000-0000-0000-0000-00000000000b','Bola'),
 ('00000000-0000-0000-0000-00000000000c','Chidi'),('00000000-0000-0000-0000-00000000000d','Staff'),('00000000-0000-0000-0000-00000000000e','Emeka');
insert into public.social_profiles (user_id, handle, display_label, avatar_path) values
 ('00000000-0000-0000-0000-00000000000a','ada','Ada O.','https://x/a.jpg'),('00000000-0000-0000-0000-00000000000b','bola','Bola A.',null),
 ('00000000-0000-0000-0000-00000000000c','chidi','Chidi',null),('00000000-0000-0000-0000-00000000000e','emeka','Emeka',null);
insert into public.user_roles values ('00000000-0000-0000-0000-00000000000d','admin');
insert into public.confirmed_phones values ('00000000-0000-0000-0000-00000000000b','+234',now());
insert into public.institutions (slug,name,short_name,kind,state_code,city,email_domains,email_verify_on) values ('university-of-lagos','University of Lagos','UNILAG','university','LA','Lagos','{unilag.edu.ng}',true);
insert into public.agents (id,user_id) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-00000000000e');
insert into public.listings (id, agent_id, title, status, state_code, city, area, bedrooms, rent_amount_minor, rent_period) values
 ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','3 bed flat Yaba','PUBLISHED','LA','Lagos','Yaba',3,360000000,'year');

set role authenticated;
-- A creates a profile
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into public.roommate_profiles (user_id,status,intents,intro,life_stage,institution_id,state_code,city,areas,budget_min_minor,budget_max_minor,budget_period,move_in_on,move_in_flex,room_pref,cleanliness,social,sleep,smoking,pets,guests,gender,gender_pref)
 select auth.uid(),'active','{find_roommate,find_together}','Final year student who loves a calm home','student',(select id from public.institutions limit 1),'LA','Lagos','{Yaba,Akoka}',100000000,180000000,'year',current_date+30,'fixed','private',3,1,'early','never','none','rarely','female','female';
-- discover before B exists
select public.roommate_discover('{}'::jsonb) as a_discover_empty;
-- B
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.roommate_discover('{}'::jsonb) ->> 'needProfile' as b_need_profile;
insert into public.roommate_profiles (user_id,status,intents,life_stage,institution_id,state_code,city,areas,budget_min_minor,budget_max_minor,budget_period,move_in_on,move_in_flex,room_pref,cleanliness,social,sleep,smoking,pets,gender,gender_pref,gender_visible)
 select auth.uid(),'active','{find_roommate}','student',(select id from public.institutions limit 1),'LA','Lagos','{Yaba}',120000000,200000000,'year',current_date+40,'flexible','private',2,1,'early','never','fine','female','any',false;
-- C (male smoker, Abuja)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
insert into public.roommate_profiles (user_id,status,intents,state_code,city,budget_max_minor,budget_period,smoking,social,gender,gender_pref)
 select auth.uid(),'active','{find_room}','FC','Abuja',50000000,'month','yes',3,'male','any';
-- B discovers: should see A (both female); C excluded since A wants female? C should see? B sees A only if A's pref female and B female: yes
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select jsonb_path_query_array(public.roommate_discover('{}'::jsonb), '$.items[*].name') as b_sees,
       public.roommate_discover('{}'::jsonb) -> 'items' -> 0 -> 'match' as b_match_a,
       public.roommate_discover('{}'::jsonb) -> 'items' -> 0 -> 'gender' as a_gender_hidden_shows_null;
-- C discovers: A wants female only, so C must not see A; C should see B? B pref any, C pref any -> yes
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select jsonb_path_query_array(public.roommate_discover('{}'::jsonb), '$.items[*].name') as c_sees;
-- RLS: C cannot read A's profile row directly
select count(*) as c_reads_a_row from public.roommate_profiles where user_id = '00000000-0000-0000-0000-00000000000a';
-- B expresses interest in A, A accepts, chat opens
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.roommate_express_interest('00000000-0000-0000-0000-00000000000a', null, 'Hi Ada, also at UNILAG') as interest_id \gset
do $$ begin perform public.roommate_express_interest('00000000-0000-0000-0000-00000000000a', null, 'again'); raise exception 'should have failed'; exception when others then if sqlerrm = 'should have failed' then raise; end if; raise notice 'duplicate refused: %', sqlerrm; end $$;
select public.roommate_profile_view('00000000-0000-0000-0000-00000000000a') -> 'connection' as b_conn_sent;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select (public.roommate_my_hub() -> 'interests' -> 0 ->> 'direction') as a_hub_dir, public.roommate_home() -> 'pending' as a_pending;
select public.roommate_answer_interest(:'interest_id', true) as answered;
select public.roommate_open_chat(:'interest_id') as conv_id;
select count(*) as convs from public.conversations;
select public.roommate_profile_view('00000000-0000-0000-0000-00000000000b') -> 'connection' ->> 'state' as a_conn;
-- Notifications written
reset role;
select user_id, title, href from public.notifications order by created_at;
set role authenticated;
-- E (lister, no profile) posts a room linked to listing
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
insert into public.roommate_listings (owner_id,kind,status,title,description,state_code,city,area,institution_id,listing_id,rent_minor,rent_period,share_minor,deposit_minor,occupants_max,room_type,furnished,amenities,available_from,authority,authority_declared_at,photos)
 select auth.uid(),'room_offer','live','Ensuite room in a 3 bed flat, Yaba','Calm home near UNILAG','LA','Lagos','Yaba',(select id from public.institutions limit 1),'00000000-0000-0000-0000-0000000000f2',360000000,'year',120000000,20000000,3,'ensuite','furnished','{wifi,security}',current_date+20,'tenant_permitted',now(),'{00000000-0000-0000-0000-00000000000e/a.jpg}'
 returning id as room_id \gset
-- room offer without declaration must fail
do $$ begin insert into public.roommate_listings (owner_id,kind,status,title,city,rent_minor) values (auth.uid(),'room_offer','live','No declaration room','Lagos',1000); raise exception 'should have failed'; exception when check_violation then raise notice 'undeclared room refused'; end $$;
-- A searches rooms (match vs A)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.roommate_search_listings('{"sort":"match"}'::jsonb) -> 'items' -> 0 -> 'match' as a_room_match,
       public.roommate_search_listings('{"maxMinor":50000000,"period":"year"}'::jsonb) -> 'items' as too_expensive_empty;
select public.roommate_listing_view(:'room_id') -> 'linkedListing' as linked, public.roommate_listing_view(:'room_id') ->> 'isOwner' as is_owner;
select public.roommate_record_view(:'room_id');
select public.roommate_request_viewing(:'room_id','in_person', now() + interval '2 days', null, 'Evening is best') as viewing_id \gset
select public.roommate_express_interest('00000000-0000-0000-0000-00000000000e', :'room_id', null) as room_interest;
-- E answers viewing
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select public.roommate_answer_viewing(:'viewing_id', true, null) as viewing_answer;
-- E cannot update A's profile
update public.roommate_profiles set intro = 'hacked' where user_id = '00000000-0000-0000-0000-00000000000a';
-- E tries to verify its own listing (guard keeps verified_at null)
update public.roommate_listings set verified_at = now() where id = :'room_id';
select verified_at is null as still_unverified from public.roommate_listings where id = :'room_id';
-- anon can search rooms
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select jsonb_array_length(public.roommate_search_listings('{}'::jsonb) -> 'items') as anon_rooms, public.roommate_home() -> 'stats' as anon_stats;
reset role; set role authenticated;
-- Groups: A creates, invites B (connected), B accepts, shortlist + vote + post + expense
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.roommate_create_group('{"name":"UNILAG girls flat","visibility":"open","stateCode":"LA","city":"Lagos","sizeTarget":3,"budgetMaxMinor":200000000,"budgetPeriod":"year"}'::jsonb) as group_id \gset
select public.roommate_invite_to_group(:'group_id','00000000-0000-0000-0000-00000000000b');
do $$ begin perform public.roommate_invite_to_group((select id from public.roommate_groups limit 1),'00000000-0000-0000-0000-00000000000c'); raise exception 'should have failed'; exception when others then if sqlerrm = 'should have failed' then raise; end if; raise notice 'unconnected invite refused: %', sqlerrm; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.roommate_answer_group_invite(:'group_id', true);
insert into public.roommate_group_shortlist (group_id, listing_id, added_by) values (:'group_id','00000000-0000-0000-0000-0000000000f2', auth.uid()) returning id as sl \gset
insert into public.roommate_group_votes (shortlist_id, user_id, vote) values (:'sl', auth.uid(), 'yes');
select public.roommate_post_to_group(:'group_id','Viewing Saturday?');
insert into public.roommate_group_expenses (group_id,title,amount_minor,created_by) values (:'group_id','Agency fee',30000000,auth.uid());
select public.roommate_group_view(:'group_id') -> 'shortlist' -> 0 -> 'votes' as votes, jsonb_array_length(public.roommate_group_view(:'group_id') -> 'members') as members;
-- C (not member) sees open group summary only, no posts
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select jsonb_array_length(public.roommate_group_view(:'group_id') -> 'posts') as c_sees_posts, (select count(*) from public.roommate_group_posts) as c_reads_posts_table;
select jsonb_array_length(public.roommate_open_groups(null,null)) as c_open_groups;
select public.roommate_request_join_group(:'group_id');
-- A (owner) leaves: ownership transfers to B
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.roommate_answer_join_request(:'group_id','00000000-0000-0000-0000-00000000000c', false);
select public.roommate_leave_group(:'group_id');
reset role;
select owner_id = '00000000-0000-0000-0000-00000000000b' as transferred from public.roommate_groups;
-- block: B blocks C, then C cannot express interest in B
insert into public.blocks values ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000c');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
do $$ begin perform public.roommate_express_interest('00000000-0000-0000-0000-00000000000b', null, null); raise exception 'should have failed'; exception when others then if sqlerrm = 'should have failed' then raise; end if; raise notice 'blocked refused: %', sqlerrm; end $$;
select public.roommate_profile_view('00000000-0000-0000-0000-00000000000b') is null as c_cannot_view_b;
-- saved search alerts: A saves a search, E posts another room
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into public.roommate_saved_searches (user_id,label,city) values (auth.uid(),'Rooms in Lagos','Lagos');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
insert into public.roommate_listings (owner_id,kind,status,title,city,state_code) values (auth.uid(),'roommate_wanted','live','Need a flatmate in Surulere','Lagos','LA');
reset role;
select count(*) as alerts from public.notifications where title like 'A new post matches%';
select public.roommate_institution_page('university-of-lagos') -> 'roomsCount' as campus_rooms;
select private.roommate_expire_listings() as expired_now;
-- saved collections accept roommate kinds
insert into public.saved_collection_items values (gen_random_uuid(),'roommate_listing',gen_random_uuid());
select 'E2E_OK' as done;
