# THE NEXT-GENERATION UPGRADE: HANDOFF (written 14 November 2026)

For the session that carries out the founder's platform-wide upgrade. Read
this file first, then `NEXT_GEN_BRIEF_VERBATIM.md` (his two briefs and his own
messages, word for word). This file tells you what he asked for in order of
priority, what already exists so you do not rebuild it, what is true about the
platform and its database today, how the work must be run, and what "done"
means for each part.

The founder writes fast and wants results, not plans. He reads on a phone.
He has been burned by work that was announced and not finished. Everything in
this file is written so that you can start building within the first hour.

Contents

1. Where things stand at the handoff
2. Which instruction wins when two disagree
3. The standing rules (they are not optional)
4. How the session runs: two agents, one queue
5. What already exists, by section of the brief
6. THE SMALL WORKS: his own four asks of 14 November, specified
7. THE MAIN WORK: the brief, phase by phase, with first tasks
8. The Supabase audit: what is already known, and what to do
9. The console and staff: what changed on 14 November
10. Open items, blockers and decisions waiting on the founder
11. Verification: what counts as proof
12. Documents you must leave behind
13. The definition of done

---

## 1. Where things stand at the handoff

**Product.** Vallo (VALLO SPACES LTD) is a Nigerian marketplace for property
(rent and sale), stays, restaurants, roommates, a feed and communities
(Circle), with messaging, offers and a deal room, a wallet, an agent and host
workspace, and a staff console. It is live on the App Store and the Play
Store, and on the web.

**Code.** One repository, `/home/user/read-it-well` (GitHub
`moderator29/read-it-well`, which now redirects to `moderator29/VALLO`).

| Part | Where | Notes |
|---|---|---|
| Web app | `apps/web` | Next.js 16.4.4 (App Router). READ `apps/web/AGENTS.md`: this Next is newer than your training; read `node_modules/next/dist/docs/` before writing anything Next-specific |
| Native shells | `apps/web/ios`, `apps/web/android` | Capacitor 8. The apps load the web app; a web deploy reaches them, a plugin change needs a store release |
| Design tokens | `packages/design-tokens` | The only source of colour, space, radius, type |
| Words | `packages/i18n` | English, Yoruba, Igbo, Hausa. NEW COPY IS ENGLISH ONLY |
| Database | Supabase project `uccixoonmbhrnyczyigt`, eu-west-1, Nano compute | 773 migration files; pending SQL in `supabase/migrations/pending`, risky drafts in `supabase/drafts` |
| Hosting | Vercel, region dub1 | Deploys from `main`. You never deploy |

**Branch.** All work is on `claude/rentme-v2-platform-audit-xuvg0a`. The
founder asked on 14 November for it to be re-audited and pushed to `main`, and
it was, at `4baa05fb4` (section 10). Work after that commit is on the branch
only. Check `git log origin/main -1` before assuming anything about `main`.

**What shipped on the branch on 13 and 14 November** (newest first):

- The console opens on the account password for admins and staff; a named
  position holds only its own desks; the Business Development position gains
  identity review (`3d0e06919`).
- A listing takes any mix of fifteen photos and videos (`ac1283a70`).
- Business development: the pipeline table, Your desks, two staff manual
  chapters, the phone notice (`98e1c0d68`).
- Budget in your currency in the search filter; the message menu's styles in
  one sheet (`47cc66878`).
- Native feel: re-tap a tab to scroll to the top, pull to refresh on search,
  notifications and the feed, a new-content pill, pinch zoom on listing photos
  (`06f83b69c`).
- Listing stats (views, saves, days on Vallo) with card counts and an admin
  analytics desk; `overflow-wrap` fixed across the platform; nine missing
  loading screens; Save photo in the message menu.

**Database changes the founder ran on 13 and 14 November** (all verified
against live by read-only queries after he ran them): display exchange rates,
person trust checks, listing stats, the staff access announcement door and its
catch-up email, anon revoked from four Circle functions, 90 explained alerts
resolved, the Nano relief (`auth_speed` parts 1 to 3: rate limit tuning, cron
history purge with a daily job, the hold sweep every five minutes),
`platform_speed` (`shell_context` as security definer) and the fifteen-item
media ceiling.

**Not yet run by the founder:** `staff_desks_only_2026-11-14.sql` (pending;
see section 9) and the draft `sign_in_bookkeeping_off_the_sign_in_2026-11-13.sql`
(his decision; see section 8).

---

## 2. Which instruction wins when two disagree

The two briefs were written with another assistant and pasted in. They
disagree with each other in places and with the founder's standing rules in
others. This is the order of authority, highest first:

1. **The founder's own words in this conversation** (Part A of the verbatim
   file, and the standing rules in section 3 below, which are also his own
   words from earlier sessions).
2. **The follow-up brief** (Part C), where it differs from the master brief.
3. **The master brief** (Part B).

The cases that matter:

| Topic | Master brief | What wins | Why |
|---|---|---|---|
| Agents | "up to four" | **Two active at any time**, never more | The follow-up brief, and the founder's own "turn to only 2 agents" on 13 November |
| Pushing to main | "do not push or deploy without approval" | **Never push to `main` unless his message literally says so.** Push the working branch freely | Standing rule. He does say so sometimes; read his latest message |
| Deploying | implied by "deployment report" | **Never deploy, never open a preview, never run the Vercel CLI.** Vercel deploys from `main` by itself | Standing rule |
| Database changes | "provide SQL scripts" | **Reads only against live. Every change is a SQL file he runs himself** | Standing rule; section 8 |
| Copying other products | "study Airbnb, Apple, Stripe ... do not copy" | **Take the job a pattern does, never its look.** This already applies to Hauslet, and now to Snapchat, WhatsApp and the Claude app | Standing rule; the references in section 6 are patterns |
| New documents | a list of twelve `VALLO_*.md` files | **Use and extend the documents that exist** (section 5), adding a new one only where nothing covers it | "Adapt filenames to the project's existing documentation conventions" is in the brief itself |
| Design direction | "a 2030-generation product", new identity | **Elevate what exists; the console is dark only; the brand is settled** | The brief's own last section: "Do not redesign everything into an unfamiliar product" |
| Super admin door | not in the briefs | **A super admin keeps the security key. Password is for admins and staff only** | His own words, 14 November: "I don't want password for super admin for now" |

