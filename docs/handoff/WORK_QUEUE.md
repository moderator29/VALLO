# THE NEXT-GENERATION WORK QUEUE

Rewritten 14 November 2026 for the platform-wide upgrade. The old Grade 1
queue this file held is finished and lives in git history (`4baa05fb` and
before) and in the surveys it was merged from. Read
`NEXT_GEN_HANDOFF.md` first; the founder's briefs are in
`NEXT_GEN_BRIEF_VERBATIM.md`; rulings in `FOUNDER_DECISIONS.md` win.

Branch: `claude/wonderful-lovelace-wk1b1v` (main took the whole earlier
branch at `4baa05fb` on 14 November; the old audit branch is gone from the
remote). Never push to main without the founder's literal word. Never deploy.

Two agents at most at any time, never in the same file. The lead owns the
queue, every review, every commit, every SQL file and every message to the
founder. A task is Completed only when it was run and seen, not when code
was written.

Stages: Queued, Researching, Ready for implementation, Implementing,
Testing, Bug fixing, Re-auditing, Completed.

## The queue

| # | Task (handoff section) | Owner | Stage |
|---|---|---|---|
| S1 | Confirmation pill `banner.quick`, and the copy and save moments moved onto it (6.1) | Agent INPUT | Completed (seen on the preview at 390, dark and light; 42 touched tests green; not seen on a real phone) |
| S2 | Paste: photos as attachments, long text as a chip, link chips, one-tap codes, cleaning, safety (6.2) | Agent INPUT | Completed (148a1968) |
| S3 | `CountTabs` shared part, then inbox, notifications, saved (6.3 part 1) | Agent SHEETS | Completed (seen on the preview at 390 and 1440, both themes; mounted screen suites green; not seen signed in on live) |
| S4 | `ActionSheet` shared part, then inbox rows, card menu, profile menu, post menu (6.3 part 2) | Agent SHEETS | Completed (10e5c515) |
| S5 | Keyboard pass over every field, composer on the keyboard, accessory bar (6.4) | Agent INPUT | Completed (03578827) |
| S6 | The remaining CountTabs and ActionSheet screens in the 6.3 tables (offers, bookings, search, agent and host) | Agent SHEETS | Completed (7e0407f0), three items skipped with reasons below |
| M1 | One bug register, every open finding re-checked against the code today (7, phase 1) | Lead | Completed (17bde0ab), kept up to date as findings land |
| M2 | Measured Core Web Vitals baseline, throttled phone profile (7, phase 1) | Lead | Completed for the six signed-out pages (dbf89b3b); the signed-in pages need the QA member or the harness and are the next run |
| M3 | Supabase audit: queries, indexes, realtime, cron, storage, RLS, auth sessions; report in `docs/DB_NOTES.md` plus SQL files (8) | Lead | Implementing (baseline landed in 70453708; the rest is broken out as D1 to D9 below) |
| M4 | Bug fixes from the register, worst first, each with a test (7, phase 2) | Both agents | Queued |
| M5 | Consistency audit with numbers at 390 and 1440; the circular home control, then the founder confirms the page (7, phase 3) | Agent SHEETS | Researching |
| M6 | Public platform area by area: home, search, listing, offers, messaging, stays, restaurants, roommates, feed and Circle, profile and account, help, showcase (7, phase 4) | Both agents | Queued |
| M7 | Staff console: the restricted frame, desk tables on a phone, founder command centre proposal first (7, phase 5) | Agent | Queued |
| M8 | Motion and performance from the M2 baseline, worst number first (7, phase 6) | Agent INPUT | Implementing (P1, the listing page's 4.81 s) |
| M9 | Final QA, the probes, the whole suite, a second audit by the agent that did not build it (7, phase 7) | Crossed over | Queued |

## File ownership while S1 to S6 run

HISTORICAL. This was the split for the S1 to S6 round, which is finished.
Both agents have stopped and every file below is free. The live ownership
note is the one further down, under THE FULL QUEUE TO DONE.

INPUT: `lib/ui/toast.ts`, `components/ui/ToastHost.tsx`, every composer
(`app/(app)/messages/[id]/ThreadView.tsx` and `components/app/messages/*`,
the support composer, the feed composer), `components/ui/Field.tsx`,
`NairaField.tsx`, the code fields under `app/(auth)`,
`lib/native/keyboard.ts`.

SHEETS: `components/ui/Sheet.tsx`, the new `CountTabs.tsx` and
`ActionSheet.tsx`, `app/(app)/messages/Inbox.tsx` and its swipe,
`app/(app)/notifications`, `app/(app)/saved`,
`components/app/listing/CardMenu.tsx`, `components/social/ActionSheet.tsx`,
`components/social/profile/ProfileMenu.tsx`.

Neither touches `app/admin`. The lead works only in files neither holds
(docs, the bug register, SQL).


---

# THE BOARD, 16 November 2026

## THE CONSISTENCY AUDIT IS DONE

644 page loads measured, 0 failed: 161 routes at 390 and 1440, dark and
light. **637 of the 640 judged rows match every rule.** Zero sideways
overflow anywhere. Zero back-control faults across the 521 rows that draw
one. Zero controls under 44 by 44 on touch, after one fix.

THE FINDING WAS THE SWEEP, NOT THE PAGES. Its first complete run called 509
of 640 rows failures. Every one was the measurement, in six ways, each now
fixed and each written up in the document's 4.2 with what it cost. The worst
two: a pseudo-element hit area is not a child node, so `.nf-tap::after` and
`.nf-btn--sm::before` were invisible to it and the whole 44px floor read as
broken; and headless Chromium reports a fine pointer at 390px, so it took
the mouse branch of a rule that only applies to touch. A sweep that cannot
see how this platform grows a target would have sent somebody rebuilding
what is already right.

ONE PRODUCT FIX. The assistant composer's field was 40.8px beside a send
disc that was given the 44pt floor on 11 November. One composer, two
controls, one of them short. It now reads the same rung as the disc, so they
cannot disagree again.

LEFT ALONE, EACH WITH ITS REASON IN SECTION 7: the styleguide's nested card
at 14px in dark and 18px in light (a real asymmetry, and a decision for the
founder rather than a thing to invent a rule for), the stays tile at the
control radius by its own stated law, and prose links, which cannot take a
44px hit area without covering the lines above and below.

A BOOKKEEPING ERROR OF THE LEAD'S. Commit `60b4659a3` is titled for the Face
ID work and also carries this audit: the sweep, the composer fix and the 534
lines of document. `git add -A` swept a second agent's files into a commit
whose message describes only the first. The history is wrong about what that
commit contains and this paragraph is the correction, since main is not
rewritten.

## FACE ID AND THE MONEY LOCK: DONE

`60b4659a3`. The screen no longer offers to add a phone it has just said is
already added; the Face ID step is its own numbered step with its own words;
turning it off is a screen that says what stops and what does not; and
"Remove this phone" is no longer dead code. That last one was a React 19
Action entanglement: the tap opened a sheet and then waited for that same
sheet to be answered. It broke only for people who had actually enrolled,
which is why no earlier test saw it, and the same shape was in Add bank
account, the payout accounts and the host wizard. Proven load-bearing: the
lead removed the fix and both new tests hung, then passed with it restored.

## DONE AND ON MAIN

| What | Commit |
|---|---|
| The merge of both branches, 44 files decided one by one | `7fdef9aa` `637541b6` |
| The listing hero's back: a disc, then out of the photograph into the bar | `26f17ab2` `1b89d293` |
| The banner reverted to the platform's own, back chevron to 24px | `a0ae49a8` |
| The back control's air, and the pencil scoped to feed and roommates | `fc91c397` |
| Face ID, the money lock, and the consistency audit | `60b4659a3` |
| The database: five files applied and verified, three filed as migrations | `163ef982` |

## WAITING ON THE FOUNDER

1. `register_applied_migrations_2026-11-15.sql`, so a rebuilt database is
   today's and not 9 November's.
2. Supabase dashboard, Authentication, Sessions: no time limit is set, which
   is why 720 sessions had piled up.
3. Whether Face ID actually rises on his iPhone. Nothing here can prove it.
4. The styleguide's nested card: 14px at night and 18px by day, on purpose or
   not.
5. Where the showcase lives.

## NEXT, IN ORDER

1. The signed-in performance baseline, on the harness.
2. The console: the restricted staff frame, desk tables on a phone, then the
   founder command centre as a proposal.
3. Public areas not yet swept: stays, restaurants, roommates, feed, Circle,
   profile, account.
4. The second audit, by whoever did not build the thing.
5. Retire the superseded SQL files and rewrite the pending README from the
   triage, so the folder stops lying about itself.

---

# THE FULL QUEUE TO DONE (written 14 November 2026)

Everything left in the handoff and the two briefs, broken into pieces one
worker can finish, each with what proves it. Two agents at a time and the
lead, always on separate files. Nothing here is "Completed" until it was run
and seen.

**Who holds what, so two workers never meet in a file.** The lead holds
`app/admin/**`, every SQL file, `app/css/chrome.css`, and all of `docs`
except the files named against an agent below. Agent INPUT held the
performance work and the help centre. Agent SHEETS holds the consistency
audit, its sweep script, `docs/handoff/CONSISTENCY_AUDIT.md` and, released to
it by the lead, `app/css/chrome.css`. Both have stopped; their files are free
again. `components/app/MobileTabBar.tsx` is unowned and worth knowing about:
the front door's rule for which tab `/` lights lives there.

## P. PERFORMANCE (brief section 8, handoff phase 6)

| # | Task | Proof it is done |
|---|---|---|
| P1 | WITHDRAWN. The 4.81 s and the wrong LCP element were measured on the not-found screen, because this sandbox has no database credentials. The real listing page has never been measured. See the correction at the top of the performance report | A measurement on the harness, signed in, before any claim |
| P2 | WITHDRAWN with P1: the 559 KB was that same not-found screen. What is real is BR-25, the shell's own weight | Per-route sizes measured where the page actually renders |
| P3 | `/stays`, same wrong LCP element, 3.14 s | Before and after |
| P4 | The landing hero at 2.67 s, just over target | Before and after |
| P5 | The signed-in baseline: home, inbox, a thread, the feed, profile, the agent dashboard, the console overview, on the preview harness or the QA member | The table in the performance report, same profile |
| P6 | Route-level JavaScript: find what every route ships and split what is not needed for the first paint | Per-route transfer sizes before and after |
| P7 | Image delivery: every listing and stay photograph served at the size it is drawn, correct format, no layout shift | Measured bytes per page, CLS unchanged at 0 |
| P8 | Re-measure every page in the baseline table after P1 to P7 and publish the comparison | One table, before and after, same profile |

## D. THE DATABASE (brief follow-up section 2, handoff section 8)

Reads only against live. Every change is a SQL file the founder runs.

| # | Task | Proof it is done |
|---|---|---|
| D1 | The three pending files run by the founder and verified on live | A read-only query per file after he runs it |
| D2 | `pg_stat_statements` read again after a clean day, so the numbers are not the 13 November crisis | The new table in `docs/DB_NOTES.md` |
| D3 | `explain (analyze, buffers)` as the calling role on each of the ten heaviest statements | Plans recorded with the finding each one supports |
| D4 | The permissive policy merge on `listings`, `accommodations`, `businesses`, measured before and after, delivered as a DRAFT because it is security on the hottest table | A plan before and after, and the draft file |
| D5 | The 90 unindexed foreign keys: index the ones with real join traffic, leave the audit columns, say which and why | The advisor count before and after he runs it |
| D6 | Realtime: the WAL reader is the heaviest statement by total time. Reduce concurrent channels, not the publication (all five published tables are subscribed) | Call count before and after |
| D7 | Auth: whether `reauthenticate` and the console password door leave sessions behind, and whether a purge is needed | A count of `auth.sessions` by kind over a week |
| D8 | Storage and egress: 15 MB today, so the lever is image delivery (P7), not buckets. Record it and stop looking | Written in `docs/DB_NOTES.md` |
| D9 | The cost conclusion: what the Nano can carry, what the next size costs, and the evidence either way. A recommendation with a price, never an action | The section the follow-up brief asks for |

## B. THE BUG REGISTER (brief section 1, handoff phase 2)

| # | Task | Proof it is done |
|---|---|---|
| B1 | BR-11: publish blockers live in three implementations that can disagree. One SQL function all three read | The wizard checklist, the admin desk and `heldReasons` reading one source |
| B2 | BR-17: stale open alerts from September and October closed with a note | The alerts desk showing only live faults |
| B3 | BR-07: the last two hand-rolled dialogs onto `Sheet`, and the guard widened so it cannot happen again | The guard test failing on a new one |
| B4 | BR-08 and BR-09: two people finders become one, the redirect-only route becomes a redirect | The routes gone from the build output |
| B5 | A fresh walk as a member, an agent, a host and a guest at 390 px, adding what the surveys could not see | New rows in the register with how to see each one |

## A. THE PUBLIC PLATFORM, AREA BY AREA (brief section 5, handoff phase 4)

For each area: read its rows in the ledger and the register, mark each of the
brief's numbered items true, to build, or not for Vallo with a reason, build,
then see it at 390 and 1440 in light and dark.

| # | Area | The brief's items |
|---|---|---|
| A1 | Home and discovery | 1 to 15, 30 |
| A2 | Search and filters | 16 to 29 |
| A3 | The listing page | 31 to 50 |
| A4 | Make an Offer and the deal room | 51 to 70 |
| A5 | Messaging | 86, 87, and the communication list in section 13 |
| A6 | Stays | 71 to 76 |
| A7 | Restaurants | 77 to 79 |
| A8 | Roommates | 80 to 83 |
| A9 | Feed and Circle | 84, 85 |
| A10 | Profile, notifications, account and trust | 89 to 100 |
| A11 | The help centre (brief section 12) | A searchable centre, guides per journey, contextual help, screenshots of real screens |
| A12 | The showcase, "Discover Vallo" (brief section 11) | Proposal with screenshots to the founder FIRST, then build |

## C. THE CONSOLE (brief section 10, handoff phase 5)

| # | Task | Proof it is done |
|---|---|---|
| C1 | The restricted staff frame given the same care as the operator's rail: a real nav on a wide screen, a clean drawer on a phone, the person's own tasks on the front page | Seen at 390 and 1440, dark only |
| C2 | Every desk's tables on a phone, following the pipeline table's pattern | Each desk seen at 390 |
| C3 | The founder command centre: proposal with screenshots FIRST, then build | His word, then the build |
| C4 | Staff manual screenshots: every chapter has an empty slot | Captures from the harness with fixture rows, labelled as examples |
| C5 | Admin search, filtering and bulk actions (brief items 120) | Seen working on a desk with real rows |

## M. MOTION (brief section 6, handoff phase 6)

| # | Task | Proof it is done |
|---|---|---|
| M-a | Choose which of the brief's ten signature moments have a place here, and say why the rest do not | The list, with reasons |
| M-b | Build the chosen ones on the existing motion system, inside the brief's budgets | Seen, and reduced motion respected |
| M-c | Nothing added delays a tap; every entrance collapses under the calm setting | Measured interaction latency unchanged |

## Q. QUALITY AND THE SECOND AUDIT (brief section 17, handoff phase 7)

| # | Task | Proof it is done |
|---|---|---|
| Q-a | The journeys in the brief's section 17, run for real where the rules allow | What passed, what failed, what could not be run |
| Q-b | The permission probes in `supabase/tests/probes`, including one new probe for everything closed in D4 and D5 | Green, on live |
| Q-c | The whole test suite and a production build | Both green, named in the final report |
| Q-d | The second audit, by the worker that did not build the thing | Its findings, and what was done about each |
| Q-e | The documents in handoff section 12 brought up to date | Each one dated and true |

## Rulings made by the lead while S1 and S3 landed (confirm with the founder only if he asks)

- Inbox: no "Groups" tab (the conversation model has no groups; a tab that
  can never fill is dishonest) and the Property and Stays sides stay on the
  Segmented control above the row rather than folding into it.
- Saved: "Compare" stays out of the tab row (it is a two-item picker beside
  Sort, not a list filter); Saved searches moved into the row as a tab.
- Compare picks get no quick pill: the tick on the pick itself is the
  confirmation, and the two-at-a-time swap note stays on the top banner.
- Heart saves lose the top banner's Undo button: the pill says Saved or
  Removed, and the opposite tap within the pill's life is the silent undo
  (handoff 6.1). FOUNDER-VISIBLE change, named in the report to him.


## Queued by the lead from what the agents found

| # | Task | Why | Owner |
|---|---|---|---|
| Q1 | Widen the bookings spine's read so a plan row carries its conversation, its place and its receipt | Without it a booking row's action sheet can only offer actions that do not exist (S6 item 6) | Unassigned |
| Q2 | The listing page's LCP: a decorative background is the largest paint, and the route ships 559 KB of JavaScript | The worst number in the measured baseline, 4.81 s against a 2.5 s target | Lead, phase 6 |
| Q3 | Stays: same wrong LCP element as the listing page | 3.14 s measured | Lead, phase 6 |
| Q4 | The thread's header menu onto the shared ActionSheet | Deferred while the keyboard pass holds the thread files | Agent SHEETS, after S5 |
| Q5 | Replace the agent listing row's inline control bar on narrow screens with the held sheet | Ten controls wrap onto four lines on a phone; the sheet already answers it | Agent SHEETS |

## Notes

- 14 Nov: `staff_desks_only_2026-11-14.sql` verified applied on live: both
  position holders hold only their desks, no admin role, and both have
  acknowledged the staff handbook, so their desks are open.
- The previous session's small-works agents landed nothing: no
  `banner.quick`, no `CountTabs`, no shared `ActionSheet`, no paste
  handlers in the tree at `4baa05fb`. S1 to S6 start from zero.
