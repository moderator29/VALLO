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
| S1 | Confirmation pill `banner.quick`, and the copy and save moments moved onto it (6.1) | Agent INPUT | Implementing |
| S2 | Paste: photos as attachments, long text as a chip, link chips, one-tap codes, cleaning, safety (6.2) | Agent INPUT | Queued behind S1 |
| S3 | `CountTabs` shared part, then inbox, notifications, saved (6.3 part 1) | Agent SHEETS | Implementing |
| S4 | `ActionSheet` shared part, then inbox rows, card menu, profile menu, post menu (6.3 part 2) | Agent SHEETS | Queued behind S3 |
| S5 | Keyboard pass over every field, composer on the keyboard, accessory bar (6.4) | Agent INPUT | Queued behind S2 |
| S6 | The remaining CountTabs and ActionSheet screens in the 6.3 tables (offers, bookings, search, agent and host) | Agent SHEETS | Queued behind S4 |
| M1 | One bug register, every open finding re-checked against the code today (7, phase 1) | Lead | Researching |
| M2 | Measured Core Web Vitals baseline on the eleven pages, throttled phone profile (7, phase 1) | Agent | Queued |
| M3 | Supabase audit: queries, indexes, realtime, cron, storage, RLS, auth sessions; report in `docs/DB_NOTES.md` plus SQL files (8) | Agent | Queued |
| M4 | Bug fixes from the register, worst first, each with a test (7, phase 2) | Both agents | Queued |
| M5 | Consistency audit with numbers at 390 and 1440; the circular home control, then the founder confirms the page (7, phase 3) | Agent | Queued |
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

## Notes

- 14 Nov: `staff_desks_only_2026-11-14.sql` verified applied on live: both
  position holders hold only their desks, no admin role, and both have
  acknowledged the staff handbook, so their desks are open.
- The previous session's small-works agents landed nothing: no
  `banner.quick`, no `CountTabs`, no shared `ActionSheet`, no paste
  handlers in the tree at `4baa05fb`. S1 to S6 start from zero.