When something is genuinely his to decide and not covered here, build the
safe version, say plainly what you chose and why in your report, and carry on.
Do not stop the whole queue on a question.

---

## 3. The standing rules (they are not optional)

These are the founder's rules from earlier sessions. Breaking one costs more
trust than any feature earns.

**Words and files**
- No em dashes anywhere: code, copy, comments in docs, commit messages, chat.
  `apps/web/scripts/check-no-em-dash.mjs` enforces it in source and docs.
- English only for new copy.
- No model names or identifiers in commits, PRs, code or docs.
- Never claim something works without running it. Say what you saw and what
  you could not see.

**Secrets and accounts**
- Never print, paste or commit a credential. The founder puts keys in Vercel
  himself.
- The QA member account is `phantomfcalls+qamember@gmail.com`. Its password
  and passcode are passed to an agent only as inline environment variables
  (`VALLO_QA_PASSWORD`, `VALLO_QA_PASSCODE`), never written to a file and never
  printed. Never type passcode guesses. Never ask the founder to paste a
  password into chat.
- Never use the admin QA account or the founder's own account.
- On production an agent makes no bookings, payments, offers, messages,
  reports, deletions, profile or security changes, and never presses "Use your
  password instead".

**Shipping**
- Work on `claude/rentme-v2-platform-audit-xuvg0a`. `main` only on his literal
  word. Never deploy.
- Re-audit before committing large work.
- Company payments need all three founders' approval: anything that costs
  money (a bigger Supabase instance, a paid plugin, a paid API) is a
  recommendation with a price, never an action.

**Database**
- Reads only against live. Nothing destructive, ever, by you.
- SQL accumulates into files in `supabase/migrations/pending` (ready to run)
  or `supabase/drafts` (needs a decision). He wants them sent together when a
  round of work is done, and he runs them in the Supabase SQL editor on his
  phone. Section 8 has the rules for writing one that survives.

**Working together**
- Never two writers in the same file.
- Two agents at most (section 4).

**The machine you run on**
- Whole-project `tsc` only when nothing else heavy is running, with
  `NODE_OPTIONS=--max-old-space-size=6144`, and at least 7 GB free
  (`free -g`). It takes about two and a half minutes.
- `vitest` with `--maxWorkers=2`. The whole suite takes well over fifteen
  minutes; run the files you touched while you work and the whole suite once
  before a push to `main`.
- A build or a dev server uses its own folder: `NEXT_DIST_DIR=.next-<name>`.
  Afterwards restore `apps/web/tsconfig.json` with `git checkout` and delete
  the folder. Disk is about 9 GB free; three stale `.next-*` folders cost 4 GB
  on 14 November.
- A local Postgres 16 exists (`pg_ctlcluster 16 main start`, run `psql` as the
  `postgres` user, pipe files in on stdin). Use it to test every SQL file on a
  stub shaped like live before it goes to the founder. Stop it afterwards.

---

## 4. How the session runs: two agents, one queue

The founder's follow-up brief describes exactly this, and it matches how the
last sessions ran.

**The lead** (the main session) owns the queue, the file ownership list, the
review of every agent's work, every commit, every SQL file and every message
to the founder. The lead may do focused work itself in files no agent holds.

**Two agents at most**, started as forks so they inherit this context. The
roles are not rigid: either may research, build, test or fix. In practice:

- one agent investigates an area and reports findings with file paths and
  line numbers, then moves to the next area;
- the other builds what has been investigated, tests it, and reports.

**The queue** lives in `docs/handoff/STATE.md` (how work survives a stop) and
`docs/handoff/WORK_QUEUE.md`. Keep one table with the eight stages the brief
names: Queued, Researching, Ready for implementation, Implementing, Testing,
Bug fixing, Re-auditing, Completed. A task is Completed only when it was run
and seen, not when code was written.

**Every agent prompt must carry:**
1. The exact scope, in order, and what is out of scope.
2. The files it owns, and the files it must not touch (name them).
3. The standing rules that bite on its work (no em dashes, English only, no
   new dependencies without asking, no live database writes, the memory rules).
4. The quality bar (section 11) and the instruction to say what was seen in a
   browser and what was not.
5. "Do not commit. Report: per item done or blocked and why, files touched,
   tests run with results."

**The lead's gates before any commit of an agent's work:** read the diff,
whole-project `tsc`, `eslint` on the changed files, the CSS token and
collision checks, the em dash check, the touched tests. Before a push to
`main`, add the whole test suite and a production build.

**Things that went wrong in earlier rounds, so you can avoid them:**
- An agent reformatted a whole file with a formatter the repository does not
  use. There is no Prettier config; never run a formatter over a file.
- A SQL file's own self-test failed on live data the local stub did not have
  (every published listing was an example), and rolled the whole file back.
  Read live first; make self-tests skip when live has nothing to test on.
- A test pinned an old limit after the limit changed. When you change a
  number, grep the tests for it.
- Two dev servers left `tsconfig.json` modified. Restore it.

---

## 5. What already exists, by section of the brief

The brief was written without sight of the repository. Much of what it asks
for exists, some of it in depth. Extend these; do not start again.

