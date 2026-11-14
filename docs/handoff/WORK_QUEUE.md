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
| S5 | Keyboard pass over every field, composer on the keyboard, accessory bar (6.4) | Agent INPUT | Implementing |
| S6 | The remaining CountTabs and ActionSheet screens in the 6.3 tables (offers, bookings, search, agent and host) | Agent SHEETS | Completed (7e0407f0), three items skipped with reasons below |
| M1 | One bug register, every open finding re-checked against the code today (7, phase 1) | Lead | Completed (17bde0ab), kept up to date as findings land |
| M2 | Measured Core Web Vitals baseline, throttled phone profile (7, phase 1) | Lead | Completed for the six signed-out pages (dbf89b3b); the signed-in pages need the QA member or the harness and are the next run |
| M3 | Supabase audit: queries, indexes, realtime, cron, storage, RLS, auth sessions; report in `docs/DB_NOTES.md` plus SQL files (8) | Agent | Queued |
| M4 | Bug fixes from the register, worst first, each with a test (7, phase 2) | Both agents | Queued |
| M5 | Consistency audit with numbers at 390 and 1440; the circular home control, then the founder confirms the page (7, phase 3) | Agent SHEETS | Researching |
| M6 | Public platform area by area: home, search, listing, offers, messaging, stays, restaurants, roommates, feed and Circle, profile and account, help, showcase (7, phase 4) | Both agents | Queued |
| M7 | Staff console: the restricted frame, desk tables on a phone, founder command centre proposal first (7, phase 5) | Agent | Queued |
| M8 | Motion and performance from the M2 baseline, worst number first (7, phase 6) | Agent | Queued |
| M9 | Final QA, the probes, the whole suite, a second audit by the agent that did not build it (7, phase 7) | Crossed over | Queued |

## File ownership while S1 to S6 run

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
