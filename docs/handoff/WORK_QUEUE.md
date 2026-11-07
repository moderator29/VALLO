# THE GRADE 1 WORK QUEUE

Merged on 7 November 2026 from `SURVEY_A_MEMBER_PUBLIC.md` (153 findings,
168 member and public routes) and `SURVEY_B_WORKSPACES_BACKEND.md` (84
findings: agent, host, admin, backend, live database). Founder rulings in
`FOUNDER_DECISIONS.md` win. IDs (SW1, X-02, LW-01...) point into the surveys.

Three builders at most at any time: the lead plus Builder A and Builder B,
always on separate files. Every round ends with the lead's gates: tsc, eslint,
the em dash and CSS checks, the touched tests, a production build and
screenshots at 390 and 360 wide in light and dark.

## Round 1: one feedback system, one sheet, smaller controls (IN PROGRESS)
- DONE (lead): compact banner; 40 / 44 / 50px button ladder platform-wide;
  smaller step-screen type; every sheet gets a close X by default (SW3);
  the chat thread's outcomes on the banner, with Try again on a failed send.
- RUNNING (Builder A): SW1 banner sweep, member side; SW2 retire `useToast`;
  SW7 empty states to one glyph; SW15 the kept-copy price stamp.
- RUNNING (Builder B): X-02 banner sweep, agent, host and admin; R-01 the call
  channel name (the crash behind 7 of 9 recorded client errors); B-04
  `cache()` on `getAgentContext`; B-03 rate limits on holds, inspections,
  viewings, briefs; R-03 one Paystack scheduler; D-08 drift files.
- WAITING ON THE FOUNDER (Supabase prompt): fast push (seconds, not up to 5
  minutes), staff sign-in alerts only on a new device, voice notes and
  reactions.

## Round 2: the listing wizard, one question per screen
- LW-01, LW-02: split the 4,733-line `ListingWizard.tsx` into steps as data
  on `StepFrame` (the 17-screen flow in Survey B), keeping every gate: supply
  door, SCUML mandate and EDD, charges at the door, photo rules, fee gate,
  broadcast paste, draft resume.
- LW-04, B-13: charges at the door and the mandate inside the wizard; one
  `listing_publish_blockers` function behind the checklist and the desk.
- R18 to R34: kind cards, connection cards, type tiles, location with the
  privacy note, pin, room chips, price, charge cards with a live move-in
  total, photos with the cover, description from the answers (AI with a
  consent sheet and undo), Check your listing with Change.

## Round 3: pages onto one frame, flows onto one stepper
- SW4, X-01, AD-01: every ordinary page on `PageFrame` (settings first,
  then money, bookings, workspaces, admin's four headers into one).
- SW5: registrations, wallet send and withdraw, support new, checkout progress
  onto `StepFrame`; SW6 one-choice questions onto `OptionCards`.
- SW12 skeletons in the content's shape; SW16 no Back on root tabs; the bell on
  every root; one Create trigger (the bottom bar and side nav keep their
  structure, founder ruling).

## Round 4: messages, voice, reactions, assistant, support
- Voice notes (hold to record, slide to cancel, waveform), reactions on every
  message and call record, Talk to a person inside the pinned assistant,
  the support chat as an inner page (needs the pending migration).

## Round 5: agent and host workspaces to the references
- A-01, A-02, H-07 Getting started and Needs attention cards (Do it, Dismiss,
  Snooze); A-04 What do you manage; A-11 month calendar with legend counts;
  A-12 Activity inbox with counted tabs; X-05 one role switch, Exit agent
  tools in every drawer; X-06 workspace pages kept for offline.

## Round 6: admin desks and reporting
- Business developer desk and social media manager desk on `staff_grants`
  (Survey B "Missing desks"); AD-06, AD-07 reports routed to the right desk;
  B-01, AD-02 every server action on `ActionResult`.

## Round 7: duplicates, copy, speed, database hygiene
- SW13 duplicates (three AI consent pages, two support chats, three help
  searches, four money histories, two withdrawals, two stay templates).
- SW11 hard-coded English into the dictionary; SW8 inline svg; SW9 raw sizes;
  SW10 radii; SW14 hand-rolled dialogs.
- B-05 search and listing reads in one wave; D-02 merge permissive policies on
  hot tables; D-01 leaked password protection; R-04, R-05 idempotent alerts.
- The free commercial-use map provider (founder ruling) and the full-screen
  pin picker.
- Vallo Circle, the signature feature (founder ruling on the name), built
  last on the finished pieces.