| Brief section | What exists today | Where |
|---|---|---|
| 1. Bug audit | Two full surveys (153 member and public findings, 84 workspace and backend findings) merged into a queue; a November audit; a page sweep | `docs/handoff/SURVEY_A_MEMBER_PUBLIC.md`, `SURVEY_B_WORKSPACES_BACKEND.md`, `WORK_QUEUE.md`, `AUDIT_2026-11.md`, `docs/PAGE_SWEEP.md`, `docs/REMAINING_WORK.md` |
| 3. Product map | A page ledger of every route and its state | `docs/handoff/PAGE_LEDGER.md`, `docs/PRODUCT.md` |
| 4. Design system | Tokens, a CSS token gate with ten enforced rules, a collision gate, an icon system, a design direction, a component library and a craft doctrine, a UX system document | `packages/design-tokens`, `apps/web/scripts/check-css-tokens.mjs`, `check-css-collisions.mjs`, `docs/DESIGN_DIRECTION.md`, `docs/design` (`COMPONENT_LIBRARY.md`, `CRAFT_DOCTRINE.md`, `PREMIUM-STANDARD.md`, `MOTION_SYSTEM.md`, `VOICE.md`), `docs/ICON_SYSTEM.md`, `docs/UX_SYSTEM.md` |
| 5A. Navigation | A back navigation rulebook, route parents, an inner nav | `docs/BACK_NAVIGATION.md`, `apps/web/src/lib/nav` |
| 5D. Make an Offer | Offers, counteroffers, a deal room, an audit of them | `docs/handoff/OFFERS_AND_DEAL_ROOM.md`, `OFFERS_AUDIT.md`, `OFFERS_UI_HANDOFF.md` |
| 5E. Feed and Circle | Built, with a brief and recommendations | `docs/handoff/FEED_AND_CIRCLE_BRIEF.md`, `VALLO_CIRCLE.md` |
| 6. Motion | A written motion system, a motion layer, premium motion sheets, a calm (reduced motion) rule | `docs/design/MOTION_SYSTEM.md`, `apps/web/src/app/css/motion.css`, `premium-motion-2.css`, `lib/ui/calm` |
| 8. Performance | A performance report, an offline and fast start plan, per-request memo, a cached catalogue, `staleTimes`, intent prefetch | `docs/handoff/PERFORMANCE_REPORT.md`, `docs/OFFLINE_AND_FAST_START_PLAN.md`, `apps/web/src/lib/cache`, `lib/catalogue` |
| 9. One system | Server actions with one result envelope, a rate limiter, an audit log, RLS probes | `apps/web/src/lib/actions/envelope.ts`, `lib/security/rate-limit.ts`, `supabase/tests/probes` |
| 10. Admin console | About eighty desks, scoped staff positions, My Desk, tasks, announcements, weekly reports, a copilot per desk, a staff manual of fourteen chapters and a handbook | `apps/web/src/app/admin`, `docs/ADMIN_CONSOLE.md` |
| 12. Help centre | Member documents on a documentation kit, help articles, guides | `apps/web/src/app/(site)/docs`, `lib/support/help-articles.ts`, `lib/guides` |
| 17. Testing | About 14,300 unit and DOM tests, database probes, an accessibility check | `apps/web` (vitest), `supabase/tests`, `apps/web/tests` |
| 18. Documentation | See section 12 | `docs`, `docs/handoff` |

Two facts that the brief does not know and that shape every screen: the
member app ships in light and dark, and both must be checked; the staff
console is dark only. And Vallo never holds customer money, so no screen or
sentence may suggest it does (`lib/money/copy.ts` holds the wording).

