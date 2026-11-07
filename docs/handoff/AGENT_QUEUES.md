# STANDING AGENT QUEUES (founder, 7 November 2026)

The founder: agents work full time, autonomously. When one job is done the
next one starts at once, with no waiting for the lead. Read this file again
after every job. The lead commits, pushes, runs the full gates and reviews;
agents never commit, push, deploy, open a preview or trigger Actions.

## How every agent works (all jobs)

1. **Upgrade, never rebuild.** Keep every feature, tool, data source and
   route. No mock data in place of real data. No paid service.
2. **Improve as you go.** While building, if you see something nearby that
   can be added, upgraded, made cleaner or made faster AND it fits Vallo
   (FOUNDER_DECISIONS.md, UX_SYSTEM.md), build it in the same pass. Note
   each one in your hand-off under "Also improved".
3. **Re-audit your own work** before moving on: tsc on your files, eslint,
   `node scripts/check-no-em-dash.mjs`, `node scripts/check-css-tokens.mjs`,
   the tests for what you touched, and a look at 390 and 360 wide in light
   and dark through the preview harness (`VALLO_PREVIEW_HARNESS=1`).
4. **Recommend.** Anything bigger than your job goes in your hand-off under
   "Recommend next", one line each, so the lead can queue it.
5. **Own your files only.** Never edit a file another agent owns (the lists
   below). Shared files (globals.css, lib/nav/*, en.ts): smallest possible
   edit, append only, never reformat.
6. **The rules that never bend:** no em dashes anywhere; icons stay at their
   current weight; the bottom bar and side nav keep their structure; English
   only for new copy; Vallo's own look, never a copy of another app; reduced
   motion always honoured; nothing that names a person in logs.
7. **Hand-off after each job** is a short message to the lead (files
   changed, gates run with results, Also improved, Recommend next), then
   go straight on to the next job in your queue without waiting for a reply.

## Agent FE (every frontend page and shared component outside messages)

Owns: everything under `apps/web/src/app/**` and `components/**` except
`app/(app)/messages/**`, `components/app/messages/**`,
`components/app/assistant/**`, `app/(app)/assistant/**`, `lib/native/**`,
`lib/observability/**`, `app/admin/crashes/**`.

1. **Finish round 1** (SW1 banner sweep, SW2 retire `useToast`, SW7 empty
   states to one glyph, SW15 the kept-copy price stamp), then the leftover
   banner files listed in WORK_QUEUE.md "For Agent FE".
2. **THE FEED, a new Vallo look (founder: "fucking important").** The Around
   feed: `app/(app)/around/**`, `components/social/feed/**`,
   `components/social/story/**`, `app/social-feed.css`,
   `components/social/feed/feed-v2.css`. Looks and feel only: every feature
   stays (posts, stories, rings, composer, media rail, replies, reactions,
   location chips, district header, join, tabs, tombstones, fresh arrivals).
   Give it a unique, mature Vallo identity: calm cards with real hierarchy,
   the author line, the place, the media edge to edge with soft corners,
   counts that feel alive, a story rail that reads as Vallo, motion on
   arrival and on react (transform and opacity only, reduced motion
   respected), skeletons in the feed's own shape, light mode first-class.
   Leave room beside the feed for **Vallo Circle** (a people and places
   layer that works side by side with the feed; the lead briefs it later):
   a slot in the masthead and a section anchor, nothing built yet.
3. **Light mode refinement, platform wide.** Cleaner, calmer, more refined:
   surfaces and edges (no muddy greys, the brand edge rule), shadows that
   read on white, text contrast, cards, sheets, inputs, the bottom bar and
   side nav look (structure unchanged). Tokens first
   (`packages/design-tokens/src/tokens.css`), then the worst screens.
4. **The animated Vallo logo** (the exact logo and wordmark, animated
   cleanly: the mark draws or settles, the wordmark follows) on the web
   startup screen, sign-in and the empty home, plus a motion pass in more
   places: tab changes, sheet open, card press, save, success.
5. **Privacy choices screen** (`/settings/privacy`, think wide: profile
   visibility, who can message, who sees activity and places, contact
   discovery, AI use of my content, data download, marketing, blocked
   people) and the **Community Promise** page with its trust siblings
   (how we keep listings honest, safety at viewings, money held safely).
6. **Round 2**: the listing wizard onto `StepFrame`, one question per screen
   (WORK_QUEUE.md round 2, Survey B LW-01 to LW-04).
7. **Round 3, then 5, 6, 7** from WORK_QUEUE.md, in order.

## Agent MSG (messages only)

Owns: `app/(app)/messages/**`, `components/app/messages/**`,
`components/app/assistant/**`, `app/(app)/assistant/**`, `lib/messages/**`,
`lib/assistant/handoff*`, `app/css/messages-g1.css`.

1. **Finish round 4** as briefed: the mic that becomes Send, voice notes
   (hold to record, slide to cancel, waveform, at most 2 minutes, kept for
   ever, true sending, sent and failed states), reactions on every message
   and call record, Talk to a person inside the pinned assistant.
2. **The message media viewer** (`components/app/messages/MediaViewer.tsx`):
   hold light status bar glyphs while open with
   `useStatusBarHold(open, "light")` from `lib/native/status-bar-hold.ts`
   (the ground is dark in both themes).
3. **Thread polish pass**: day separators, grouped bubbles, read receipts
   drawn only when true, link previews, reply and quote, jump to latest,
   typing state, empty thread and first-message states, light mode refined.
4. **Inbox polish pass**: swipe actions (archive, mute, pin), unread
   weight, search with highlighted matches, filters, skeletons in shape.
5. **Support as an inner page** once the support SQL is live; until then
   build against it with graceful degradation.

## Lead (native, backend, coordination)

N3 to N10, B-03 rate limits, the R-03 audit dedupe, the native build
queue, the crash log follow-ups, Vallo Circle's design brief, and every
review, gate and commit.
