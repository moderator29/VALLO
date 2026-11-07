# STATE: who is doing what, and how to pick up after any stop

Written by the lead, 7 November 2026, so nothing is lost if a usage limit,
a restart or a full context stops an agent or the lead. Read this first,
then AGENT_QUEUES.md (the ordered jobs), FEATURE_BACKLOG.md (every founder
ask with an owner and state), FOUNDER_DECISIONS.md (rulings, newest last)
and PAGE_LEDGER.md (every page, ticked as passed).

## How work survives a stop
- Everything an agent saves is committed and pushed by the lead to
  `platform-grade-1-readiness`, as named commits when a job lands and as
  "WIP (agents)" commits in between. Nothing lives only on one machine.
- Each agent's queue is in AGENT_QUEUES.md in order, with DONE marks. A new
  or resumed agent reads its section, checks `git log`, and continues from
  the first job not marked done.
- Founder SQL: pending files live in `supabase/migrations/pending/` with
  their state in `pending/README.md`; applied ones are filed under their
  version and recorded in APPLIED.txt and the live migration list.

## Agents (7 November 2026, evening)

| Agent | Done | Now | Next |
|---|---|---|---|
| Lead | coordination, every commit, backend (rate limits, R-03, R-04, push mute, crash log, rental ID rule, drift, welcome payload), verified 8 SQL files live | reviewing hand-offs | perf asks: PhoneField lazy on listing, Supabase client lazy in the member layout, empty-reviews image |
| FE (fresh run 4) | round 1, light mode part 1, the feed after the reference, the Circle dock tab, Circle visuals | feed leftovers (Save on embedded listing, story morph, /post/[id], chip scroll, dark place chip); NO BLACK BUTTONS sweep | the website animated logo, light mode leftovers, E1 plates, A7 Activity cards, rating components, map and search perf, then AGENT_QUEUES jobs 5 on |
| PAGES | job 1 in progress (PageFrame on settings, money, bookings, account, legal, help, admin heads) | job 1 to 3 | skeletons, tablet and desktop with Back in the header, docs and help |
| NATIVE | platform layer, iOS and Android shell for 1.0.2, connection manager, perf report, animated opening, device matrix | rich notifications (lib/push) | Android full draw at open (splash to bare navy), Android renderer recovery, Capacitor audit |
| FEATURES | Circle v2 and v3 specs, 119 recommendations, reminders and nudges, Circle SQL, listing-in-posts SQL | the Circle pages with live counts | nav labels for /circle routes, plural guard fixes, listing fields and category filter, composer listing picker, ratings, more tools |
| MSG | rounds 4 to 10 done | finished | messages kept by the lead |

## Waiting on the founder
- Nothing blocking right now. The next app build (1.0.2) is planned for when
  GitHub Actions minutes are back; nothing is on main until he says "push to
  main".
