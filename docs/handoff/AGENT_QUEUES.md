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
7. **The page ledger** (`docs/handoff/PAGE_LEDGER.md`, all 267 pages): the
   founder said many pages get forgotten. Every page you pass you tick there
   in the same change (Frame, Light, Dark, 360, a note). A job is not done
   while a page it touched is unticked.
8. **Hand-off after each job** is a short message to the lead (files
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
   Leave room beside the feed for **Vallo Circle** as
   `docs/handoff/VALLO_CIRCLE.md` "What Agent FE does now" says: the
   masthead's two-lens switch (Around selected, Circle "Coming soon", not
   tappable) and a layout a second lens can slide in beside. Nothing else.
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
7. **Universal systems from the follow-up directive**, each tested in
   several modules: bottom sheets audited onto the one `Sheet` (drag,
   dismissal, keyboard, safe areas) for filters, sort, share, collections,
   account and booking actions; **saved collections** (custom collections,
   covers, move between, sort, share, compare up to 4 side by side on a
   phone); the **Activity Centre** (`/notifications`: categories, grouping,
   unread, mark all read, archive, every row opens its exact destination,
   distinct from Messages); **keyboard actions** on every form (`enterKeyHint`
   Next and Done, `inputMode`, `autoComplete`, Enter moves to the next
   field), done in the shared input components first.
8. **Round 1 follow-ups** (from the round 1 hand-off): success words for
   unblock, payment method remove and default, and hours saved; `ToastHost`
   inside `lib/testing/browser-root` `mount()`; Book and Pay disabled while
   the page on screen is a kept copy (with the KeptPriceNote reason);
   `DiscoveryEmpty` onto the one glyph; a real `pin` glyph in UiIcon at
   the current stroke weight (the inbox pin mark borrows `bookmark` today); the inline errors left in HostWizard
   and the stays steps move with round 2's StepFrame work.
