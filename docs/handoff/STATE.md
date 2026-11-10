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

## Session of 9 November 2026 (lead plus two agents, three workers at most)

Branch `platform-grade-1-readiness` was re-cut from `main` (which holds the
whole upgrade; the old branch's 181 commits were checked and are all in
main). Vercel stays off for it. CI runs only on `main`, pull requests to
`main`, or by hand, and this session cannot start it by hand (GitHub refuses
the dispatch permission), so the founder starts it from Actions, CI, Run
workflow, or says yes to a draft pull request that never merges.

| Worker | Doing | State |
|---|---|---|
| Lead | setup, state report, CI probes, pending SQL, every commit | Probes b3-rate-gate, db-10-step2, new-a4-01-step2 fixed and passing live (8efbdbe7b); /api/build endpoint restored (the `build/` ignore rule had hidden it); example collection date applied live |
| Agent 1 (done) | money copy sweep (batch one): every screen promising protected, held, secured or escrowed payment | Writes `docs/handoff/MONEY_COPY_SWEEP.md`; NO copy changes until the founder approves the list |
| Agent 2 (done) | protected payments Phase 1: audit of every reference to the old provider | Writes `docs/handoff/PAYMENTS_MIGRATION_AUDIT.md`; no code until the founder has seen it |

Batch two DONE (9 Nov): app/agent and app/host on PageFrame (29 pages, 13 skipped with reasons in the commit and ledger), app/admin on PageHead (37 desks, 23 loading files); the lead fixed the workspace bar's doubled title and the double dock clearance under every framed page (34379580c).
Batch three (running): Agent MAP moves every map to OpenFreeMap vector tiles with MapLibre (lazy, with a lightweight fallback), owning lib/maps, the map components and csp.ts; Agent WIZARD re-flows app/agent/list onto StepFrame one question per screen, owning app/agent/list/** only.
Left from batch two: fees, restaurant-fees, chargebacks and bookings/[bookingId] heads, agent/promotion, host/bookings, host/earnings (after the money copy lands); DecideView and HostReviewsView headers; agent/inspections hero decision; screenshots with real agent, host and staff sessions.
Earlier note, batch two (running): an agent puts app/agent/** and app/host/** on PageFrame (not the wizard, not money pages); another puts app/admin/** on PageHead (not the money desks). Found live: the old escrow switch is ON since 8 Oct, a pending file switches it off.

Next after batch one: the four shared components spread (PageFrame is on 96
of 275 ledger pages, StepFrame on a handful), the listing wizard one question
per screen (P1.1, reopened: the earlier "not needed" assessment contradicts
the founder's brief), the free commercial map (still CARTO, non-commercial
tiles), the payment rail design pass.

## 9 to 10 November 2026, lead (after the founder's rulings)

- Rent payment closed in code, not only in words (a9a5481eb): one switch,
  `lib/rent/payment-open.ts`, `RENT_PAYMENT_OPEN = false`. Both rent money
  actions refuse before reading anything, `/rent/pay/[inspectionId]` shows the
  agreed figures and "Payment for rentals is not open on Vallo yet" with no pay
  button, and a rent agreement's pay choice says the same instead of falling
  back to card. Stays, rooms and restaurants unchanged. Before this a renter
  could reach a card payment for rent (live: 0 rent payments ever made).
- Money copy leftovers (a18b5ed94): host CSV column "Payment reference", the
  legacy partner-hold refusals no longer say escrow, PRODUCT.md rule updated.
- CI, first full run on the branch (run 42664578399): 8 failures. 7 fixed in
  cbcd8f511. The 8th (slice-coverage priceCheck, the map layer reaching the
  `meta` namespace) is the map agent's and lands with its commit.
- Protected payment adapter, phase 2 (c45ca458a):
  `lib/payments/providers/escrowpay/`, built switched off. It invents nothing:
  no base URL, the client sends nothing while `DOCUMENTED` is false, the
  status table is empty and webhooks are refused. The switch
  `payments_escrowpay_on` fails closed. Nothing imports it yet. Next: the
  provider's sandbox documentation (audit 10.2), then phase 3.
- Map migration committed (c37667ee3) and its follow-ups (7a1698401): every
  map on OpenFreeMap, no key; the staff review panel draws the still map; the
  privacy notice names OpenFreeMap (Hungary); MapTiler gone from code, CI,
  the env example and the deploy docs. The old MapTiler key can be deleted
  from Vercel, the repository variables and the MapTiler account.
- Help, guides and docs on the docs kit committed (7c45b869e), with the
  profile Support group and in-context help links.
- Framing leftovers (c178f6f39, a42c49d02): fees and restaurant-fees desks on
  PageHead; promotion hub, host bookings, earnings, decide and reviews on
  PageFrame.
- Removal audit, flags: `rentals_protected_pay` is read by nothing; its row
  goes in the end block (pending file of 10 Nov). Old guide CSS (`.nf-guide*`
  in public-doors.css) is now unused and is next for the sweep.
- Running: staff manual (new agent, app/admin/manual); docs tools (fee
  calculator from real config, copy control, was this helpful, step player).
- Protected payment screens 1 to 11 built, switched off (5e9845e15,
  0700141e1): components/money/protected, the journey model, copy with a
  scoped claims entry, a preview at /preview/protected, tests with axe. No
  live page mounts them. Part 2 (wiring behind the switch, trust page,
  receipts, payments list, failure screens, staff desk) is with an agent.
- Staff manual committed (064a2def8). For the founder to settle: who holds
  each position and how to reach them, out of hours on-call, whether business
  developers and social media managers get an access area; and three places
  the docs and the code disagree (property case restrictions, the name a
  member sees on a support reply, listing approve and publish in one step).
- The end-of-batch SQL is supabase/migrations/pending/END_OF_BATCH_2026-11-10.sql
  (sent to the founder; not applied yet).
- The founder APPLIED END_OF_BATCH_2026-11-10.sql (verified live, 10 Nov).
- Protected rail server steps (9a1613f0b): lib/money/protected-rail.ts, the
  EscrowPay webhook route (refuses all until the signature is documented),
  reconcile by provider (Payluk's scoped to Payluk rows), pending SQL
  protected_rail_server_2026-11-10.sql (not applied; two dry runs waited on
  the founder's approval in the Supabase connection).
- Docs deeper pass and tools committed (8a295d67c). Pending SQL
  docs_page_feedback_2026-11-10.sql (not applied) switches on "Was this
  helpful?".
- Running: protected payments part 2 (wiring, trust page, receipts, list,
  issue screens, staff desk); docs round three (legal cross-links, the
  feedback desk, remaining chapter tables, icon sweep).
- Both agents (map, docs) stopped on the account's weekly limit on 9 Nov at
  about 17:30 UTC and were resumed on 10 Nov at 02:00 UTC with their work
  intact.

## Agents (8 November 2026, early hours)

| Agent | Done | Now | Next |
|---|---|---|---|
| Lead | coordination, every commit, backend, banner audit round 2 (323 new moments, total now 561), banner screenshots sent to the founder, calling upgrade decisions and queue | coordinating agents, committing their work | perf asks: PhoneField lazy on listing, Supabase client lazy in the member layout, empty-reviews image |
| FE (fresh run 4) | round 1, light mode part 1, the feed after the reference, the Circle dock tab, Circle visuals | feed leftovers (Save on embedded listing, story morph, /post/[id], chip scroll, dark place chip); NO BLACK BUTTONS sweep | the website animated logo, light mode leftovers, E1 plates, A7 Activity cards, rating components, map and search perf, then AGENT_QUEUES jobs 5 on |
| PAGES | job 1 in progress (PageFrame on settings, money, bookings, account, legal, help, admin heads) | job 1 to 3 | skeletons, tablet and desktop with Back in the header, docs and help |
| NATIVE (run 2) | platform layer, iOS and Android shell, connection manager, perf report, animated opening on both, device matrix, rich push with photos, notification sound, Face ID fix, extension target, Android large icon, renderer recovery, Capacitor audit | PhoneField lazy, Supabase client lazy, empty-reviews image, re-measure, prop size test | its own proposals |
| FEATURES | Circle end to end, reminders, listing data | STOPPED by the founder | its queue stays in AGENT_QUEUES; A9 moved to FE |
| BANNER | survey done (561 moments total after audit round 2), batch 1 done (settings, wallet, admin, support, money, supply forms) | building remaining batches from sections D, E, F, G | the inline-outcome guard test |
| CALLS | F4/F5 glass control sheet done, F1 incoming banner done, F3 missed call push done | LANDED (d43adc3): glass control sheet, incoming banner, missed call push, native bridge spec | F6 recommendations, F2 outside-app spec (for build 1.0.2) |
| MSG | rounds 4 to 10 done | finished | messages kept by the lead |

## Waiting on the founder
- Nothing blocking right now. The next app build (1.0.2) is planned for when
  GitHub Actions minutes are back; nothing is on main until he says "push to
  main".
