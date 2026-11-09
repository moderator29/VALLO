# VALLO: PLATFORM GRADE 1 READINESS (HANDOFF)

> **MAIN SOURCE OF TRUTH: `docs/handoff/FOUNDER_BRIEF_VERBATIM.md`.**
> It is the founder's own message, word for word. Read it fully FIRST and
> work from it. This handoff is support: repo facts, current state, patterns
> and process. Wherever the two differ, or this file leaves something out,
> the founder's brief wins. Re-read the brief at the start of every phase.

Written 6 November 2026 by the session that shipped the 1.0.0 App Store
release, the push entitlement fix, the bell crash fix and the deploy watcher.
This is the brief for the next session. Read ALL of it before touching code.
Then read it again when you finish each phase.

The founder writes fast, informally and with a lot of energy. Read for the
intent, not the spelling. When something is ambiguous, pick the reading that
makes Vallo cleaner, more native and more trustworthy, and say what you chose.

---

## 0. THE ONE-PARAGRAPH VERSION

Vallo is LIVE on the App Store (version 1.0.0, 146 countries, Nigeria
included). It is a Next.js 16 web platform shown inside a Capacitor shell on
iOS and Android. The founder has studied a competitor, **Hauslet** (App Store,
"Shortlets, Rentals & Homes", about 16 ratings, version 1.0.3), and wants Vallo
to feel at least as native, calm and premium as Hauslet, and then better:
more features, better flows, a stronger identity. **This is an UPGRADE, not a
rebuild.** Keep Capacitor, keep the backend, keep every working feature, keep
the data. Elevate every single page: typography, spacing, containers, motion,
feedback, navigation, offline behaviour, native integrations. The goal is
launch readiness on iOS, Android and the web, without delaying the next App
Store submission.

---

## 1. THE FOUNDER'S RULES (NON-NEGOTIABLE)

1. **Branch. CONTINUE THE EXISTING WORK, DO NOT START A NEW LINE OF IT.**
   (The founder, 9 November 2026: work on the branch the last two sessions
   worked on.) Two sessions have already put 336 commits into this upgrade.
   That work is on `origin/claude/fervent-cray-1vzbp1`, which contains every
   commit of `origin/platform-grade-1-readiness` plus 155 more, so it is a
   strict superset and no work is lost by taking it. The founder wants it all
   under the name he chose, so the first commands of the session are:

   ```
   git fetch origin
   git checkout -B platform-grade-1-readiness origin/claude/fervent-cray-1vzbp1
   git merge origin/main
   git push -u origin platform-grade-1-readiness
   ```

   The merge picks up `main`'s newest work, including
   `PROTECTED_PAYMENTS_BUILD.md` and `PROTECTED_PAYMENTS_SPECS.md`, which do
   not exist on the work branch yet. Resolve any conflict, never reset it
   away, and report what was resolved. Do NOT cut a fresh branch from `main`:
   that silently throws away everything the last two sessions built, which is
   the single most expensive mistake available in this document.

   From then on: ONE branch, `platform-grade-1-readiness`, and EVERY piece of
   this work lives on it from the first note to the last polish commit.
   Commit and push to it often: Vercel builds nothing for this branch, so pushing is free and it
   means nothing is ever lost with a session. Do not open side branches for
   sub-pieces, and do not work directly on `main`. Never push to `main`, and
   never merge into `main`, unless the founder's message contains the words
   "push to main"; an automated safety check has blocked pushes without that
   phrase before and it will again. When he does say it, push the whole branch
   to `main` in one go and report what went live.
2. **No Vercel previews. No Vercel spending.** The founder paid about 96 USD
   for preview builds nobody asked for. `apps/web/vercel.json` now carries
   `git.deploymentEnabled` with `platform-grade-1-readiness`, `claude/**` and
   `dependabot/**` switched OFF, so pushes to those branches build nothing on
   Vercel. Keep it that way. Do not run `vercel` CLI deploys. Do not open
   preview links. Verify locally (`next build`, `next start`, Playwright in the
   sandbox) and on GitHub only.
3. **GitHub Actions minutes are exhausted** for the account (100 percent of the
   included minutes, 6 November 2026). CI on `main` will not start until the
   founder fixes billing or the month resets. Do NOT trigger workflows. Do not
   rely on CI for verification: run the gates yourself (section 9). iOS builds
   (`Native iOS` workflow, macOS minutes at roughly 10x) also need minutes:
   tell the founder before any new iOS build is needed.
4. **Agents: SIX PER BATCH, up to eight on genuinely independent work (the
   founder raised this from two on 9 November 2026: "go hard on things, 5-6
   agents on batch").** Go hard, run them in parallel, use the session. The
   rule that does NOT bend: never two writers in the same files. Before you
   launch a batch, write down the exact paths each agent owns, check that no
   two overlap, and put the owned paths in the agent's brief. Brief each one
   in full: it knows nothing you do not tell it, including the founder's rules
   in this section. If a job cannot be split cleanly by file, do it yourself
   in sequence rather than racing. A batch that "mostly worked" is a batch
   that damaged files: read the diff of every agent's work before you commit
   it, and never report a batch as done on an agent's word alone.
5. **Re-audit every piece of work.** After each workstream: re-read the diff
   adversarially, run the gates, look at the screens at phone width (390 x 844
   and 360 x 800) in light and dark, then fix what you find. Only then move on.
6. **No em dashes anywhere** (code, copy, docs, commits). The repo enforces it:
   `node apps/web/scripts/check-no-em-dash.mjs`. Use a colon, a comma or two
   sentences.
7. **English only for new copy** unless a translation is verified. Do not
   invent Yoruba, Hausa or Igbo strings.
8. **Never print, paste or commit credentials.** Keys go in Vercel or Supabase
   settings by the founder, never in chat.
9. **No model identifiers** in commits, PR text, code comments or docs.
10. **Do not copy Hauslet's (or X's) branding, logos, exact screens, text or
    assets.** Learn the patterns, then build a distinct Vallo version that is
    better. Vallo keeps its own identity, colours and voice.
11. **Never claim something works unless you ran it.** Say "built, not tested
    on a device" when that is the truth. The founder tests on a real iPhone.
12. **Company payments need all three founders' approval.** Never add a paid
    service, plan or dependency with a running cost without asking.
13. **Keep the email system's dark/light theme rules** (`lib/email/theme.ts`:
    inline LIGHT, `rm-*` classes repaint to DARK).
14. Industry-standard mobile behaviour always beats a clever web pattern. The
    founder rejected a full-page "Weak connection" screen before: brief,
    small, in-place signals only.
15. Commit in small, well-described commits. Push the branch often (it no
    longer costs Vercel money). Never rewrite history on `main`.

---

## 1B. WHO YOU ARE WORKING FOR, AND HOW HE WANTS YOU TO WORK

Read this twice. More sessions have annoyed this founder by HOW they worked
than by what they built.

**The person.** Sole technical decision-maker on Vallo, non-engineer, in
Nigeria, working from a phone a lot of the time. He writes fast, informally,
in long bursts, with typos and voice-note energy ("you get me ?!", "bro").
That is enthusiasm and urgency, never disrespect, and it is never vague about
what he wants: read for INTENT, act on it, and never ask him to rewrite a
message more clearly. He is paying real money for this out of a thin budget
and he is preparing to launch publicly. Treat every naira and every hour as
his, not yours.

**Work autonomously. This is the big one.**
- He says "go", and expects you to go: audit, decide, build, verify, report.
  Do not come back with a menu of options and ask him to choose between things
  he hired you to judge. Make the call, say what you chose and why in one
  line, and move.
- NEVER ask permission for work that is already in this handoff or in his
  brief. It is already approved. Asking again wastes his day.
- Do ask (once, briefly, with a recommendation attached) only when: money
  would be spent, something irreversible or outward-facing would happen, a
  decision changes his product strategy or legal position, or two readings of
  his words would lead to genuinely different platforms.
- When you are blocked, do not idle. Park the blocked item, say so in your
  next report, and carry on with the next thing.
- Keep going to the end of a workstream. He hates being handed a half-finished
  thing with a list of what you did not do.

**How to talk to him.**
- Plain language, short sentences, no jargon, no filler, no flattery. He is not
  an engineer: say "the screen that crashed when you tapped the bell", not the
  component name, unless the file name is the point.
- Lead with the answer, then the detail. Never bury the result.
- Be specific about state: "built and tested", "built, not tested on a device",
  "not started". Never blur those three.
