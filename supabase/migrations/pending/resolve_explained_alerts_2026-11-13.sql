/*
 * CLOSE THE 90 ALERTS THAT NOW HAVE AN ANSWER, AND NOTHING ELSE.
 * (Agent BE-BUGS, 13 November 2026. Not applied. The founder runs this.)
 *
 * ---------------------------------------------------------------------------
 * THE MEASURED PROBLEM
 *
 * public.risk_alerts holds 163 open rows. The desk cannot read 163 rows, so in
 * practice it reads none, and the day a real one arrives it will be the
 * hundred and sixty fourth. Two titles are 90 of them, and both are now
 * explained, which is the only reason this file exists. Nothing is closed here
 * on a hunch.
 *
 * COUNTS CORRECTED BY THE LEAD, 13 November 2026, against the live database.
 * The hand-off this file came with said 164 open, 114 in the two titles and 66
 * left afterwards. The real figures are 163 open, 90 in the two titles (4 and
 * 86, which the two UPDATE statements below match exactly) and 73 left. The
 * 114 was 86 plus the 28 of 'Store: readiness, red', a title this file
 * deliberately does NOT touch. The SQL was right; only the arithmetic in the
 * comment was wrong, and it would have made a correct run read as a misfire
 * against the read-back below.
 *
 * GROUP ONE: 4 open rows, severity high, titled
 *   'Money reconciliation: the last call reached something that is not the
 *    reconciler'
 * one a day from 9 to 12 November. Every one of them quotes the reply back:
 *
 *   {"ok":true,"apply":true,"needsAttention":false,"recorded":false}
 *
 * and every one says 'no payment is being reconciled'. THAT SENTENCE IS NOT
 * TRUE. The run happened and found nothing. What is wrong is the recognition
 * test: private.request_money_reconciliation decides whether its call reached
 * the reconciler or the Vallo site shell with
 *
 *   previous_body like '%"charges"%' and previous_body ~ '"ok"\s*:\s*true'
 *
 * and R-03's heartbeat short circuit in apps/web/src/app/api/paystack/
 * reconcile/route.ts answered a clean run without a `charges` key. So a
 * correct, successful run read as a renamed route, daily.
 *
 * The route is fixed in the app (the short answer now carries the same
 * `charges` block as the long one) and a spec reads every exit of that handler
 * for the key. The database function is NOT changed by this file: its test was
 * right and the reply was wrong.
 *
 * GROUP TWO: 86 open rows, severity high, titled 'Catalogue: read failed',
 * entity_type 'catalogue', 12 October to 11 November. Broken down by the code
 * in the description:
 *
 *   52  code 'unknown'   10 Nov 19:56 to 11 Nov 15:43
 *   17  code '25P02'     11 Nov 15:44 to 15:57
 *    8  code '57014'     17 Oct to 9 Nov
 *    3  code '25P02'     by_ids, 11 Nov
 *    2  code '57014'     by_id, 7 to 9 Nov
 *    4  one each, PGRST002, PGRST303, by_ids unknown, by_id 25P02
 *
 * The 25P02 rows are not a catalogue defect. 25P02 is a transaction left in an
 * aborted state, and it follows a 57014 statement timeout on the same pooled
 * connection: one timed out query without a rollback makes every later query
 * on that connection fail until the connection is recycled. The three bursts
 * are minutes long and were made by agent sessions measuring the search
 * through PostgREST, which is also what the 52 'unknown' rows in the same
 * window are.
 *
 * The ten 57014 rows ARE a real history and they have a measured cause: anon
 * carries statement_timeout = 3s (pg_roles), and public.stays_search's dated
 * path averaged 1.2 to 1.5 seconds with a standard deviation of 1.5 to 1.9
 * seconds and a maximum of 7.9 seconds, per pg_stat_statements, over counters
 * whose stats_since is 26 and 27 October. The undated split of 11 November
 * fixed it: measured again today with EXPLAIN (ANALYZE) as the anon role, the
 * same search is 96 ms. So the condition that raised those ten is gone, and
 * leaving them open hides the next one.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE DOES
 *
 * Two UPDATE statements. Each sets status = 'resolved' and resolved_at = now()
 * on open rows of one title, and each is bounded by created_at < the moment
 * this file was written, so an alert raised AFTER it is written is never swept
 * up by it. That bound is the whole safety of the file: if the route fix has
 * not deployed and the money alert comes back tomorrow, tomorrow's row stays
 * open and the desk sees it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE DOES NOT DO
 *
 *   It DELETES NOTHING. Every row is kept with its description intact; only
 *   status and resolved_at move. There is no DROP and no DELETE in it, so the
 *   connector will not freeze on it.
 *   It changes no function, no policy, no grant, no schedule and no table.
 *   It does not touch the other 66 open alerts. 'Store: readiness, red' (28),
 *   'Client: error' (11), 'Sanctions: lists unreadable' (10), 'Cron: schedule,
 *   silent' (5) and the rest are NOT explained yet and must not be closed by
 *   anybody until they are.
 *   It does not fix the reconciliation route. That is a code change and it is
 *   in the app already; this file only clears what that change explains.
 *
 * RUN IT AFTER the branch carrying the route fix is deployed, not before. Run
 * before, and the hourly job writes a fresh identical alert within the hour
 * and the desk is back where it started.
 *
 * ---------------------------------------------------------------------------
 * SAFE TO RUN TWICE: YES. The second run matches nothing, because the first
 * run moved every matching row out of status 'open'. It is also safe to run
 * late: the created_at bound means it can only ever close rows that existed
 * when it was written.
 *
 * ---------------------------------------------------------------------------
 * READ BACK AFTER RUNNING.
 *
 *   select status, count(*) from public.risk_alerts
 *    where title in (
 *      'Money reconciliation: the last call reached something that is not the reconciler',
 *      'Catalogue: read failed')
 *    group by 1 order by 1;
 *
 * Expected: no 'open' row for either title, 4 and 86 under 'resolved'.
 *
 *   select count(*) as still_open from public.risk_alerts where status = 'open';
 *
 * Expected: 73, down from 163, and 73 is the right answer only if nothing new
 * was raised in between: a fresh alert of another title is not this file
 * failing. Then, an hour after the deploy:
 *
 *   select last_verdict, last_judged_at from private.reconciliation_watch;
 *
 * Expected: last_verdict 'ok_200'. While it still reads 'wrong_body_200' the
 * route fix has not reached production yet, whatever this file did.
 */

update public.risk_alerts
   set status = 'resolved', resolved_at = now()
 where status = 'open'
   and title = 'Money reconciliation: the last call reached something that is not the reconciler'
   and created_at < timestamptz '2026-11-13 01:00:00+00';

update public.risk_alerts
   set status = 'resolved', resolved_at = now()
 where status = 'open'
   and title = 'Catalogue: read failed'
   and created_at < timestamptz '2026-11-13 01:00:00+00';
