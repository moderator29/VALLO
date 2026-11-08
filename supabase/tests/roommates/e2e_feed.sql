\set ON_ERROR_STOP 1
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.roommate_share_to_feed((select id from public.roommate_listings where kind='room_offer' limit 1), 'Lovely room near UNILAG') is not null as shared;
do $$ begin perform public.roommate_share_to_feed((select id from public.roommate_listings where kind='room_offer' limit 1), 'again'); raise exception 'should have failed'; exception when others then if sqlerrm = 'should have failed' then raise; end if; raise notice 'reshare refused: %', sqlerrm; end $$;
reset role;
select count(*) as vallo_communities from public.circle_communities where started_by_vallo;
select 'FEED_OK';