- Tell him the truth immediately when something is broken, when you were
  wrong, or when you cannot verify something. He has caught earlier sessions
  guessing and he remembers it. "I don't know yet, here is how I'll find out"
  is always acceptable; a confident guess is not.
- No em dashes, ever, in anything (code, copy, docs, commits, chat).
- When you finish a group of work, tell him exactly what HE must do next on
  his phone, step by step, numbered.

**His quality bar.** He looks at Hauslet and feels joy; he looks at Vallo and
feels embarrassed. That gap is the whole job. "It works" is a failing grade.
Every screen must look deliberate, calm, expensive and finished. If you ship
something you would not screenshot and show off, you have not finished it.

**What he will do, so you can plan around him.** He installs TestFlight builds
and tests on a real iPhone. He sends screenshots rather than logs. He will
send roughly 60 or more Hauslet references. He runs SQL you give him. He says
"push to main" when he wants the world to see it, and not before.

---

## 2. CURRENT STATE YOU INHERIT (VERIFY EACH ONE)

| Item | State on 6 November 2026 |
|---|---|
| App Store | 1.0.0 approved and live. Availability set to 146 countries. 29 cannot sell: Afghanistan (Apple) and the EU (Trader Status not declared, App Store Connect, Business, Compliance). |
| Build 1.0.1 | Uploaded to App Store Connect by Native iOS run #156, build number 10001156. Push entitlement verified inside the IPA. Founder is installing it through TestFlight internal testing to test push. Version page 1.0.1 must be created in App Store Connect (the plus next to iOS App) before submitting. Screenshots for 1.0.1 wait until this upgrade is done. |
| Push | WORKING END TO END as of 7 Nov 2026: APNs env set in Vercel, build 1.0.1 carries the entitlement, the founder's iPhone enrolled (push_enrol_log id 9, a live row in push_tokens), and the iOS gate flag `native_push_apns` in `feature_flags` is OPEN (the drain refused iOS while it was missing; every queue row ended suppressed_no_device). The drain runs every 5 minutes via pg_net. A device on the App Store 1.0.0 build still fails enrol with os-no-valid-aps-environment-entitle until 1.0.1 is released. `push_enrol_log`, `push_queue.outcome` and `push_deliveries` tell you exactly where any future failure sits. |
| Notification bell | Crash fixed (`lib/supabase/channel-name.ts`, unique names for database-listening channels). Confirmed on the founder's phone after a reinstall. |
| Stale code on phones | The service worker kept page copies for up to 7 days with old script names, so fixes reached phones late. Commit `2ca5b9013` adds `components/app/DeployWatch.tsx`, `lib/deploy/watch.ts`, `app/api/build/route.ts`, `NEXT_PUBLIC_BUILD_ID` and cache version v8. On the branch `claude/rentme-v2-platform-audit-xuvg0a`, NOT yet on main unless the founder said "push to main". Check `git log origin/main`. |
| Crash recorder | Browser crashes are stored as scrubbed alerts in `public.risk_alerts` (description starts `client.error`, `entity_id` is the `C-XXXXXX` reference shown on the error screen). Use it. |
| CI | Red on main for days before the minutes ran out (Build, Typecheck, npm audit, accessibility gates, database probes; Test cancelled at 35 minutes). Root cause not yet found. Not caused by recent work. Worth fixing once minutes are back. |
| Newsletter | Built, not sent. SQL ready in `supabase/migrations/pending/newsletter_default_on_2026-11-launch.sql` (backfill 17 default-off members, check count of 23, then enqueue). Founder runs it. |
| Real listing | "2bedroom in okitipupa" approved, unpublished: needs charges at the door declared and an approved mandate (or recreate as owner listing). |

---

## 3. THE CODEBASE, IN ONE PAGE

- Monorepo. Web app: `apps/web` (Next.js 16 App Router, Turbopack, React 19).
  **Read `apps/web/AGENTS.md` first: this Next.js has breaking changes; read
  `node_modules/next/dist/docs/` before writing framework code.**
- Shared packages: `packages/i18n` (dictionaries, `*.en.ts`).
- Database: Supabase project `uccixoonmbhrnyczyigt`. 752 migrations, recorded
  in `supabase/migrations/APPLIED.txt` (`node scripts/check-migrations.mjs
  --record` after applying). Row-level security everywhere. Apply with the
  Supabase MCP tools, then commit the file under the version the server stamped.
- Size: about 559 pages, 903 component files, 189 server-action files, 55 API
  routes. Huge test suite (vitest unit + browser DOM tests; full run about 25
  minutes, run it in the background).
- Native: `apps/web/ios` and `apps/web/android` (Capacitor 8). The app loads
  `https://www.vallospaces.com`. Service worker `apps/web/public/sw.js` keeps
  pages and assets for instant and offline opens. Plugins: app, browser,
  camera, haptics, keyboard, push-notifications, share, splash-screen,
  status-bar, plus native SignInWithApple and a widget.
- **Capacitor plugin trap (learned the hard way):** never return a plugin object
  from an `async` function or resolve a promise with it. The promise machinery
  reads `.then` and the plugin Proxy throws "X.then() is not implemented on
  ios". Carry it inside an object (`{ plugin }`). See `lib/native/device.ts`.
- **Realtime trap:** a database-listening channel must use
  `ownChannelName()`; broadcast channels (typing, calls) keep shared names.
  A guard test enforces it.
- Shell and navigation: `components/app/AppShell.tsx`, `ShellDock.tsx`,
  `AutoHideDock.tsx`, `CreateDock.tsx`, `DockMore.tsx`, `NavTree.tsx`,
  `SideSwitch.tsx`, `nav-model.ts`, side nav CSS `app/side-nav.css`.
