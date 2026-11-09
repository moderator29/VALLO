\set ON_ERROR_STOP 1
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.roommate_share_to_feed((select id from public.roommate_listings where kind='room_offer' limit 1), 'Lovely room near UNILAG') is not null as shared;
do $$ begin perform public.roommate_share_to_feed((select id from public.roommate_listings where kind='room_offer' limit 1), 'again'); raise exception 'should have failed'; exception when others then if sqlerrm = 'should have failed' then raise; end if; raise notice 'reshare refused: %', sqlerrm; end $$;
reset role;
select count(*) as vallo_communities from public.circle_communities where started_by_vallo;
select 'FEED_OK';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select public.roommate_set_listing_sharing('00000000-0000-0000-0000-0000000000f2', true, 3::smallint);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
do $$ begin perform public.roommate_set_listing_sharing('00000000-0000-0000-0000-0000000000f2', true, 3::smallint); raise exception 'should have failed'; exception when others then if sqlerrm = 'should have failed' then raise; end if; raise notice 'non-owner refused: %', sqlerrm; end $$;
reset role;
select shared_living_ok, max_occupants from public.listings where id='00000000-0000-0000-0000-0000000000f2';
select 'SHARING_OK';