9. **Rounds 5, 6, 7** from WORK_QUEUE.md, in order (round 3 is Agent PAGES'). Round 7 SW11
   includes the English words the messages agent added (voice, reactions,
   Talk to a person) moving into `packages/i18n`.

## Agent MSG (messages only): QUEUE FINISHED 7 November (jobs 1 to 10); messages are kept by the lead

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
5. **Voice notes offline**: an outbox so a note recorded with no signal
   sends itself when the signal returns, instead of failing with Try again.
6. **Signed URL refresh**: photos and voice in a thread left open past an
   hour re-sign before their links expire (3600 seconds).
7. **Support as an inner page**: DONE (the Support chip in the inbox).
8. **Inbox pin and mute** on the swipe and the options sheet, built against
   `supabase/migrations/pending/grade1_conversation_pin_and_mute.sql`
   (pinned rows first, at most 5, a muted bell on the row), degrading to
   nothing if the table is not there yet.
9. **A playing voice note never restarts** when its link refreshes: swap the
   source only while paused or at the end.
10. **The support ticket thread** (`/support/messages/[id]`) in the Messages
    bubble style, so the inner page reads as one product with the inbox.

## Agent PAGES (round 3: every ordinary page on one frame)

Started 7 November 2026 in the slot Agent MSG left when its queue finished.
Source: SURVEY_A_MEMBER_PUBLIC.md SW4, SW5, SW6, SW12, SW16 and the per-route
tables; SURVEY_B_WORKSPACES_BACKEND.md X-01, AD-01.

Owns the pages, not the shared parts: `app/(app)/settings/**`,
`app/(app)/{wallet,payments,payouts,receipts,refunds,pay,rent,tenancy,agreements,bookings,inspections,trips,record,passport,profile,rewards,leaderboard,compare,price,support,help,legal,directory}/**`
except `support/messages/**`, the public and legal pages under `app/(site)/**`
and `app/(auth)/**` page shells, and the admin page headers
(`app/admin/**/page.tsx` heads onto one frame). Not: the feed, search, home,
listing, stays and restaurants discovery (Agent FE), messages and the
assistant (lead keeps them), `components/ui/**` and design tokens (Agent FE:
ask), anything native or offline (Agent NATIVE).

1. **SW4 / X-01 / AD-01**: every ordinary page on `PageFrame` (settings first,
   then money, bookings, account, legal and help, then admin's four header
   styles into one), keeping every control and data path.
2. **SW16**: root tabs never show Back; the bell on every root.
3. **SW5**: registrations, wallet send and withdraw, support new, checkout
   progress onto `StepFrame`; **SW6** one-choice questions onto `OptionCards`.
4. **SW12**: every page you own has a `loading.tsx` skeleton in its own shape.
5. Tick every page in `PAGE_LEDGER.md` as you pass it.

## Agent NATIVE (iOS and Android, performance, offline; with the lead)

The founder, 7 November 2026: the native work deserves its own high end
engineer working beside the lead. Brief section 11 (cross-platform), the
premium iOS brief, the deep WebView performance audit and the offline
sections are its source (docs/handoff/FOUNDER_BRIEF_VERBATIM.md).

Owns: `lib/native/**`, `lib/offline/**`, `components/app/offline/**`,
`components/app/NativeRuntime.tsx`, `components/startup/**`,
`lib/ui/feedback.ts` (haptics), `capacitor.config.ts`, `android/**`, `ios/**`,
`native-shell/**`, `public/.well-known/**`, `public/sw*.js` and the service
worker sources, `perf-budget.json`, new `lib/platform/**`, new
`app/css/platform.css` (imported once, after grade1.css), and
`docs/handoff/NATIVE_BUILD_QUEUE.md`, `docs/handoff/PERFORMANCE_REPORT.md`,
`docs/handoff/DEVICE_TEST_MATRIX.md`. Anything in a component outside these
goes to the lead as a one-line request; never edit another agent's files.

Already done by the lead (keep, build on it): status bar holds (N2),
keyboard foot on the keys and the SystemBars decision (N3, N5), step-flow
Android Back and predictive back in the manifest (N4), deep links for
threads, notifications and bookings (N6), the tab haptic (N7), push kick on
enqueue (N1), resume refresh (N9), the crash log (`lib/observability/**`,
lead's).

1. **Platform-aware layer, one codebase.** At boot put `data-platform`
   (`ios`, `android`, `web`) and `data-native` on `<html>` (before first
   paint where possible, through the existing startup script). Then
   `app/css/platform.css` adapts, never forks: iOS press highlight and dim,
   Android Material-style touch ripple (transform and opacity only, cheap on
   budget phones); iOS push transition (slide from the right, back slides
   out) vs Android fade-through for page changes, both through one shared
   transition helper, reduced motion honoured; scroll edge behaviour
   (iOS bounce kept, Android overscroll glow left native). Same brand,
   same tokens.
2. **iOS shell polish for build 1.0.2**: edge swipe back in the web view
   (`allowsBackForwardNavigationGestures` in the iOS project), link preview
   off, the app switcher privacy cover for money screens (queue item 5),
   native crash capture on next launch (item 6, into `/api/client-error`
   with platform ios), the animated launch hand-off with the exact logo and
   wordmark (item 7). Android twins where they exist. Every native change is
   listed in NATIVE_BUILD_QUEUE.md; none ships until the planned build.
3. **Connection manager (offline brief).** One shared state: connected,
   slow, unstable, offline, reconnected (from `navigator.onLine`, the
   Network Information API where present, and real request timing). One
   calm Vallo strip and the existing banner for changes; the offline screen
   upgraded (status, Try again, saved and recently viewed from the existing
   shelf and pack stores, a way home, automatic recovery). Cached prices and
   availability always labelled "Saved on your device. Price and
   availability may have changed." (KeptPriceNote exists: reuse). On
   reconnect: refresh, replay only safe queued actions through the existing
   outbox and replay guard, never a payment or booking without confirmation.
4. **The performance audit, measured, both platforms separately.** Build
   production (`next build` then `next start -p 3100`), then with the
   preinstalled Playwright Chromium measure on emulated budget Android
   (CPU 6x and 4x throttle, Slow 4G and Fast 3G, 360x800, deviceScaleFactor
   2) and an emulated iPhone profile: cold and warm load, time to first
   usable screen, long tasks, JS bundle per route, image bytes, memory over a
   60-navigation loop (`performance.memory`, detached nodes), scroll frame
   timing on search and the feed. Real WKWebView and real Android devices are
   NOT available here: say "simulated" on every number. Write
   `docs/handoff/PERFORMANCE_REPORT.md` (separate iOS and Android sections:
   baseline, bottlenecks, fixes, after, remaining) and fix the top
   bottlenecks inside your files; anything in a component goes to the lead as
   a request with the measurement.
5. **Device test matrix** `docs/handoff/DEVICE_TEST_MATRIX.md`: every check
   in brief section 11 ("Cross-Platform Testing") per platform, marked
   automated here, simulated here, or needs a real device, with the exact
   steps for the founder's iPhone.
6. Then audit the Capacitor config and every plugin on both platforms
   (versions, permissions strings, Info.plist and manifest entries, privacy
   manifest) and fix what is wrong for build 1.0.2.

## Lead (native with Agent NATIVE, backend, coordination)

Native review and the requests Agent NATIVE sends for component files,
backend (D-02 policies, R-04 idempotent alerts, B-05 read waves), the crash
log follow-ups, Vallo Circle, and every review, gate and commit.