- Feedback today: `components/ui/Toast.tsx`, `DetailsHost` (one toast, the
  connection line, back to top), `ConnectionLine.tsx` (brief "Slow
  connection"), success moments (`docs/SUCCESS_MOMENTS.md`, `SuccessFlagHost`).
- Offline: `lib/offline/*` (outbox in IndexedDB `vallo-outbox`, `setOrKeep`,
  `sendOrKeep`, `retryLost`), `components/app/OfflineTray.tsx`,
  `docs/OFFLINE_AND_FAST_START_PLAN.md`.
- Passcode: `components/passcode/PasscodeGate.tsx` is mounted in
  `app/(app)/layout.tsx`. `docs/PASSCODE.md`.
- Phone at sign-up: `app/(auth)/sign-up/phone/page.tsx`,
  `lib/phone-otp/signup-gate*.ts`, `SIGNUP_PHONE_PATH`.
- Listing wizard: `app/agent/list/ListingWizard.tsx` (+ actions, steps tests).
- Identity checks: `app/(app)/verification`, manual KYC with live selfie,
  admin desk `app/admin/kyc`. `docs/identity`.
- Messages: `app/(app)/messages`, `components/app/messages/*` (VoiceNote,
  voice.ts, QuotedReply, BubbleGestures, forward), calls `lib/calls/*`.
  Audit what exists before building: voice notes exist in part; confirm
  reactions in the schema before adding a table.
- AI assistant: `app/(app)/assistant`, `docs/AI-ASSISTANT.md`, consent in
  `lib/ai/consent.ts`. Support: `app/(app)/support` (+ messages, new),
  `docs/SUPPORT_STAFF.md`.
- Admin: `app/admin/*` (staff, support, social, kyc, listings, queue, money,
  oversight and more). `docs/ADMIN_CONSOLE.md`.
- Maps: Leaflet with Carto basemaps today. CSP allows `api.maptiler.com`.
- Icons: `design-system/icons` (`UiIcon`, glyphs), `docs/ICON_SYSTEM.md`.
- Docs worth reading before design work: `docs/DESIGN_DIRECTION.md`,
  `docs/PRODUCT.md`, `docs/MOBILE.md`, `docs/PAGE_SWEEP.md`,
  `docs/RESPONSIVE_RESEARCH.md`, `docs/SOCIAL_DESIGN.md`,
  `docs/NOTIFICATIONS_MAP.md`, `docs/RULINGS.md`.

---

## 4. WHAT THE HAUSLET SCREENSHOTS SHOW (STUDY THESE PATTERNS)

The founder will send about 60 more screenshots in the new session. Treat each
as a reference for PATTERN, not for copying. What has already been seen:

**Look and feel**
- Very calm, light, mostly white and soft grey surfaces; one accent colour
  (purple) used sparingly for the active state, progress and key labels.
- Large bold page titles ("Profile", "Calendar", "How to list your property on
  Hauslet"), generous spacing, big rounded containers (about 24 to 28 px
  radius), thin 1 px borders instead of heavy shadows.
- Thin, consistent line icons with labels in the bottom tab bar (Explore,
  Hausmates, Search, Messages, Account). Active tab tinted, avatar as the
  Account tab.
- Primary buttons are full-width, tall (about 56 px), pill shaped, black or
  accent; secondary buttons are pale grey pills.
- Small uppercase accent "eyebrow" labels above step titles (LOCATION,
  PHOTOS, FINISH, THE BASICS).

**Flows**
- **Role switch.** A floating dark pill "Switch to Agent Tools" on the
  profile, and a "Switch account" bottom sheet (personal account, create
  organization). The agent side has its own tab bar (Dashboard, Listings,
  Activity, Calendar, Account). **The founder wants Vallo's version in the
  SIDE NAV** (and reachable on mobile), with a smooth switch that also works on
  low or no data from cache.
- **"What do you manage?"** sheet on first entry to the agent side: Rentals,
  Shortlets, Sales, A mix of services; each with a one-line explanation; a
  selected card shows a tinted fill, border and tick; "Continue" plus "Skip
  for now (use All)". It tailors the dashboard.
- **Calendar** for agents: month grid of rounded day cells, today tinted,
  legend chips (Check-in, Check-out, Viewing, Blocked with counts), filter
  "All" and a property picker.
- **Listing wizard: one question per screen, 12 steps.** Top bar: back, a green
  "Saved" tick (autosave), close. A thin progress bar under it. Bottom bar:
  "Step N of 12" and a big Continue. Steps: what you are listing (Shortlet,
  Property for rent, Property for sale), your connection to it (landlord,
  agent, developer, independent), property kind and type (grid of tiles:
  Apartment, Flat, Duplex, Studio, Room, Serviced Apartment, Guesthouse,
  Penthouse, Bungalow, Terrace, Maisonette, Mansion, Fully Detached,
  Semi-Detached), location (search or fill State, Area, Street; house number
  optional; "you don't need to be there"), "Is the pin on the entrance?" with
  a full-screen map pin picker ("Place pin here", "Use my location is only for
  someone standing at the property", "Use this pin"), rooms (number chips for
  bedrooms, bathrooms, toilets optional), pricing with extra charges (cards
  with amount, naira or percent toggle, Once / Yearly / Monthly segmented
  control, "Add another charge", and a live summary "A tenant pays to move in:
  N250,000 (one rental period plus these charges)"), photos ("At least 3. We
  sort them into rooms, the first is your cover", cover crown badge, progress
  banner "Add 2 more photos, 1 ready"), description (title with 0/150
  counter, description with "73 / 50 min" counter turning green, "Write with
  AI", "Rewrite from my answers", a consent dialog naming the AI provider and
  exactly what is shared), and a final "Check your listing" review page
  (summary card, every answer with a "Change" pill, a red "1 thing to fix"
  banner such as "Verify your identity before submitting", then "Submit for
  review").
- **Identity verification** (opens in the in-app browser on
  verify.hauslet.com): intro screen with what will happen (where your ID was
  issued, photo of your ID, a live selfie, privacy protected: "Any ID number
  you enter is encrypted and never shown back to you or to reviewers"),
  Continue / "Cancel and return to app"; a 7-step stepper (Country, Document,
  ID number, Capture, Upload, Selfie, Review); country list with search and
  POPULAR (Nigeria, Ghana) then all countries; document choice cards
  (National ID card, Passport, NIN slip, Driver's licence); capture with
  "Review your documents", Zoom in, Retake; a live "Quick selfie check" with
  an oval face guide and "Start video check"; "Review and submit" with a
  "Final step, submission required" notice. Verification is required BEFORE
  any deal (submitting a listing), not at sign-up.
- **Help articles** ("Pages / Resources for hosts / How to list your
  property"): long-form guides with real screenshots of each step, tips in
  tinted callouts, "Before you start" checklists. **Vallo needs its own help
  centre in this style, with Vallo's own screenshots and flows.**
- **Permissions in context**: the notification prompt appears on the profile
  after sign-in, not on first launch.
- **Privacy choices** sheet: "Help us improve your experience", Accept all /
  Only necessary / Manage preferences, plain language.
- **Policy pages** open as bottom sheets with a grabber, a close button and a
  "Go Back" button.
- Hauslet shows offline status and saved content clearly when the connection
  drops (the founder liked this; see their earlier screenshot).

**Second batch of screenshots (seen by the previous session, 6 November).**
The founder will send ALL of these again, and many more, in the new session.
Expect well over 60. Record every one in `REFERENCE_PATTERNS.md`.
- **Sign-in completion as stacked bottom sheets over a blurred page.** A top
  success banner "Signed in successfully." with an X, then a sheet "Confirm
  your information": note "Private Apple Email Detected" (relay address shown,
  change it later in Account Settings), Full name field ("make sure your name
  matches your government-issued ID"), "Save and continue" / "Skip for now".
  Next banner "Thanks, your profile is confirmed." and a sheet "Add a profile
  photo" (optional, big avatar circle, "Choose a photo" / "Skip for now").
- **Community commitment** full page: brand mark, eyebrow "COMMUNITY
  COMMITMENT", big headline, a tinted card with a tick and the
  non-discrimination pledge, "Learn more", bottom bar Decline / Agree and
  continue. Vallo should have its own commitment page in its own words.
- **Personal information** page: tabs (Basic information, Travel companions);
  rows Legal name, Display name, Email (masked), Phone number(s) "Not provided"
  with why it is needed ("for confirmed guests, hosts, agents and us to get in
  touch"), ID verification "Not started", Residential address, Emergency
  contact; each with a grey "Edit / Change / Add / Start" pill. This is where
  phone and ID live instead of sign-up.
- **Agent dashboard cards**: workspace switcher pill ("Personal, Vallo
  Spaces") with chevron, bell with a count badge; task cards with icon, title,
  one line, and inline actions ("Set up payout / Dismiss / Snooze...",
  "Verify your phone number"); "Workspace finances" horizontal cards (Next
  payout, Pending, naira with small decimals); a bold accent "Find leads"
  promo card with a white pill button.
- **Your Listings**: segmented filter with counts (All 1, Shortlets 0,
  Rentals 1, Sales 0), icon buttons (filter, live, location) and a search
  field, listing cards with an image placeholder, type label, title, Status
  "Draft", Published "Not Published", and a floating plus button.
- **Explore** home: big pill search "Find your next place", tabs Shortlets /
  Rentals / Sales with an underline, heading "Explore Shortlets." (accent full
  stop), rails "Near Lagos >" and "Trending in Lagos >" of large rounded photo
  cards with a glass type chip, heart, and a glass pill of beds / baths /
  guests; title, area, price "per 1 Night".
- **Listing detail**: hero photo with glass back, share and heart buttons and a
  glass chip "Shortlet . Lekki phase 1, Lagos"; thumbnail strip with the active
  one lifted and tilted; centred title and subtitle; three-column facts
  (Service type, Property type, Occupancy type); a bordered pill of guests,
  bedrooms, bathrooms; host card with verified badge and a black round message
  button; sticky bottom bar with price, dates and "Book Now".
- **Move-in charges step**: chips with radio circles (None, Caution, Legal,
  Agency, Service Charge, Registration, Estate Maintenance, Cleaning), "Add
  another charge"; selected charges become cards (amount, naira or percent,
  Once / Yearly / Monthly) and a live total.
- **ID capture**: "Capture 1 of 2, Front of document", "Keep all four corners
  visible. Rotate the guide for a vertical card", live camera with a rounded
  guide frame, "Auto capture" checkbox, big shutter, "Upload instead", "Rotate
  guide"; then "Review your documents" (Zoom in, Retake front, Retake back,
  "Continue to upload"); then "Review and submit" with Captured badges,
  "Selfie check complete / Retake selfie", "Submit for verification", and
  "Verification begins immediately once submitted."
- **Help guide** page with "Before you start" bullets and a row of action chips
  (Add listing, Applications, Find leads, Calendar).

Privacy note for the new session: some screenshots show the founder's real
identity document and number. Never copy them into the repository, docs or
help pages. Help-centre screenshots must use demo data only.

**The founder also referenced X (Twitter)** for: the success banner at the top
("Your post was sent" style), the bottom navigation efficiency, thin icons.
And **ChatGPT's composer**: a slim rounded input with a mic (voice) icon and a
send button. Vallo's message composer and AI assistant composer should feel
like that.

---

## 4B. THE VALLO GRADE 1 DESIGN LANGUAGE (BUILD THIS FIRST, THEN APPLY IT EVERYWHERE)

The founder's instruction is "every single page, not too much, not too little".
That is only achievable if the language is decided ONCE, in tokens and shared
components, and then applied. Do not hand-tune screens one by one.

**Decide and write down (in `docs/UX_SYSTEM.md`) before touching pages:**

1. **Surfaces.** Page background, raised card, sunken field, overlay scrim.
   Hauslet's calm comes from near-white surfaces, 1px hairline borders and
   almost no shadow. Vallo keeps its own palette and its dark mode; take the
   STRUCTURE, not the colours.
2. **Radii.** One scale. Large containers and sheets read around 24 to 28px,
   cards around 16 to 20px, chips and fields around 12 to 14px, pills fully
   round. Pick the numbers, name them, use nothing else.
3. **Spacing.** One rhythm, generous. Page gutter, section gap, card padding,
   row gap, and a consistent distance from the title to the first control.
   Crowding is the fastest way to look cheap.
4. **Type.** One scale: page title (large, bold, tight), section title, body,
   caption, and the small uppercase accent "eyebrow" label that Hauslet uses
   above step titles (LOCATION, PHOTOS, FINISH, MOVE-IN CHARGES). Vallo already
   has a type-weight test; keep inside it.
5. **Accent discipline.** One accent carries meaning: the active tab, progress,
   the eyebrow label, the selected state, the primary action. Everything else
   is ink and grey. Two accents fighting is what makes a screen look amateur.
6. **Buttons.** Primary: full width, tall (about 56px), pill, high contrast.
   Secondary: pale pill, same height. Quiet: text only. One primary per screen.
   Hauslet pairs a dark primary with a pale secondary and it always reads.
7. **Icons.** Thin line icons, one stroke weight, one size scale, one family.
   Audit `design-system/icons` and remove anything heavier or rounder than the
   rest. Active state is a fill or a tint, never a different icon.
8. **Glass.** Only on floating things: the dock, sheets, the feedback banner,
   controls over photos (the back, share and heart buttons on a listing hero).
   Never on reading surfaces. Always with a solid fallback for low-end Android.
9. **Motion.** Name the durations and easings. Sheets spring up, steps slide
   sideways, banners fade and lift, lists stagger slightly on first paint.
   Fast (most things 180 to 260ms), never blocking, always respecting reduced
   motion and the in-app Motion setting.
10. **States.** Every screen defines: loading (skeleton shaped like the real
    content, never a spinner alone), empty (art, one line, one action), error
    (plain sentence, retry), offline (what is cached, what may have changed).

**The four shared components every screen then uses.** Build these before the
page work, because they are what makes 559 pages look like one product:
- `FeedbackBanner` (P0.4): the one global success, error, info surface.
- `Sheet`: the bottom sheet with a grabber, a close X, a title, scroll and a
  sticky footer. Hauslet uses this for confirm-your-name, profile photo,
  policies, account switching and "What do you manage?".
- `StepFrame`: back, "Saved" tick, close X, progress bar, eyebrow, title,
  subtitle, content, sticky bottom bar with "Step N of M" and Continue. This
  is the listing wizard, the verification flow and any future long form.
- `PageFrame`: the large page title, the optional tab row, the safe areas,
  the scroll behaviour and the dock spacing, so no page re-invents its header.

**Definition of done for every screen you touch** (the founder's "must be
every single page"): tokens only, no stray values; works at 390x844 and
360x800; light and dark; loading, empty and error states exist and look
designed; safe areas respected; one primary action; thin icons; motion
respects reduced motion; keyboard does not cover the thing being typed into;
nothing shifts after load. Screenshot it locally before saying it is done.

---

## 5. THE WORK, IN PRIORITY ORDER

Each item lists: goal, where, acceptance. Re-audit after each.

### P0. Do first (they block launch quality)

**P0.1 Passcode is optional, not a gate.** Today `PasscodeGate` sits in the
member layout. A new member must be able to create an account, sign in and use
the app without ever setting a passcode. Replace the forced setup with a slim,
dismissible alert banner at the top of the dashboard: "Protect your account
with a passcode and Face ID", "Set up", and an X. Dismissal is remembered (per
device, with a gentle re-offer after a long interval, never nagging). A member
who HAS a passcode keeps the lock exactly as now. Money actions keep their own
lock (`MoneyLockGroup`). Update `docs/PASSCODE.md` and the tests.

**P0.2 Phone number out of sign-up.** Remove the phone step from sign-up (email
form, Google, Apple, phone sign-in stays as a sign-in method if it exists).
Ask for and confirm the phone number at the moment it is needed, like
Hauslet's "verify before you submit": before the first booking request,
listing submission, wallet or payout, or a deal. Keep `confirmed_phones` and
the all-countries `PhoneField`. Make sure no server path still requires
`phone` at account creation (`handle_new_user`, `signUpWithEmail`,
`signup-gate`).

**P0.3 Verification before deals, upgraded.** Keep Vallo's manual KYC (live
selfie, admin face check) and rebuild its screens as a premium stepper in the
spirit of section 4: intro "what will happen", country (search, Popular:
Nigeria first), document cards, ID number (encrypted, never shown back),
capture with review, zoom and retake, live selfie with a face oval, review and
submit, then a clear "under review" state with expected time. Make it a
sequence of full pages with a top stepper, bottom-sheet explanations and
slide transitions. Gate deals (listing submit, booking, payout) on it with a
friendly "1 thing to fix" card linking straight to it.

**P0.4 Global feedback banner.** One central system for success, info, warning
and error: a wide rounded banner under the status bar (safe-area aware), icon
plus specific text ("Saved to your list", "Message sent", "Listing submitted
for review", "Welcome to Vallo"), smooth slide and fade, auto-dismiss, swipe or
X to dismiss, a queue that replaces instead of stacking, retry action on
failure, accurate states (queued is not sent). Migrate every existing toast and
ad-hoc success line to it. Respect reduced motion. Works on iOS and Android.

**P0.4b Push permission as a default onboarding step: BUILT on 7 Nov,
POLISH AND EXTEND IT.** The previous session built it the same day the founder
asked: first run now ends on a `notify` beat (`components/app/welcome/
FirstRun.tsx`), where `<PushPrompt moment="joined">` shows Vallo's own offer
screen with "Yes, tell me" and "Not now". It reaches everyone finishing the
member welcome, with or without the interests question; `InterestChoices`
hands completion back through `onFirstRunDone` instead of leaving for home
(deliberately without `router.refresh()`, whose re-plan would redirect out
from under the step). The step settles itself instantly wherever it cannot or
should not show (granted, denied, declined recently, unsupported), so it never
traps anyone; a No is remembered for 30 days and the existing four moments
re-offer later. Tests: `components/app/push/joined-moment.dom.test.tsx` and
`moments.test.ts`. YOUR JOB: polish it to the Hauslet standard and extend it.
Ideas the founder wants explored: welcome-grade art and motion on the step
(today it reuses the question beat's canvas with the stock PushPrompt card),
a success beat after a Yes ("You're set"), choose-your-topics on the same
screen, the Android 13 wording, analytics of yes/no rates, the same offer as
a dashboard task card for people who skipped, and keeping it in step with the
new global feedback banner.

**The original ask (founder, 7 Nov).**
Today the app only offers notifications at four "moments" (`components/app/
push/moments.ts`, whose comment says NEVER on sign-up). The founder overrides
that: asking must be a DEFAULT step of joining, the way Hauslet asks right
after sign-in. Build it as a Vallo screen inside onboarding (after the account
exists and the member is inside the app, during the welcome/first-run steps):
what they will get, Turn on / Not now. Yes triggers the one system prompt.
"Not now" costs nothing and the existing moments re-offer later. Keep the
one-prompt-per-install discipline (a declined SYSTEM prompt is permanent on
iOS), so the Vallo screen always comes first. Every notification kind must
deliver to the lock screen subject to the person's switches; test with the
app closed and Do Not Disturb off.

**P0.5 Native polish basics.** Status bar style per screen (light/dark),
safe areas everywhere (top, bottom, notch, home indicator), haptics on taps and
success (via the fixed `lib/ui/feedback.ts`), keyboard: composer stays above
the keyboard, focused inputs scroll into view, Next/Done actions, no layout
jumps. Android: edge to edge, back button and predictive back, window resize.

### P1. The Hauslet-level upgrades

**P1.1 Listing wizard: one question per screen.** Re-flow
`app/agent/list/ListingWizard.tsx` into Hauslet-style single-question pages
with autosave ("Saved"), progress bar, "Step N of M", Back, Close, a final
"Check your listing" page with Change pills and a "things to fix" list. Keep
every existing Vallo rule (supply proof gate, SCUML mandate, charges at the
door for stays, photo rules, moderation). Add the live "a tenant pays to move
in" summary, the extra-charges cards (amount, naira/percent, once/yearly/
monthly), the property type tile grid, the full-screen pin picker, the
AI writer with a clear consent dialog and an undo of the AI change.

**P1.2 Role switch in the side nav.** A "Switch to agent tools / Exit agent
tools" control in the side nav (desktop and the mobile drawer), plus the
mobile pill where it fits. The agent side gets the "What do you manage?" sheet
on first entry and its own calm dashboard (Dashboard, Listings, Activity,
Calendar). The switch must be instant and work on weak or no data from the
cached shell (the service worker keeps both sides' pages).

**P1.3 Messages, like a great chat app.** Composer like ChatGPT's: slim rounded
field, mic for a voice note (hold or tap to record, cancel by sliding, waveform,
playback speed), send button that appears when there is text. Reactions on
any message, voice note, call record and video call entry (long-press menu
with a reaction row, counts under bubbles, realtime). Sent / delivered / read /
failed states that are true, retry on failure, image upload progress, typing
indicator, smooth scroll and new-message pill. Confirm what exists first
(VoiceNote, BubbleGestures) and finish rather than duplicate.

**P1.4 AI assistant and support inside Messages.** A permanent pinned
conversation at the top of the inbox, "Vallo Assistant", always present even
when the member has no other chats. It opens like a normal chat. Inside it, a
clear button "Talk to a person" opens a support chat as an inner page, clean
and sharp, connected to the existing support desk (`app/(app)/support`,
`app/admin/support`). Update `docs/AI-ASSISTANT.md` so the assistant's
knowledge matches the platform as it is now.

**P1.5 Offline and connection.** Build on `lib/offline` and `sw.js`:
connected, slow, unstable, offline, reconnected states shown briefly and in
place (never a full-screen error for a weak signal). An offline page with
saved listings, recently viewed, saved stays and restaurants, "Saved on your
device. Price and availability may have changed", Retry, and a route home.
Queued actions replay safely (never duplicate a booking, message or payment;
never auto-submit a payment). Images cached sensibly. Tell people when queued
items succeed or fail. Keep the DeployWatch reload behaviour.

**P1.6 Map.** Replace the raster look with a clean, light vector map
(MapLibre GL with a calm style, or the cleanest option the CSP and budget allow:
MapTiler is already allowed in the CSP but check its pricing with the founder
before using a paid key). Full-screen pin picker like section 4. Low-end
Android must stay smooth: keep a lightweight fallback.

**P1.7 Help centre with real screenshots.** A "Pages / Resources" area
(hosts, guests, agents, restaurants): "How to list", "How verification works",
"How bookings and payments work", "How to report a listing or a person", each
with step screenshots of Vallo's own new screens, tips callouts and "Before you
start" lists. Screenshots are taken AFTER the upgrade, at 2x, with demo data
(never real people's IDs).

**P1.8 Reporting that reaches the right desk.** The founder asked for this
explicitly: a member must be able to report a listing, a person, a message, a
photo or a transaction from the thing itself (an overflow menu on the listing,
the profile, the message bubble, the receipt), in two taps, with a short
reason list and an optional note. Each kind routes to the correct admin queue
(safety, supply, money, support) with the evidence attached, the reporter gets
an honest acknowledgement ("We have it. You will hear from us.") and a trace
they can look up. Nothing silently disappears. Check what already exists in
`app/admin/queue` and the report paths before building a second system.

**P1.9 Media that behaves like a native app.** Photos and video must load,
cache and play the way people expect on a phone: correctly sized images for
the device, no layout jump when they land, a blurred or coloured placeholder
first, swipeable galleries with a counter, pinch to zoom on a listing photo,
inline video that respects Data Saver, never autoplaying with sound, and
cached so a second visit on a weak connection is instant. The founder said
"be it for videos should work cache etc like native iOS or be it android too".
Use the existing image optimiser and service worker rather than a new layer.

### P2. Identity, motion, admin, depth

**P2.1 Vallo's own signature feature (like Hauslet's "Hausmates").** Hausmates
is roommate matching ("share a home with someone verified, only when you both
say yes"). Vallo needs its own, better, named feature. Propose 3 to 5 names to
the founder before building; candidates: **Vallo Kin**, **Vallo Circle**,
**Nest by Vallo**, **Yardmates**, **Vallo Crew**. It should combine verified
co-renting with Vallo's social side (feed, follows, stays, tables), with mutual
consent and strong safety.

**P2.1b The feed and Vallo's inner world.** The founder wants the feed and the
"inner sides" of Vallo to carry the identity, not just the marketplace pages:
a calm, scrollable place where listings, stays, tables, stories and people
meet, with the same containers, motion and voice as everything else. Decide
what the feed is FOR (discovery, trust, belonging), make the card rhythm
beautiful, and make the signature feature (P2.1) live inside it rather than
hiding in a tab nobody opens.

**P2.2 Motion system.** A shared motion vocabulary (durations, easings,
spring for sheets, slide for steps, fade-scale for banners, shared-element-like
transitions for listing card to detail, success animations on key moments:
listing submitted, booking confirmed, verification sent, first message).
Respect reduced motion and the in-app Motion setting. Fast, never blocking.
Explore a simple Vallo mascot or animated brand mark for success and empty
states; if a mascot is not feasible to do well, use animated brand
illustrations instead. Ask the founder before committing to a mascot style.

**P2.3 Containers, glass, typography, icons.** Unify the whole platform:
bigger rounded containers, thin borders, generous spacing, one type scale,
thin consistent line icons (audit `UiIcon`), selective glass only on floating
surfaces (dock, sheets, banners), with a non-blur fallback on low-end Android.
Every single page gets the pass (use `docs/PAGE_SWEEP.md` as the checklist).
Not too much, not too little: calm, serious, premium.

**P2.4 Face ID where it belongs.** Offer Face ID (WebAuthn passkey, already
wired: `lib/passcode/passkey-unlock.ts`) for: unlocking when a passcode is set,
money actions (withdraw, send, pay), viewing sensitive documents, changing
security settings, deleting the account. Never as a forced first-run step.

**P2.5 Admin desks.** Create in `app/admin`:
- **Support / business developer desk.** The founder adds a staff member by
  their Vallo account. Tools: approve and review listings, onboard users met in
  real life or online (help them finish verification and a first listing),
  see and resolve issues, reply to support messages, view reports routed to
  them. Least privilege, audit log for every action.
- **Social media manager desk.** Upload and schedule everything a platform of
  this size posts (feed posts, stories, announcements, banners), premium
  access to the AI assistant for drafting, access to support and the ability
  to reply to support messages, analytics of their posts. Audit log.
- **How staff are added.** The founder adds a person BY THEIR VALLO ACCOUNT
  (they sign up normally, he grants the desk). Build the table and the grant
  screen for that, with roles, scopes, who granted it and when, and a single
  switch to revoke. Least privilege: a support person can review and approve
  listings and answer members, and cannot touch money, payouts or other
  people's grants.
- Make sure every report (listing, person, message, transaction) routes to the
  right desk and queue.
- Update `docs/ADMIN_CONSOLE.md` and `docs/SUPPORT_STAFF.md`.

**P2.6 Performance.** Measure before and after (cold start, warm start, time to
usable home, bundle sizes, memory during long browsing) on iOS WKWebView and
Android WebView separately; budget Android first. Lazy load, paginate,
skeletons that match the real layout, image sizes, fewer duplicate requests.
Never invent numbers; say what was measured and how.

**P2.7 Docs.** Bring every doc the AI assistant and support rely on up to date
with the new flows. Add `docs/UX_SYSTEM.md` (the design and motion system) and
a page map of the platform.

---

## 6. HOW TO WORK (THE PROCESS THE FOUNDER WANTS)

1. **Setup.** Fetch `main`, create `platform-grade-1-readiness`, confirm
   `apps/web/vercel.json` has the `deploymentEnabled` block (section 1.2).
   Load the Supabase MCP and confirm access to project `uccixoonmbhrnyczyigt`.
   Do not deploy anything to Vercel.
2. **Audit (read only, you plus up to TWO Explore agents).** Map every route,
   the shell, the design tokens, the toasts, the offline layer, the passcode
   gate, the phone gate, the wizard, KYC, messages, assistant, support, admin.
   Write `docs/handoff/AUDIT_2026-11.md`: what exists, what is broken, what is
   duplicated.
3. **Reference analysis.** When the founder sends the ~60 screenshots, write
   `docs/handoff/REFERENCE_PATTERNS.md`: one entry per screenshot (what it is,
   the pattern, what Vallo should do, better). Number them as the founder
   sends them.
4. **Recommendations (Agent 1, UX lead).** At least 100 specific, grounded
   recommendations in the 20 categories of the founder's brief (appendix A),
   each with what, why, where, how, and which layer (frontend, backend, API,
   Capacitor, native), prioritised by impact, effort and business value. Show
   the founder the top 30 before building anything large.
5. **Architecture.** Decide the shared pieces first (feedback banner, motion
   tokens, sheet component, stepper component, page frame, connection state),
   so every page uses the same parts.
6. **Implement in groups** (P0, then P1, then P2). **SIX AGENTS PER BATCH**,
   up to eight where the work is genuinely independent by file (the founder, 9
   November 2026, raising this from two: "go hard on things, 5-6 agents on
   batch"). Before you launch a batch, write down which paths each agent owns
   and check no two overlap. Examples of a clean split:
   - You build the shared components and the member screens; the agent audits
     native behaviour (status bar, keyboard, haptics, back button, deep links)
     and reports findings for you to apply.
   - You build the listing wizard; the agent sweeps pages against the design
     language checklist and lists what is off.
   - You build the admin desks; the agent writes the docs the AI assistant and
     support rely on, then runs the regression suites.
   Never two writers in one area. The lead (you) reviews and integrates
   everything.
7. **Re-audit each group** (section 9) before the next.
8. **Report** to the founder after each group in plain language: what changed,
   screenshots taken locally, what they must test on the phone.

---

## 7. THINGS THAT MUST NOT HAPPEN

- Rebuilding screens from scratch when an upgrade will do. Deleting features.
- Mock data replacing real data. Hard-coded content that should come from the
  database.
- A second design system next to the first. Duplicate pages or navigation.
- Breaking payments, bookings, KYC, the ledger, RLS or the money rules.
- New paid services without the founder's approval.
- Changes to the iOS project that need a new native build, unless planned with
  the founder (a new build means a new App Store review and macOS minutes).
  Prefer web-side changes; batch native changes into one planned 1.0.x build.
- Claiming native features "done" without a device test.
- Vercel previews, Vercel CLI deploys, triggering GitHub workflows.

---

## 8. NATIVE BUILD IMPLICATIONS

Most of this upgrade is web code and reaches the app instantly (the app loads
the live site; DeployWatch reloads phones onto new deploys). Things that need a
NEW native build and App Store review: new Capacitor plugins, Info.plist or
entitlement changes, splash or icon changes, Android manifest changes. Collect
them in `docs/handoff/NATIVE_BUILD_QUEUE.md` and ship them together in one
planned build, only when the founder agrees and Actions minutes are available.

---

## 9. VERIFICATION GATES (RUN THEM YOURSELF)

From `apps/web`:
- `npx tsc --noEmit -p .`
- `npx eslint <changed files>`
- `node scripts/check-no-em-dash.mjs`
- `node scripts/check-css-tokens.mjs` (and the other `scripts/check-*.mjs`
  that apply)
- `node ../../scripts/check-migrations.mjs` for database changes
- targeted vitest runs for what you touched; the full suite in the background
- `npx next build` with dummy env
  (`NEXT_PUBLIC_SUPABASE_URL=https://uccixoonmbhrnyczyigt.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NEXT_PUBLIC_SITE_URL=https://www.vallospaces.com`)
- Playwright screenshots at 390 x 844 and 360 x 800, light and dark, of every
  changed screen (Chromium is preinstalled; do not run playwright install)
- After deploys the founder approves: check `public.risk_alerts` for new
  `client.error` rows.

---

## 10. THE FIRST MESSAGE TO PASTE INTO THE NEW SESSION

```
VALLO: PLATFORM GRADE 1 READINESS. You are taking over my platform upgrade.
Repo moderator29/read-it-well. Supabase project uccixoonmbhrnyczyigt.

YOU ARE CONTINUING WORK, NOT STARTING IT
Two sessions before you have already done a great deal of this upgrade. There
are 336 commits of it. DO NOT start from main and DO NOT redo the audit, the
recommendations or the reference-pattern notes: they exist, they are good, and
redoing them burns my session for nothing. Your first job is to find out what
is already done, then carry on from the first thing that is not.

SETUP, IN THIS ORDER, BEFORE ANYTHING ELSE
1. Fetch everything:
     git fetch origin
2. Pick up the SAME branch the last two sessions worked on. The full work is
   on origin/claude/fervent-cray-1vzbp1, which contains every commit of
   origin/platform-grade-1-readiness plus 155 more. I want it all living under
   the name platform-grade-1-readiness, so do exactly this:
     git checkout -B platform-grade-1-readiness origin/claude/fervent-cray-1vzbp1
     git merge origin/main
     git push -u origin platform-grade-1-readiness
   The merge brings in main's newest work, including the payments documents in
   step 6, which do not exist on the work branch yet. If that merge conflicts,
   resolve it, do not reset it away, and tell me what you resolved. From then
   on: ONE branch, platform-grade-1-readiness, every commit, start to finish.
   Never open a different branch for a sub-piece of the work, so I can see the
   whole upgrade in one place and Vercel stays switched off for it.
3. READ THE STATE OF THE WORK before any other document, in this order:
     docs/handoff/STATE.md             who was doing what, how to resume
     docs/handoff/AGENT_QUEUES.md      the ordered jobs, with DONE marks
     docs/handoff/FEATURE_BACKLOG.md   every ask of mine, with owner and state
     docs/handoff/FOUNDER_DECISIONS.md my rulings, newest last
     docs/handoff/PAGE_LEDGER.md       every page, ticked as passed
     docs/handoff/TODO.md and docs/handoff/WORK_QUEUE.md
   Then check git log against them. Tell me, in plain language and before you
   build anything, what is done, what is half done, and what you are picking
   up first. If a document and the code disagree, the code wins and you fix
   the document. Keep every one of those files up to date as you go: the next
   session will depend on them the way you depend on them now.
4. READ docs/handoff/FOUNDER_BRIEF_VERBATIM.md completely. That is my own
   message, word for word, and it is your MAIN SOURCE OF TRUTH. Where anything
   else disagrees with it, it wins. Re-read it at the start of every phase.
5. READ docs/handoff/PLATFORM_GRADE_1_READINESS.md completely: my rules, how I
   work, the current state, the codebase map, the Hauslet patterns, the design
   language, the priority list, the gates. Then apps/web/AGENTS.md, then the
   docs it lists in section 3. Also read what the last sessions already wrote,
   and build on it rather than rewriting it: AUDIT_2026-11.md,
   RECOMMENDATIONS.md, REFERENCE_PATTERNS.md, PERFORMANCE_REPORT.md,
   DEVICE_TEST_MATRIX.md, BANNER_MOMENTS.md, NATIVE_BUILD_QUEUE.md, and
   docs/UX_SYSTEM.md if it exists.
6. READ the two payments documents, in this order, because the protected
   payment rail is part of YOUR job now:
     docs/handoff/PROTECTED_PAYMENTS_BUILD.md   (the rules, read first)
     docs/handoff/PROTECTED_PAYMENTS_SPECS.md   (the two commissioned specs,
                                                 plus the provider's own
                                                 commercial and presentation
                                                 terms in the appendix)
   Build that rail to ready, flagged OFF, in this same branch. Do not switch
   it on: the agreement is not signed yet.
7. Load the Supabase MCP tools and confirm you can query the project.
8. Confirm apps/web/vercel.json has git.deploymentEnabled switching Vercel OFF
   for platform-grade-1-readiness.
9. Check supabase/migrations/pending/ and its README. Anything waiting there
   is SQL I have to run myself. List it for me in your first report.

MY RULES
- SIX AGENTS PER BATCH, up to eight when the work is genuinely independent
  by file. Go hard, run them in parallel, use the session. The one rule that
  does not bend: never two writers in the same files. Split every batch by
  file ownership first and name the owned paths in each agent's brief. Where
  the work cannot be split cleanly, do it in sequence yourself.
- STUDY EVERY REFERENCE IMAGE I SEND before you design or build a screen.
  They are the standard, not decoration.
- EVERYTHING lives on the branch platform-grade-1-readiness. Commit often,
  push to that branch often (it costs nothing: Vercel is switched off for it).
  Never push to main, and never merge into main, unless my message literally
  says "push to main". When I do say it, push the whole branch to main in one
  go and tell me what went live.
- NEVER deploy to Vercel, never open a preview, never run the Vercel CLI.
  Previews cost me real money (96 USD for nothing once already).
- NEVER trigger GitHub Actions. My included minutes are used up. Run the
  checks yourself locally instead.
- No em dashes anywhere: code, copy, docs, commit messages, chat.
- This is an UPGRADE, not a rebuild. Keep Capacitor, the backend, the
  database, every working feature. Do not delete features. Do not replace
  real data with mock data. Do not add paid services without asking me.
- Re-audit after every piece of work: re-read your own diff, run the gates,
  look at the screens at phone width in light and dark, fix what you find.
- Never tell me something works unless you ran it. Say "built, not tested on
  a device" when that is the truth. If you were wrong, say so immediately.
- Do not copy Hauslet's branding, logos, screens or assets. Learn the
  patterns, then build a better Vallo version with our own identity.

HOW I WANT YOU TO WORK
- Work autonomously. Everything in the handoff and my brief is already
  approved: do not come back asking permission for it. Decide, build, verify,
  report. Only ask me when money would be spent, something is irreversible or
  public, or two honest readings of my words would build different products,
  and then ask once with your recommendation attached.
- If you get blocked, park it, say so in the next report, and keep moving.
- Finish what you start. Do not hand me a half-built thing.
- Talk to me in plain language, short, no jargon, no flattery, the answer
  first. I am not an engineer. I test on a real iPhone and I send
  screenshots.
- After each group of work, tell me in numbered steps exactly what I need to
  do on my phone.

WHAT I AM AIMING AT
Hauslet is my reference and I will send you about 60 or more screenshots of
it. It feels like a real native app: calm, white, generous spacing, thin
icons, big rounded containers, one question per screen, autosave, bottom
sheets, a 7-step ID check in the in-app browser, proper help articles with
screenshots. Vallo must reach that level and then go past it: more features,
better flows, stronger identity, so that next to us they look like the small
platform. I want to open Vallo and feel joy. Every single page gets the
uniform enhancement, not too much and not too little. Clean architecture,
like a project that had a proper plan before it was built.

START HERE
1. The state report from setup step 3: what is done, what is half done, what
   you are picking up first. Short, plain, no jargon. The audit in
   docs/handoff/AUDIT_2026-11.md and the recommendations already exist, so
   extend them where you find something new, do not start them again.
2. The design language and the four shared components (feedback banner, sheet,
   step frame, page frame) were being built by the last sessions. Check their
   state first. If they exist, finish and spread them across every page. If
   they do not, build them now, because they are what makes 559 pages look
   like one product.
3. The P0 work: passcode optional with a dismissible dashboard alert; phone
   number out of sign-up and asked before the first deal; verification
   required before deals and rebuilt as a premium stepper; the global
   feedback banner; native polish basics (status bar, safe areas, keyboard,
   haptics, Android back).
   Note: the notifications step at the end of sign-up is already BUILT; your
   job is to polish and extend it.
4. Then P1 (listing wizard one question per screen, agent switch in the side
   nav working on low or no data, voice notes and reactions in messages, the
   pinned AI assistant chat with a button through to human support, offline,
   the map, the help centre, reporting, media and video caching).
5. Then P2 (our own signature feature with a name you propose, the feed and
   our inner world, the motion system and a possible mascot, the whole-platform
   container and icon pass, Face ID where it belongs, the support and social
   media admin desks, performance measurements, docs).
6. IN PARALLEL, from the first batch, the PROTECTED PAYMENT RAIL. It has its
   own documents and its own agents, and it does not wait for the UX work:
   the design pass first, then the audit of every reference to the old
   provider, then the adapter, the webhooks, the reconciliation, the state
   mapping, the member screens, the receipts, the help articles, the tests.
   Build it to ready and leave every flag and kill switch OFF. Report it to me
   as "ready, switched off, waiting on the signed agreement". Read
   PROTECTED_PAYMENTS_BUILD.md section 3 before you design a payment screen:
   the interface is ours, with one small disclosed partner mark at the payment
   step and the provider's funds wording shown unaltered.

A WORD ON THE MONEY COPY, DO THIS IN BATCH ONE
Sweep every screen in the platform for words that promise protected, held,
secured or escrowed payment. The protected rail is NOT live and has never
held a naira. Any screen promising it today is a false promise. Bring me the
list and your proposed replacement copy before you change it.

As my screenshots arrive, number them and record every pattern in
docs/handoff/REFERENCE_PATTERNS.md. Show me your top 30 recommendations
before any large build. Tell me what you plan before each group, and report
in plain language after it. Go.
```

---

## APPENDIX A. THE FOUNDER'S OWN WORDS

**The full message, word for word, is in `docs/handoff/FOUNDER_BRIEF_VERBATIM.md`. Read that file in full before starting; it wins over this summary.** Below is a condensed reading guide only.

### Condensed reading guide

The founder asked that the whole message be passed on. Em dashes in the
original were replaced with colons to satisfy the repository's dash check;
nothing else was changed in meaning. Read it all; it is the source of truth
when this handoff and the brief disagree.

> Okay perfect I think we go back to my biggest issues and worries because
> this is getting over me. With our capacitor we continue but we upgrade it
> all to work and clean like hauslet stuffs like "Native feel: Smooth
> transitions, proper iOS status bars, safe areas, gestures and navigation.
> Performance: Fast startup, lazy loading, image optimisation and caching.
> Premium design: Consistent typography, spacing, animations and polished
> screens. Native integration: Push notifications, camera, location, deep links
> and other relevant native capabilities. Reliability: Proper error handling,
> offline states, secure authentication and crash monitoring." And I would send
> you a lot of that hauslet platform screenshot so we have our steps similar
> like that but ours should even be more better. Go through the entire codebase
> and give a plan so we can get how hauslet works offline etc, then write a
> masterminded handoff that does everything so a new session can work on it, so
> you know how I feel and what I want and my rules. I will be sending a lot of
> screenshots that it should copy. Use 4 agents max. In the screenshots the
> verification steps: ours should look similar to theirs, more pages, more
> stuff, and copy many UX they have. We need something even more slick: we copy
> their exit agent tools and switch to agent tools buttons but ours should be in
> the side nav, and the switch must work fine, also on low data or no data with
> the cache. Add voice messages to messaging and reactions too. More
> animations. The verification takes you to our website in the in-app browser
> like theirs. The documents part that says how to list etc. It is not
> rebuilding our platform but upgrading it, the slightest detail to the iOS
> feel.
>
> [The founder then pasted a long structured brief. Its sections, kept in full
> intent:]
>
> VALLO: PREMIUM NATIVE iOS EXPERIENCE AND PLATFORM UPGRADE. Upgrade the
> existing platform (properties, accommodation, stays, restaurant reservations)
> to a premium native-feeling mobile experience. Do not rebuild, do not replace
> Capacitor, preserve everything that works.
> 1. Native iOS experience: native navigation and transitions, status bar and
> safe areas, page transitions and gestures, scrolling, touch feedback, loading
> animations, natural tabs, native bottom navigation, no web-like behaviour.
> 2. Navigation, tabs and pages: better tab structure, dedicated pages and
> subpages, intuitive movement between Property, Vallo Stays, restaurants,
> bookings and accounts; better search, filters, saved, booking history,
> notifications, profile; every feature discoverable; no clutter or duplicates.
> 3. Premium UI/UX: spacing, typography, icons, buttons, consistency,
> micro-interactions, better cards, listings, galleries, search and detail
> pages, professional empty, loading and error states, keep the brand, excellent
> on all iPhone sizes; improve, do not randomly redesign.
> 4. Native integrations: push, universal links and deep links, camera and
> photos, location, share, haptics, status bar and splash, keyboard, app
> lifecycle; permissions only when needed.
> 5. Deep linking: listings, stays, restaurants, bookings, categories, search
> results, notification destinations; web fallback; works cold, warm and in
> background.
> 6. Performance: startup, lazy loading, pagination, images, fewer requests,
> bundle size, skeletons, safe caching, offline handling; never sacrifice
> accuracy.
> 7. Security and reliability: auth, sessions, permissions, errors, no crashes,
> expired sessions, sensitive data, memory leaks, crash reporting, payments and
> bookings stay reliable.
> 8. QA across launch, onboarding, sign-up, sign-in, discovery, stays,
> restaurants, search, saved, notifications, account, deep links, tabs,
> background and reopen, on several iPhone sizes.
> 9. Rules: inspect, audit, find problems, plan, then implement; no removed
> features, no broken integrations, no mock data, no needless dependencies, no
> duplicate pages, no hard-coding, no false claims, keep App Store compatibility;
> name every plugin, permission, entitlement or service needed.
> 10. Deliverables: summary, new pages and navigation, native integrations,
> performance work, bugs fixed, remaining issues, required plugins and Apple
> configuration, tests and results, steps before the next App Store submission.
> 11. Cross-platform: iOS AND Android equally; one codebase; platform-aware
> behaviour (iOS transitions, safe areas, haptics, sheets, universal links;
> Android system bars, edge to edge, back and predictive back, keyboard resize,
> Material-style touch feedback, App Links, densities); test both.
> 12. Deep performance audit: iOS WKWebView and Android WebView separately;
> startup, JS cost, memory, scrolling, animation, images, navigation,
> background recovery; budget Android phones common in Nigeria; real devices
> or clearly labelled emulation; startup and loading optimisation; memory and
> resource management; budgets and before/after measurements; network and data
> efficiency for slow Nigerian connections; separate final reports.
> COMPLETE NATIVE MOBILE EXPERIENCE TRANSFORMATION: study the Hauslet and X
> screenshots. Agent 1 is a UX research and recommendation lead producing 100+
> grounded recommendations in 20 categories (navigation, native iOS, native
> Android, notifications and feedback, offline, saving and collections,
> property discovery, Vallo Stays, restaurants, messaging, booking management,
> property publishing, forms, search and filtering, accounts and profiles,
> onboarding and auth, loading and performance, visual design and animation,
> accessibility, security and reliability), each with what, why, where, how and
> layer, prioritised, and then responsible for seeing them implemented.
> Global feedback system: polished top banners for every action ("Property
> saved", "Message sent", "Booking confirmed", "Welcome to Vallo", "Your profile
> has been updated"), wide, rounded, subtle border, icon, readable, smooth
> in and out, below the status bar, safe areas, auto-dismiss, manual dismiss,
> never blocking, queue or replace, specific messages, true failure messages
> with retry ("Message couldn't be sent. Check your connection and try
> again."), one central system on both platforms.
> Native keyboard and typing: keep the system keyboard sound behaviour, never
> add artificial sounds, respect system settings; better focus, scroll to
> field, dismissal, Next and Done, search fields, paste, multiline, resizing;
> the message composer stays above the keyboard.
> Offline and connection: connected, slow, unstable, disconnected, reconnected;
> no browser errors; saved and recently viewed content offline; "Saved on your
> device. Price and availability may have changed."; never show cached prices
> or availability as live; a polished offline screen with retry, saved content,
> recent content, home; on reconnect refresh, retry safe requests, sync queued
> actions without duplicates, tell people what succeeded; never auto-submit a
> payment or booking.
> Glass and premium containers used selectively (floating nav, panels, sheets,
> some overlays, notifications), readable, with low-end Android fallbacks.
> Icon system: thin, elegant, consistent line icons; subtle feedback and
> haptics on taps, saves, tabs, menus, sends, bookings, filters, favourites;
> respect reduced motion.
> Bottom navigation: clear structure inspired by X's efficiency; not every
> feature in the bar; badges; safe areas; no keyboard overlap; state kept;
> deep links land correctly.
> Property publishing and forms: Hauslet-quality progress, layout, labels,
> borders, focus, validation, counters, description editing, photos, AI help,
> save and continue, drafts, confirmations, undo; show what the AI changed and
> allow undo; same standard for registration, profile, booking and reservation
> forms.
> Messages: immediate sending feedback, sending, sent and failed states, retry,
> unread, clean lists, timestamps, typing, attachments, upload progress,
> keyboard-aware composer, smooth scroll, empty states, offline handling; never
> claim delivered when only queued.
> Loading and startup: no five-second waits; splash, bridge, WebView, bundle,
> session restore, API dependencies, first render; skeletons where they help;
> progressive loading; measure before and after; no fake loading animations.
> Accessibility and finishing details: font sizes, dynamic text, touch targets,
> labels, contrast, reduced motion, form errors, focus, empty states, errors,
> spacing, orientation, sizes and densities.
> Implementation strategy in phases: audit, reference analysis,
> recommendations, architecture, implementation, performance, testing, polish;
> agents for UX, native, performance and offline, UI, QA, with one lead.
> Final quality standard: premium, native, immediate, intuitive, clear,
> consistent, offline-aware, good on budget Android, as polished as established
> apps, nothing website-like. Keep Vallo's identity; do not copy Hauslet's or
> X's branding, screens or assets. The finished product should feel like Vallo.
>
> [The founder's further instructions, after the brief:]
>
> First thing: remove the passcode from the first page of the platform to get
> in, and remove the phone number from sign-up, like Hauslet did it (image 2):
> verification is compulsory before making any deal. All of it clean. Videos
> should work and cache like native iOS and Android. Use subagents for deeper
> clean work. Re-audit in each work. All work on a new branch named platform
> grade 1 readiness. Never use Vercel previews: everything stays in GitHub,
> because previews cost real money and the budget is thin. The end goal is
> Vallo better and cleaner on Android, iOS and the web. Do not change our
> platform into theirs: take ideas from their screenshots, then elevate, add
> ours, and be better in features, tools, positioning and UX, so they look like
> the small platform in comparison, in flows and user friendliness, industry
> standard for everyone. The end goal is launch readiness, without delaying
> the App Store submission. Upgrade our docs in UX and UI beyond Hauslet's.
> Make our identity attractive and more serious looking: wide platform glass
> containers where they fit, clean, unified looks, bigger containers, prettier
> areas. Think about our feed, the whole flow and vibe. Create an identity
> feature for Vallo like Hauslet's Hausmates, with a unique name, legendary,
> slick and high quality. Impress me. Arrange the platform properly: API,
> pipeline, backend, frontend, uniform, like a project that had a proper PRD
> before starting, covering everything we have, so every future addition just
> makes it lovelier. More animations on pages, success pages and chats, more
> motion in many areas. Frontend UX/UI more disciplined and clean, more pages,
> 2030 generation. Every single page in the platform gets the uniform
> enhancement, not too much, not too little, high end; Hauslet is the big
> reference in UI, UX, approach and quality. Use the same type of map and flow
> they use. Cleaner containers. In the support screenshots, support chat looks
> like chatting with a normal person: add an AI assistant chat that users can
> open like a normal chat, with a button inside that takes them to a real
> support chat, clean and sharp, as an inner page inside the AI assistant, in
> the messages inbox, permanently there even if no user-to-user chat exists.
> Make the message composer like ChatGPT's bottom: slim input, voice message
> icon, send button, in our users' chats too. Make the AI assistant and AI
> support docs detailed and up to date with the new platform. Create in the
> admin panel a support and business developer desk (I add them by their
> account; tools and access to approve and review listings, onboard users met
> in real life or online, fix issues, reply to support) and a social media
> manager desk (upload everything a social media team of a platform this size
> needs, premium AI access, support access and replies). Reporting of
> listings, users, messages and transactions must reach the right desk. Rebuild
> identity verification like Hauslet's but as an upgrade of ours, more 2030,
> slick, clean, full step pages, sheets that rise from below or drop from
> above, more fast, clean motion like native apps. Load the Supabase session and
> approve things; same for Vercel, but nothing runs on Vercel until I say push
> to main: all previews and fitting stay in the working branch. Users can react
> to messages in chats, to voice notes, voice calls and video calls. More places
> where Face ID is used when appropriate. The passcode is NOT on by default: you
> can create an account, sign in and use the app without it; instead a small
> dismissible alert at the top of the dashboard recommends it (essential, not
> compulsory). Face ID where it is needed. Many more motions and animations, a
> mascot for motion if possible (if a mascot is too hard, more moving, cleaner
> motion), images of flows in the docs, and help pages that show users each
> screen. Be specific and detailed so the next session does not scatter the
> platform while claiming to upgrade it.