**What is thin or missing** (this is where the brief's real work is):

- No single, current bug register that a person can read top to bottom. The
  surveys are a week old and many items are fixed.
- No measured Core Web Vitals baseline from real pages on a throttled phone
  profile. The performance report has database timings and bundle notes.
- The showcase page (brief section 11) does not exist.
- The founder command centre (section 10) exists as an overview, not as the
  action centre he describes.
- Staff manual screenshots: every chapter has a slot that says the capture run
  has not happened.
- The circular home control (section 7) has not been checked against the
  screenshots he refers to; find the page first (see section 7 below).

---

## 6. THE SMALL WORKS: his own four asks of 14 November, specified

These came from the founder directly, with screenshots, and they outrank the
brief. They are the first things to build. Status at the handoff is at the end
of this section.

The screenshots are not in the repository (they show his private chats). What
each one shows:

- **The Claude app's composer after a paste.** A system banner at the top
  reads "Claude pasted from ChatGPT". Above the text field sit three compact
  chips, each a pasted document: a file type tag ("TXT"), two lines of the
  text's start, and a round close button. The text field itself stays empty
  ("Queue for after this turn..."). The keyboard's suggestion strip offers the
  clipboard's first line with "Paste from ChatGPT" under it.
- **Snapchat, a long-press on a chat.** A bottom sheet in two cards. The first
  card is the person: avatar, name, "View Friendship" with a chevron, then a
  row of four round quick actions (camera, chat, call, video). The second card
  is a list of rows: a row with a radio control at the end, rows with a
  chevron, a row with a second line under its label, and a last row with a
  filled round action button. Under both, alone, a full-width "Done" bar.
- **Snapchat, the "more" menu.** The same sheet with one card of plain rows
  and the same "Done" bar. Behind it, the chat list's top: a row of filter
  tabs that scroll sideways (Unread, Near me, Stories, Calls, Groups, Reply),
  some with a count badge ("9+", "1").
- **WhatsApp after copying a message.** A small dark pill near the bottom of
  the thread, above the composer: a green ring with a tick, then "Message
  copied". It leaves by itself.

### 6.1 The confirmation pill ("Message copied")

**What he asked:** "built clean sharp and goes back by itself within 0.4
seconds".

**What exists:** one global feedback store, `apps/web/src/lib/ui/toast.ts`
(`banner.success`, `.error`, `.info`, `.warning`), drawn by
`components/ui/ToastHost.tsx` as a wide banner at the TOP of the screen. That
placement was the founder's own ruling for Grade 1 ("show a polished
notification banner at the top of the current screen") and it stays for
anything that matters.

**What to build:** a second, lighter voice in the same store, never a second
system.

- API: `banner.quick("Message copied")`. Same store, same host, one at a time.
- Look: a compact pill, centred, a tick in the brand's success colour then the
  words, no close button, no action. It sits above whatever is at the bottom
  of the screen: above the composer in a thread, above the dock elsewhere,
  above the home indicator in a sheet. Use the tokens and the control radius
  (the token gate refuses a capsule on a control; a status pill is allowed,
  see `StatusPill.tsx` and the gate's allowed list).
- Timing: in at 160 ms, held about 1.4 seconds, out in 400 ms (his number). A
  pill that is gone in 0.4 seconds in total cannot be read; the lead told him
  this and he has not objected. If he asks for faster, shorten the hold.
- Rules: a quick pill never carries an error, an undo or a retry; those stay
  on the top banner. The same words fired twice restart the clock and do not
  re-animate. Announced politely to a screen reader. Under reduced motion it
  appears and disappears with no slide. A haptic tick beside it where the
  action had none (`lib/ui/feedback.ts`).
- Where it goes (move these from the top banner to the pill): message copied,
  link copied, code copied, address copied, phone number copied, photo saved,
  saved to your list and removed from it, added to compare, copied listing
  reference, invite link copied, "Copied" in the console. Start from
  `docs/handoff/COPY_AND_SAVE_AUDIT.md` and `BANNER_MOMENTS.md`, which list
  every copy and save moment; there are 24 files that write to the clipboard.
- More in the same family worth building with it:
  - **Copy without the menu:** a double tap on a code, a reference or an
    address copies it and shows the pill.
  - **Save feedback on a card:** the heart fills, the pill says "Saved", and a
    second tap within the pill's life undoes it silently.
  - **Sent and delivered ticks** already exist in threads; do not add a pill
    for them.

### 6.2 Paste, done properly ("Claude pasted from ChatGPT")

**What he asked:** "build that system on my platform ... depends on where it
pasted from".

**The limit, stated once so nobody chases it:** no website and no app is told
which app a paste came from. The banner "Claude pasted from ChatGPT" is drawn
by iOS itself whenever an app reads the clipboard without the person tapping
Paste; the keyboard strip's "Paste from ChatGPT" is iOS too. Vallo gets the
same iOS banner for free the moment it reads the clipboard. So Vallo cannot
show a source. Tell the founder this plainly (the lead already has); do not
build something that pretends.

**What exists:** nothing. No `onPaste` handler and no `clipboardData` read
anywhere in `apps/web/src`. A pasted photo does nothing in the message
composer today.

**What to build** (the half of that screenshot that an app does own):

1. **Pasted photos become attachments.** In the thread composer
   (`apps/web/src/app/(app)/messages/[id]/ThreadView.tsx` and its attachment
   row, `components/app/messages/AttachmentRow.tsx`), the support composer,
   the feed composer (`components/social/feed/Composer.tsx`) and the listing
   wizard's photo step, a pasted image goes through the same door as a picked
   one: same size and type checks (`lib/media/upload.ts`), same preview chip
   with a close button, same limits. Several pasted at once become several.
2. **Long pasted text becomes a chip, not a wall.** In the thread, support and
   feed composers, a paste longer than the field comfortably holds (propose
   800 characters or twelve lines) is held as a chip above the field: a "TEXT"
   tag, its first two lines, its length, a close button, and a tap opens it to
   read and edit. It is sent as the message text, within the message's own
   length limit; over the limit the chip says by how much. Shorter pastes go
   into the field as they always did.
3. **A pasted link becomes a link chip** showing the address's host and path,
   with a close button. NO preview is fetched: `lib/messages/linkify.ts` says
   why (reading a stranger's address from Vallo's servers is a door the
   platform does not open). A Vallo link (a listing, a stay, a profile, a
   post) is recognised and drawn as that thing's own card, which is safe
   because the card is read from Vallo's own data.
4. **Paste a code in one tap.** Every one-time code field (sign-in code, phone
   code, console code, the emailed fallback code) keeps
   `autocomplete="one-time-code"` and gains a "Paste" button that fills all the
   boxes from the clipboard and submits when it is complete. On iOS this shows
   the system's own "pasted from" banner; that is expected.
5. **Paste cleans what it should.** A pasted phone number loses its spaces,
   dashes and brackets; a pasted amount loses its currency sign and commas and
   lands in `NairaField` as a number; a pasted email is trimmed and lowered.
   A pasted listing link in the search box opens that listing.
6. **Safety.** Paste never bypasses a check: the scam shield
   (`components/app/messages/ScamShield.tsx`) and the contact-detail rules read
   the pasted text exactly as typed text. A pasted file that is not an image
   or a video is refused with words. Nothing pasted is sent anywhere until the
   person presses Send.

### 6.3 Tabs with counts, and the action sheet (the Snapchat references)

**What he asked:** "upgrade in platform areas like this kind of tabs ... those
are cool deep refs we included in many areas for our platform for actions and
tabs".

**What exists.** Sheets: one shared `components/ui/Sheet.tsx` used by 127
files, with `ConfirmSheet`, `SuccessSheet`, `ActionSheetIllustrated`,
`components/social/ActionSheet.tsx`, `components/app/listing/CardMenu.tsx`,
`ThreadOptionsSheet`, `MessageMenu`, and a test that refuses hand-rolled
sheets (`components/ui/hand-rolled-sheets.test.ts`). Tabs:
`components/ui/Segmented.tsx`, `UnderlineTabs.tsx`, `Chip.tsx`, `InnerNav.tsx`,
and about forty screens that draw a tab row with one of them.

**What to build: two shared parts, then apply them.** Vallo's look, not
Snapchat's: Vallo's tokens, glass material and radius; no yellow, no ghost.

**Part 1. `CountTabs`: a scrolling row of filter tabs with counts.**
- A horizontal row that scrolls sideways with no scrollbar, the selected tab
  filled, the others quiet. A tab may carry a count badge (a number, "9+" past
  nine, nothing at zero). The selected tab scrolls itself into view. Arrow
  keys move between tabs; it is a real `tablist` or a set of pressed buttons,
  whichever the screen's meaning needs.
- Each tab is at least 44 px tall. A tab never shrinks (a shrunken chip's
  count ran under its neighbour on 14 November; `flex: none`).
- Counts come from data the screen already holds. No new polling of the
  database for a badge.
- Where it goes:

| Screen | Tabs | Counts from |
|---|---|---|
| Messages inbox (`app/(app)/messages/Inbox.tsx`) | All, Unread, Requests, Property, Stays, Groups, Archived | The list already loaded and `lib/messages/unread-live` |
| Notifications | All, Unread, then one per family (messages, offers, bookings, listings, money, safety) | `app/(app)/notifications/family.ts` |
| Saved | Homes, Stays, Restaurants, Searches, Compare | The saved lists |
| Bookings and reservations | Upcoming, Now, Past, Cancelled | The bookings read |
| Offers | Waiting on you, Waiting on them, Agreed, Closed | `components/app/offers/OffersWorkspace.tsx` |
| Search results | Rent, Buy, Stays, Shortlets, Land, with result counts | The search answer |
| Agent workspace: listings | Live, In review, Needs changes, Drafts, Closed | The listing status counts |
| Agent and host inboxes | Unread, Enquiries, Viewings, Offers | Their existing reads |
| Console queues | Already drawn with `nf-admin-tabs` and chips; move them onto the shared part only if it costs nothing | `app/admin/_components/QueueTable.tsx` |

**Part 2. `ActionSheet`: the two-card sheet with a Done bar.**
- Built on `Sheet.tsx`. A header card for the thing the sheet is about (an
  avatar or a thumbnail, a name, one line under it, a chevron to open it) and
  a row of up to four round quick actions with a word under each. A second
  card of rows. A separate full-width Done bar under both.
- Row kinds: a plain action; a row with a chevron (opens another sheet or a
  page); a row with a second line; a row with a switch or a radio at the end;
  a destructive row in the danger colour, always last and always behind a
  confirm (`ConfirmSheet`). Rows are 52 px or taller. Icons from the icon
  system, one weight.
- Behaviour: swipe down or Done or the scrim closes it; focus is trapped and
  returns to what opened it; Escape closes it; under reduced motion it fades.
  On a wide screen the same content is a popover anchored to its trigger, not
  a sheet stretched across a monitor.
- Where it goes:

| Trigger | Header card | Quick actions | Rows |
|---|---|---|---|
| Long-press or swipe on an inbox row | The person or the listing | Message, Call, Video, Profile | Pin, Mute, Mark unread, Archive, Block, Report, Delete |
| Long-press on a listing or stay card (`CardMenu.tsx`) | The listing: photo, title, price | Save, Share, Compare, Message | Hide this, Report, Copy link, See similar |
| A person's profile "more" (`ProfileMenu.tsx`) | The person | Message, Call, Follow, Share | Mute, Block, Report, Copy profile link |
| A post's "more" (`social/ActionSheet.tsx`) | The post's author | Share, Save, Copy link | Not interested, Mute, Report, Delete (own) |
| A booking or reservation row | The stay or the restaurant | Message, Directions, Call, Share | Change, Cancel, Receipt, Report |
| An offer row | The listing and the amount | Message, Open deal room | Counter, Withdraw, History |
| The thread's header menu (`ThreadOptionsSheet.tsx`) | The person | Call, Video, Profile, Search | Mute, Shared media, Block, Report, Clear |
| An agent's own listing row | The listing | Edit, Share, Stats, Calendar | Pause, Close, Duplicate, Delete draft |
| The "+" in a composer | none | Photo, Camera, Video, Location, Listing | (a grid, not rows) |
| The "more" at the top of a list (new chat, new group, manage) | none | none | Plain rows, as in his second Snapchat screenshot |

- More in the same family worth building with it:
  - **Swipe actions on rows** (inbox, notifications, saved): a short swipe
    shows two actions, a long swipe does the first. `InboxSwipe.tsx` exists;
    make it the shared behaviour.
  - **Peek:** a long-press on a listing card lifts a larger preview with the
    action rows under it.
  - **Recently used first:** the quick actions order themselves by what this
    person uses, after a week of use, and never move within a session.

### 6.4 The keyboard

**What he asked:** "I need keyboard high clean for our platform like a
keyboard stuff". He attached the Claude composer with the keyboard up. The
lead read this as the typing experience, told him so, and told him a custom
Vallo keyboard would be a separate native project. He has not corrected it.

**What exists:** `@capacitor/keyboard` is installed and
`apps/web/src/lib/native/keyboard.ts` handles it; a reference image for the
input bar is in `docs/handoff/refs/input-bar-reference.jpg`; section 11 of the
Grade 1 brief covered keyboard and window resize on native.

**What to build: a keyboard pass over every field on the platform.**
1. **The right keyboard for the field.** Audit every `<input>` and
   `<textarea>`: `type`, `inputMode`, `enterKeyHint`, `autoComplete`,
   `autoCapitalize`, `autoCorrect`, `spellCheck`. Amounts get the decimal pad;
   phone numbers the phone pad; codes the number pad with
   `autocomplete="one-time-code"`; emails and handles no capitals and no
   correction; names capitalised by word; search fields a Search key; the last
   field of a form a Go or Done key; every other field a Next key that moves
   to the next field. Write a test that walks the source for inputs with none
   of these, as the hand-rolled sheet test does for sheets.
2. **The composer rides the keyboard.** In every thread (member, agent, host,
   support, console) the composer sits on the keyboard with no gap and no
   jump, the newest message stays in view when the keyboard opens, and the
   thread does not scroll behind the status bar. On iOS in the native shell
   and in Safari; on Android with and without gesture navigation.
3. **Nothing important is under the keyboard.** A sheet with a field lifts
   above the keyboard; a form's primary button is reachable without closing
   the keyboard, either by scrolling into view or as a bar on the keyboard.
4. **Dismissing.** Dragging the thread down dismisses the keyboard; tapping
   outside a field does; Done does. The keyboard never stays up over a screen
   that has no field.
5. **An accessory bar where it earns its place:** in the thread composer a
   slim row above the keyboard with the attach, camera, voice note and paste
   chip controls (section 6.2), so the field itself stays clean. In a
   multi-field form, Previous, Next and Done.
6. **Hardware keyboards.** Enter sends in a thread and Shift Enter makes a new
   line on a computer; on a phone Enter makes a new line and the button sends.
   Tab order follows the eye. `components/ui/KeyboardShortcuts.tsx` and
   `FormKeys.tsx` exist.

### 6.5 Status of the small works at the handoff

The session that wrote this handoff started them with two agents straight
after committing it. Before you start one, read `docs/handoff/STATE.md` and
`git log` for the latest: anything listed there as shipped is done; anything
not listed is yours.

| Item | Status when this file was written |
|---|---|
| 6.1 Confirmation pill | Being built by the previous session |
| 6.2 Paste | Being built by the previous session |
| 6.3 Count tabs and action sheet | Being built by the previous session |
| 6.4 Keyboard pass | Being built by the previous session |

---

## 7. THE MAIN WORK: the brief, phase by phase, with first tasks

The brief's own order (its section 19) is the order. For each phase: what it
means here, the first concrete tasks, and how you know it is finished.

### Phase 1. Discovery and audit

Most of the discovery exists (section 5). The work is to bring it up to date
and into one place.

- **One bug register.** Create `docs/handoff/BUG_REGISTER.md`: every open
  finding from the two surveys and the November audit, re-checked against the
  code today, each with an id, a severity, the file and line, how to see it,
  and a status. Drop what is fixed (most of the surveys' P0 and P1 items are).
  Then walk the app as a member, an agent, a host and a guest on a 390 px
  screen and add what the surveys could not see.
- **A measured baseline.** With the local production build and Playwright, on
  a throttled mid-range phone profile, record LCP, INP and CLS for: the
  landing page, home, search results, a listing, a stay, the inbox, a thread,
  the feed, the profile, the agent dashboard and the console overview. Record
  the first-load JavaScript per route from the build output. Put the table in
  `docs/handoff/PERFORMANCE_REPORT.md` under a dated heading. Signed-in pages
  need the QA member (the rules in section 3) or the `(dev)/preview` harness.
- **The product map.** Bring `docs/handoff/PAGE_LEDGER.md` up to date and add
  the ten facts the brief wants for each area (purpose, user, entry, actions,
  backend, database, navigation, states, mobile, opportunities) in
  `docs/PRODUCT.md`.

Finished when: the register exists and is true, the baseline table exists
with real numbers, and the ledger matches the routes in the build output.

### Phase 2. Bug fixes and foundation

Work the register from the top. Each fix carries a test that fails without it
where a test can see it. Group commits by area. Do not restyle while fixing.

Finished when: no open P0 or P1 in the register, and every fix is marked with
its commit.

### Phase 3. Design system and global experience

The tokens and gates exist. The work is consistency, measured, not a new look.

- **A consistency audit with numbers.** For every route in the ledger, at 390
  and 1440: the page header's parts and their positions, the back control,
  the primary action's place, the gaps between sections, the radius of every
  card, the loading, empty and error states. Tabulate what differs from the
  rule and fix the outliers. `docs/RESPONSIVE_RESEARCH.md` and
  `docs/BACK_NAVIGATION.md` hold the rules.
- **The circular home control (brief section 7).** He refers to "the
  referenced dashboard/page screenshots". They were not attached to these
  briefs. The likeliest pages are the workspace dashboards (`/agent`, `/host`,
  `/admin`), where a member is furthest from Vallo's home. Check how each
  header gets back to `/home` today; where it is missing, low or misaligned,
  add one round control at the end of the header: a house icon, 44 px, the
  same round button the back control uses (`components/ui/BackControl.tsx`,
  `nf-icon-btn`), the label "Back to Vallo home", press and focus states from
  the system. Then ASK the founder to confirm the page from a screenshot of
  the result; do not guess twice.
- **The shared parts from section 6** (count tabs, action sheet, the pill)
  are part of this phase; by now they exist. Finish applying them.

Finished when: the audit table has no unexplained outlier, and the home
control is confirmed by the founder.

### Phase 4. Public platform upgrade

One area at a time, in this order, because each feeds the next: home and
discovery; search and filters; the listing page; Make an Offer and the deal
room; messaging; stays; restaurants; roommates; feed and Circle; profile,
notifications and account; the help centre; the showcase page.

For each area: read its rows in the ledger and its open items in the
register; list the brief's numbered items that apply (section 5 of the brief
has 140) and mark each one already true, to build, or not for Vallo with a
reason; build; verify at 390 and 1440 in light and dark; record before and
after screenshots.

Two pieces have no starting point and need a proposal to the founder with
screenshots before the full build: the showcase page ("Discover Vallo") and
the founder action centre. Build a first version behind the preview harness,
show him, then finish.

Rules that bite here: never invent listing data or use stock photos as
listings; every published listing on live today is an example (64 of 64), so
stats, views and saves show nothing until a real listing exists, by design;
money wording comes from `lib/money/copy.ts` and never promises custody or
financing; no link previews fetched from the open web.

### Phase 5. Admin console upgrade

The console is dark only and has its own material
(`apps/web/src/app/css/admin.css`; its header comment names the four reference
renders it was measured from).

- **Staff see their own desks.** Done in code on 14 November; depends on the
  founder running `staff_desks_only_2026-11-14.sql` (section 9).
- **The restricted staff console** (`app/admin/_components/StaffFrame.tsx`)
  is now what most staff see. It is a header with buttons and a card of desks.
  Give it the same care as the operator's rail: a proper nav on a wide screen,
  a clean drawer on a phone, the person's tasks and what is waiting on them on
  the front page.
- **Every desk's tables on a phone.** The pipeline table
  (`app/admin/business-development/ProspectBoard.tsx`) is the pattern: columns
  from 1024 px, cards below, the record under the row.
- **The founder command centre:** propose first (above).
- **Screenshots in the staff manual:** every chapter has a slot. A capture run
  needs a staff session, which an agent may not use on production. Capture
  from the preview harness with fixture rows and label them as examples, or
  ask the founder to run a capture script himself.
- The founder-authority rule stands: only the founder's account gives or ends
  privileged access (`private.founder_accounts`, `private.is_founder`). Never
  weaken it, never hardcode an id.

### Phase 6. Motion and performance

- **Motion:** one shared system exists. The brief's ten signature moments are
  a list to choose from; build the ones that have a place (the opening, the
  save, the offer sent, the gallery) and skip the rest with a reason. Budgets
  from the brief: 100 to 250 ms for a small interaction, 200 to 450 ms for a
  part, 300 to 700 ms for a page. Every one respects reduced motion
  (`lib/ui/calm`) and none delays a tap.
- **Performance:** work from the Phase 1 baseline, worst number first. Do not
  add a data library: the app uses server components, server actions, a
  per-request memo and Next's own caches, and the brief itself says no
  competing caching libraries. Never cache money, identity, offer or booking
  state as if it were current. Report every change as before and after.

### Phase 7. Final QA, security and re-audit

The journeys in the brief's section 17, run for real where the rules allow
(the QA member, read-only on production; writes on a local build or the
preview harness), the permission probes in `supabase/tests/probes`, the whole
suite, a production build, and a second audit by the agent that did not build
the thing. Then the documents in section 12.

---

## 8. The Supabase audit: what is already known, and what to do

The follow-up brief (Part C) asks for a serious audit: structure, cost, power,
security. A good part was done under pressure on 13 and 14 November. Start
from these facts, all read from live.

**The instance.** Nano compute, eu-west-1. Database about 132 MB. On 13
November it ran out of disk IO budget (CPU 97 percent, IO balance 0 percent)
and members saw statement timeouts between 14:00 and 17:00 UTC (57 in the
worst hour). No timeouts since 18:00 UTC that day.

**What was found and fixed.**

| Finding | Fix | State |
|---|---|---|
| `cron.job_run_details` held 183,960 rows from August, never purged | Purged to 7 days, with a daily job at 03:47 UTC | Applied; about 29,000 rows |
| Two cron jobs ran every minute | The hold sweep now runs every 5 minutes; the calls sweep stays every minute (a ringing call must time out) | Applied |
| `shell_context()` evaluated RLS on seven tables on every signed-in page load | Rewritten as security definer with explicit filters; the body matched live for 32 members | Applied |
| `rate_limits` updates could not be written in place | `fillfactor` 70 and tighter autovacuum | Applied |
| Sign-in triggers on `auth.sessions` do bookkeeping inside the sign-in | A draft moves them to a queue; the new-device email arrives up to a minute later | DRAFT, his decision: `supabase/drafts/sign_in_bookkeeping_off_the_sign_in_2026-11-13.sql` |
| `service_role` has no statement timeout | Part 4 of `supabase/drafts/auth_speed_2026-11-13.sql`, commented out | His decision |

**What is still to audit** (the follow-up brief's list, with where to look):

- **Query cost.** `pg_stat_statements` was reset at 10:09 UTC on 13 November.
  Read the top statements by total time and by mean; the listing catalogue
  selects ran at 234 to 266 ms before the app cached them; `my_unread_counts`
  138 ms, `passcode_status` 107 ms, `my_invite_step` 272 ms mean. For each,
  `explain (analyze, buffers)` as the calling role, on live, read-only.
- **Indexes.** `mcp__Supabase__get_advisors` (performance) lists unused and
  missing ones. Unused indexes on a Nano cost writes; propose drops as a draft,
  never apply.
- **Realtime.** The WAL reader (`realtime.list_changes`) was the heaviest
  statement by total time (40,454 calls). List what is in the
  `supabase_realtime` publication and which tables a client actually
  subscribes to; every table published and never subscribed costs for nothing.
- **Cron.** 45 jobs. Read each schedule against what it does; several hourly
  purges could be daily.
- **Storage and egress.** Buckets, their size limits and whether they are
  public; image transformation use; whether listing photos are served at the
  size they are drawn (`next.config.ts` has the image sizes).
- **RLS and functions.** `get_advisors` (security); every `security definer`
  function's `search_path`; every function executable by `anon`. On 13
  November four Circle functions were found executable by `anon` and closed.
  The probes in `supabase/tests/probes` are the regression tests; add one for
  everything you close.
- **Auth.** Each password check from a server action (`reauthenticate`) opens
  a session in GoTrue (they show as `node` in `auth.sessions`). The console's
  password door adds one per console entry. Check whether those sessions
  linger and whether a purge is needed.
- **The instance size.** If, after all of the above, CPU still sits near the
  top on a quiet database, the honest answer is the next compute size. That
  is a spend: give the founder the price and the evidence, and let the three
  founders decide.

**How to write a SQL file that survives his phone.** He pastes the whole file
into the Supabase SQL editor and presses Run once.

1. Read live first (constraint names, function bodies, row counts) and say in
   the header what you read and when. Never write from the migrations folder
   alone.
2. One transaction. A read-back inside it that raises if anything is not as
   written, so a wrong result keeps nothing.
3. Safe to run twice.
4. A self-test that needs data skips, with a word, when live has none.
5. End with one `select` that shows a row he can read at a glance, and say in
   your message what he should see.
6. Test it twice on the local Postgres with a stub shaped like live, including
   the awkward shape (no rows, all examples, an extra admin).
7. Say what it does not do, and how to undo it.
8. After he runs it, verify on live with your own read-only queries before
   you believe the screenshot.

Deliver the audit as `docs/DB_NOTES.md` (it exists; extend it) with the
sections the follow-up brief lists, and the SQL as files.

---

## 9. The console and staff: what changed on 14 November

**The problem.** The Business Development Director signed in nine times on 13
November and never got inside the console. Her security key was made on her
iPhone; the console on her Windows computer had no key to answer with, and a
staff account may add a second key only by proving the first.

**The founder's rulings (his words are in the verbatim file).**
- Admins and staff open the console with their own account password, asked
  once per sign-in session and again after twelve hours. No security key.
- "I don't want password for super admin for now": a super admin keeps the
  key.
- A person with a position sees their own desks, not the whole console.
- The Business Development Director also reviews identity checks.
- The prospect pipeline is kept in the console, not in Zoho.

The lead advised that a password alone is not a second factor and offered
password plus an emailed code; he chose password only. It is recorded in
`docs/handoff/FOUNDER_DECISIONS.md`. Do not reopen it unless he does.

**How it is built.**
- `apps/web/src/lib/security/console-door.ts`: which proof a person uses
  (`key` for a super admin, `password`, or `email-code` for an account with no
  password).
- `apps/web/src/lib/security/console-step-up.ts`:
  `confirmConsoleWithPassword` checks, in this order, that the caller is not a
  super admin, is staff, is within five tries in fifteen minutes, and that the
  password (or code) is right; then writes the same `console_step_ups` row the
  key writes, with no credential id, and an audit line with the method. The
  database reads that row (`private.console_step_up_ok`), so nothing in the
  database changed.
- `apps/web/src/app/admin/_components/ConsoleStepUp.tsx`: the screen.
- The lock on money (`money-step-up-actions.ts`) is untouched: a payout or a
  refund still asks for its own proof.

**What the founder still has to run:**
`supabase/migrations/pending/staff_desks_only_2026-11-14.sql`. It adds
`kyc_review` to the Business Development bundle and to the holder's grant, and
takes the `admin` role from the two people who hold a named position. Until he
runs it they keep the whole console. After it, each must acknowledge the staff
handbook before their desks open (neither has).

**Who holds what on live** (14 November): two super admins (the founder, who
is exempt from the door, and one other who uses a key); three admins, two of
whom are the position holders above; three older staff grants with no named
position.

---

## 10. Open items, blockers and decisions waiting on the founder

| Item | State | What unblocks it |
|---|---|---|
| Push to `main` | DONE on 14 November at `4baa05fb4`, after typecheck, lint, every gate, a production build and the whole suite (16,334 tests; seven failed on the first run, all from the door's new wording and one weekday-dependent test, fixed and rerun green). Everything after that commit is on the branch only | His next literal say-so |
| `staff_desks_only_2026-11-14.sql` | Sent to him on 14 November. Check on live whether he ran it | He runs it |
| App icon badge | No badge plugin is installed and push sends no badge number | His yes to `@capawesome/capacitor-badge`, then a store release |
| Approximate figure in saved-search emails | No saved-search email exists; alerts are in-app only | His decision to send that email at all |
| Link previews in messages | Deliberately not built (see `lib/messages/linkify.ts`) | Only if he reverses the security choice |
| Example listings in the stats | All 64 published listings are examples and examples are never counted | His decision, or the first real listing |
| The QA member's saved list | Needs one unsave and one re-save on production | His say-so; it is a change on production |
| Search page upgrade | Queued since 12 November; he asked for a proposal with screenshots first | Phase 4 |
| Sign-in bookkeeping draft; `service_role` timeout | Drafts | His decision |
| A bigger database instance | Not needed today; watch CPU | Evidence, then the three founders |
| Copy image from a message | Only Save photo was built | Phase 4, messaging |
| Which page the circular home control belongs on | Not identified | A screenshot from him, or his confirmation of yours |
| The 0.4 second pill | Built as 1.4 s held and 0.4 s out | Only if he asks for faster |
| "Keyboard" | Read as the typing experience | Only if he meant a custom keyboard |

---

## 11. Verification: what counts as proof

"Never claim something works without running it." For each kind of work:

| Work | Proof |
|---|---|
| A screen | Rendered and looked at, at 390 and 1440, light and dark (the console is dark only). No horizontal scroll (`scrollWidth` equals `clientWidth`), no control under 44 px, no console error. Screenshots kept in the scratchpad and the best two sent |
| A signed-in screen you cannot reach | A page under `apps/web/src/app/(dev)/preview` that draws the real component with fixture rows (the proxy closes `/preview` on production). Say it was seen on the harness, not on the real page |
| An interaction | A Playwright script that performs it and reads the result, or a DOM test |
| A server action | A unit test for every refusal as well as the success, asserting what was written and what was not (`lib/testing/fake-supabase.ts`) |
| A SQL file | Run twice on the local stub, then verified on live after he runs it |
| A performance claim | The same measurement before and after, on the same profile |
| Anything on a real phone | You cannot. Say so, and say which items are test-only |

**The quality bar for frontend** (his words: "high end", "clean", "sharp"):
tokens and existing classes only, no one-off colour, size or inline style; the
platform's own components before a new one; real loading, empty, error and
offline states; accessible names, focus order and focus return; 44 px targets;
reduced motion respected; words that say what happened and what to do. Look
at your own screenshot before you call it done; four defects were found that
way on 14 November that no test would have caught.

---

## 12. Documents you must leave behind

Update, in the existing files:

| Document | What goes in it |
|---|---|
| `docs/handoff/STATE.md` | Who did what, and how to pick up after any stop. Update it at the end of every round |
| `docs/handoff/WORK_QUEUE.md` | The queue with the eight stages |
| `docs/handoff/BUG_REGISTER.md` (new) | Phase 1 |
| `docs/handoff/PAGE_LEDGER.md`, `docs/PRODUCT.md` | The product map |
| `docs/handoff/PERFORMANCE_REPORT.md` | Baseline, then each before and after |
| `docs/DB_NOTES.md` | The Supabase audit |
| `docs/handoff/FOUNDER_DECISIONS.md` | Every ruling, dated, with what the lead advised when it differed |
| `docs/UX_SYSTEM.md`, `docs/DESIGN_DIRECTION.md` | The shared parts from section 6 and how to use them |
| `docs/ADMIN_CONSOLE.md` and the staff manual chapters | When a desk changes, its chapter changes and the manual's date moves (`lib/admin/manual/chapters.ts`) |
| `docs/DEPLOY.md` | Only if the deploy steps change |

Before-and-after screenshots worth keeping go in `docs/handoff/refs`. Never
commit a screenshot that shows a real person's name, face, message or
contact detail.

---

## 13. The definition of done

For a task: built, seen (section 11), tested, the gates clean, committed with
a message that says why, pushed to the branch, its row in the queue moved to
Completed, and its document updated.

For the upgrade as a whole, in the founder's words: a user "understands what
to do immediately, reaches their destination quickly, feels confident in the
platform and enjoys every interaction", and "every improvement [has] a clear
reason for existing". Measured: no open P0 or P1 in the register; the Core Web
Vitals targets met on the baseline pages or the gap explained; every route in
the ledger checked at 390 and 1440; the Supabase audit delivered with its SQL;
the staff console usable by a person who has only their own desks; and a
final report that says what was done, what was not, and what he has to decide.

Do not make Vallo more complicated to make it look advanced.
