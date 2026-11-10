#!/usr/bin/env bash
# Concurrency: one seller in two tabs and a second offer on the same listing,
# all accepting at the same moment. Run after run.sh (uses committed rows, so
# run.sh rebuilds the database first). Expect exactly ONE approval.
set -euo pipefail
P="${PSQL:-psql -q -h /var/tmp/pgl -p 5544 -U postgres -d offers_t -At}"
S=00000000-0000-0000-0000-0000000000a1; B1=00000000-0000-0000-0000-0000000000b1; B2=00000000-0000-0000-0000-0000000000b2
L=22222222-2222-2222-2222-222222222222
$P >/dev/null <<SQL
insert into auth.users (id) values ('$S'),('$B1'),('$B2');
insert into public.profiles values ('$S','S'),('$B1','B1'),('$B2','B2');
insert into public.agents (id,user_id) values ('11111111-1111-1111-1111-111111111111','$S');
insert into public.listings (id,agent_id,title,status,listing_intent,sale_price_minor,sale_status) values ('$L','11111111-1111-1111-1111-111111111111','C','PUBLISHED','sale',100000,'available');
insert into public.identity_verifications (subject_id,outcome) values ('$B1','matched'),('$B2','matched');
select public.sale_offer_submit_as('$B1','$L',null,'cash',null,null,null,null,'conc-key-b1-1');
select public.sale_offer_submit_as('$B2','$L',null,'cash',null,null,null,null,'conc-key-b2-1');
SQL
A1=$($P -c "select id from deal_agreements where idempotency_key='conc-key-b1-1'"); A2=$($P -c "select id from deal_agreements where idempotency_key='conc-key-b2-1'")
for i in 1 2; do $P -c "select public.sale_offer_accept_as('$S','$A1',1,'k')::text" >/dev/null & done
$P -c "select public.sale_offer_accept_as('$S','$A2',1,'k')::text" >/dev/null &
wait
agreed=$($P -c "select count(*) from deal_agreements where listing_id='$L' and status='approved'")
events=$($P -c "select count(*) from deal_agreement_events e join deal_agreements a on a.id=e.agreement_id where a.listing_id='$L' and e.action='approved'")
[ "$agreed" = "1" ] && [ "$events" = "1" ] && echo "RACE_OK one agreement, one approval event" || { echo "RACE_FAIL agreed=$agreed events=$events"; exit 1; }
