# The Vallo admin console: the operations handbook

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

> **Session 3, 6 October 2026.** The console's shell, overview, queue tables, desk sections, rulings and phone drawer were rebuilt on the shared components, and the Money desk, the Agreements gate, the Compliance desk and the console search are described below as they now stand. Session 3 did not add or remove a desk or an address (D28); it gave Lookup, People and Account recovery, which already existed but were reachable only by a typed address, rows on the rail. The money rules and the reads behind each desk are Session 2's; where this document touches them it names the file they live in.

This is the document a new operations person reads on their first day and can
then run the platform from. Every desk is here: what it shows, where each number
comes from, what each action does, who may take it, what it changes, and what the
desk cannot do. The last part records the options that were considered and
rejected, with the reasons.

Owned by Session B (`docs/archive/SESSION_B_SCOPE.md`). The queries and actions behind
the desks live in `apps/web/src/lib/admin/**`, which the other session owns;
where a desk needs something that layer does not return yet, the gap is named
here and raised as a request in the scope file.

## 0. The team console (29 September 2026)

The console is run by a team, not only by admins. This section is what
changed and where each piece lives; the desks themselves are described from
section 1 on.

**Staff scopes.** A super admin grants a person one or more scopes at
Settings > Staff (`/admin/staff`). A scope opens exactly one area, and a
desk that asks for no scope is closed to every staff member. Admins and super
admins hold every scope.

| Scope | Opens |
|---|---|
| `listing_approval` | Listings (`/admin/listings`) |
| `kyc_review` | Verification (`/admin/kyc`) and filed identity documents |
| `moderation` | The moderation lanes of the Unified queue (`/admin/queue`) |
| `support` | Support (`/admin/support`) |
| `agreements` | Agreements (`/admin/agreements`) |
| `guarantee` | Guarantee claims (`/admin/agreements#claims`) |
| `finance` | Money (`/admin/money`, read only) and Payments (`/admin/payments`) |
| `compliance` | Compliance (`/admin/compliance`) and the audit log export |
| `operations` | Operations, Alerts, Bookings and Team oversight |

A CFO or a compliance officer is therefore never made a full admin to see
their own area. Nobody decides their own case: a reviewer cannot approve
their own listing, application or identity check (the app refuses, and a
database trigger refuses again).

**Named positions.** A grant can carry a position: Moderator, Support Agent,
KYC Reviewer, Listings Reviewer, Agreements Officer, Head of Trust and
Safety, Compliance Officer, Finance Officer, Operations Manager, Chief
Financial Officer, Chief Operating Officer, Chief Executive Officer. Each
comes with a default bundle of scopes (the super admin may add or remove
any) and a job description, which is sent in the access email and shown to
the holder at Handbook > Your role (`/admin/handbook/position`). The list
lives in `lib/admin/staff-positions.ts` and the database
(`private.staff_position_scopes`); a test keeps the two identical.

**The staff directory** (`/admin/staff`) lists every admin, super admin and
staff member, with their position and scopes, who granted and who revoked
them, and when each was last active. Its other panels are in section 15.22.

**What a staff member sees.** Not the operator's rail: a short frame that names
only the desks their scopes open, plus the handbook, their role and help. Their
front page at `/admin` lists the same desks. Nothing unlocks until they have
acknowledged the handbook (section 15.22).

**Queues for a team.**
- Counts on the rail and the Unified queue count only the work your scopes
  reach, and its tabs show only the lanes you may decide.
- Claims are binding: a claimed item can be decided only by the person who
  holds it (or an admin who reassigns it). Two people deciding the same item
  at once cannot overwrite each other: the second is told it was decided
  elsewhere.
- New work in a scoped queue notifies the people who hold that scope.
- A reason is required for every listing rejection (at least eight
  characters), every report dismissal (at least eight characters) and every
  ticket closure. The reason is kept on the record and in the audit log.
- Held posts are decided through `moderation_decide`, which stamps who
  decided and when.

**Internal notes.** The support ticket, the person file and the listing
under review carry internal notes (`member_notes`). A note is never shown to
the member, and it is visible only to the desk it was written on (and to
admins).

**Team oversight** (`/admin/oversight`, operations scope): each queue's backlog
with its oldest waiting item, and each staff member's work over the last 30 days
(section 15.23).

**CSV exports.** Money (`/admin/money/export`, finance), the audit log
(`/admin/audit/export`, compliance) and team oversight
(`/admin/oversight/export`, operations). Every export is itself written to
the audit log, and every cell is neutralised against spreadsheet formula
injection (`lib/admin/csv.ts`).

**Audit that cannot be lost quietly.** An audit write that fails is retried;
if it still fails, a critical `audit.write_failed` alert is raised on the
Alerts desk rather than the failure being swallowed.

**Staff sign-ins.** Every new session for a staff account writes a
`staff.sign_in` row to the audit log with the network it came from and a
hash of the browser. A sign-in from a network and device not seen for that
account in 60 days notifies the account holder and every super admin.

**Payments and earnings.** Members see their own history at `/payments`,
agents at `/agent/earnings`, hosts at `/host/earnings`; the Money desk shows
the platform-wide history with its CSV export. All of it is read from what
already moved through Paystack; Vallo holds no customer money.

## 1. Before you start

**Who can enter.** Anyone whose account holds the `admin` or `super_admin`
role in `public.user_roles`, or a live staff grant (section 0) whose holder
has acknowledged the current staff handbook. The check is `requireAdmin()` /
`requireConsole()` in `lib/admin/guard.ts`, called in `app/admin/layout.tsx`
before a single figure is read. Signed out, you are asked to sign in. Signed
in without a role or a grant, `/admin` answers "not found", exactly as an
address that does not exist would, so the console does not confirm it is
there. Every read on the overview, operations and analytics desks runs
through your own session, so the database's row level security decides what
you may read, not the page.

**Your security key, every sign-in.** A password alone never opens the
console. Before any desk opens, every admin, super admin and staff member
confirms with their security key (the passkey on their phone or computer,
set up at Settings > Privacy), once per sign-in session and again after
twelve hours (`app/admin/_components/ConsoleStepUp.tsx`). The database
enforces it, not the page: `private.has_role` and `private.staff_can` treat
your role or scope as held only while your session has a live proof in
`public.console_step_ups` (migration `20260929122514`). A stolen password
therefore reads exactly what an ordinary member reads, even straight through
the API. A staff account's first key takes the password AND a code emailed
to you; any later key, or removing one, takes an existing key; every key
added to or removed from a staff account is written to the audit log and
announced to its holder and every super admin. A lost key is reset by the
founder from the database.

**Where you land.** Entering the console always opens the Overview at
`/admin`, including when you arrive by address. The first time in a browser
session that you open any desk address (typed, bookmarked, sent to you, or
returned to after signing in with `?next=/admin/money`), the console sends
you to the Overview first, and the Overview's first line is "You were
heading to Money" with a Continue link straight to that desk. After that,
for the rest of the browser session, desk addresses open directly. The
session is remembered in a cookie that holds your user id and ends when the
browser closes; signing in as someone else starts a new session. This lives
in `app/admin/_components/EntryGate.tsx` and `entry.ts`, and only a console
address is ever offered back.

It works with JavaScript off. The "Opening the overview first." link a desk
shows while it hands you to the Overview goes through
`/admin/enter?next=<where>` (`app/admin/enter/route.ts`). That address checks
you are an admin, sets the same session cookie on the server (path `/admin`,
SameSite Lax, no expiry) and sends you on with a 303, always to the
Overview: bare, or carrying the desk you asked for. It never sends you
straight to a desk, so even a typed or bookmarked `/admin/enter` link
cannot skip the Overview; anything that is not a console desk, including
another site, lands on the bare Overview. Someone who is not an admin gets
no cookie and is sent to `/admin`, which says why. The Overview's Continue
is then a plain link to the desk, because the cookie is already set.

**The back arrow.** The top bar opens with the platform's back arrow. It
goes up the console's declared hierarchy (`lib/nav/route-parents.ts`), not
back through your browser history: from any desk to the Overview, from a
record (a listing under review, a booking) to its desk, and from the
Overview to Home.

**How to read a panel.** Every panel is one of four things, and it always says
which:

| What you see | What it means |
|---|---|
| Figures, a chart or rows | Read from the database just now. Every number came back from a query; none is typed into the page. |
| A quiet panel with a title such as "No money has moved yet in this range" | The read worked and there is genuinely nothing to count. On 22 September that is the normal state: no real listing is live, no booking has been made, no money has been collected. |
| "Not recorded" (on a figure) or "Not wired yet" (on a panel) | The platform does not record this yet. The panel names the request in `docs/archive/SESSION_B_SCOPE.md` that would start recording it. It is not a fault of the platform or of your data. |
| "Unavailable" or "This did not load" | A read failed. Nothing has changed; the page re-reads every minute, or reload. If it persists, check Operations for a failed job or a locked-out scheduler. |

**The console never draws a number the database did not return.** A change
("+12%") is drawn only when both periods were counted from real rows. From a
previous period of zero it is drawn as a count ("+3"), never as an invented
percentage. A chart with nothing behind it says so in words and draws no line.

**Examples are never supply.** The 64 example listings that show the product
before real owners arrive (`listings.is_demo = true`) are counted on the
Examples desk and nowhere on the Overview or Analytics.

**The status words and colours**, used on every desk:

| Word | Colour | Means |
|---|---|---|
| Healthy, Resolved, Passed, Success | emerald | good, or done |
| Pending, Medium, No run yet, Under review | cyan | in flight, needs a look |
| Info, Attention, System, Admin | blue | information |
| High, Failed, Overdue, Rejected | rose | wrong, act now |

Every badge carries its word as well as its colour, so nothing depends on
telling two colours apart.

**Time.** Every date and every "per day" is Lagos time (UTC+1, no daylight
saving). "12m ago" is measured from when the page was read.

## 2. The shell

Session 3 rebuilt the console's material (Plate rows, Card panels, Island
surfaces, Sheet overlays) and added the console search, the desk sections, the
batch tray and the phone drawer's one-line descriptions. It did not add or remove
a desk: a person who used the console before finds the same rail, bar and desks
(D28), with Lookup, People and Account recovery now on the rail. The shell lives in `app/admin/layout.tsx` and
`app/admin/_components/` (`AdminFrame`, `AdminNav`, `nav.ts`, `ConsolePalette`,
`palette.ts`).

**The rail** (left, desktop). The Vallo mark, then eleven rows in the order the
renders draw them: Overview, Listings, Supply, Verification, Money, Agreements,
Bookings, Moderation, Support, Operations and Analytics. Settings is the
twelfth row, pinned at the foot above your name and role ("Platform Operator",
or "Platform Owner" for a super admin); your name opens your profile. The open row
has a leading bar, a tinted fill and a brighter glyph. The map is one list in
`nav.ts`, read by the rail, the phone drawer and the console search, so the
three cannot disagree about what a desk is called or where it is.

**The count badge.** A number on a cyan fill is work waiting on that one desk
right now, read by `getQueueCounts()` once per request, so the rail, the
overview figures and the tab counts are the same figure. Hover a number, or
listen to it, and it says what it counts. These rows carry one:

| Row | What the number counts |
|---|---|
| Unified queue (under Overview) | reports, flagged messages and held content together |
| Listings | listings waiting on a review decision (the same figure as the overview's Open reviews) |
| Applications (under Supply) | applications waiting on a decision |
| Agreements | agreements waiting for review before payment opens |
| Support | support tickets open or pending |
| Operations, and Alerts under it | alerts open and waiting on a person |

Rows without a queue carry none. The fill and the ink come from the tokens
`--nf-count-fill` and `--nf-count-ink` in `admin-material.css`, so the number
keeps its own ink at night instead of the link ink. The same badge is on the
phone filter control (how many filters are on) and in the console search.

**Desks inside a row.** The console has more desks than twelve. Each lives
under the row it belongs to and is listed beneath that row while you are in it:

| Row | Desks inside it |
|---|---|
| Overview | Unified queue (`/admin/queue`), Lookup (`/admin/lookup`) |
| Supply | Applications (`/admin/agents`), Businesses, Stops |
| Verification | Compliance (`/admin/compliance`) |
| Money | Payments, Fees |
| Moderation | Around (`/admin/social`), Standing |
| Support | People, Account recovery |
| Operations | Alerts, Audit log, Team oversight |
| Analytics | Front door |
| Settings | Switches, Reference data, Examples, Staff, Staff handbook, Help and support |

Message flags, Reports and Held content are lanes of the Unified queue, not
rows (section 15.1); `/admin/flags`, `/admin/reports` and `/admin/moderation`
redirect there. The Moderation row opens Around. Escrow has no row: its address
redirects to Agreements (section 9). Listings, Agreements and Bookings have no
desks inside them. **All desks** follows the rows: a disclosure whose badge is
the waiting total across the desks inside it, and which lists every one of
them, so no desk is ever more than one click away. Reservations
(`/admin/bookings/reservations`) and Field speed (`/admin/field-speed`) have no
row: Reservations is reached from the Bookings desk and the console search, and
Field speed from a tab link on Operations.

**The bar** (top, left to right): the menu button on a narrow screen, the back
arrow, the Vallo mark on a narrow screen, the search field, the search button,
the Lagos date and time, the bell (your own notifications; a rose dot means
unread) and you. The back arrow goes up the declared hierarchy (section 1).

**The search field.** Type and press Enter. If what you typed reads as a
reference (a ticket reference, an id, an email address, a listing code, a
payment reference or an error reference), it goes to Lookup
(`/admin/lookup?q=`). Otherwise it searches the desk you are on through that
desk's own `?q=`, and on a page with no search of its own (Overview,
Operations, Analytics, Settings) it searches the Unified queue. On a keyboard
device the field shows the shortcut, Ctrl K or Cmd K.

**The console search** (`ConsolePalette`, reference 7067). Control K or
Command K opens one box over every desk, from anywhere in the console; on a
phone the bar shows a search button for it instead of the field. It only
routes: every row is a link to a desk or to a search, and the search itself runs
on the desk it lands on, under that desk's own access check. A desk your
account cannot open is still listed, and opening it answers with the refusal
that desk always gave.

- **Desks.** Up to eight, each with its glyph, its name, one line saying what it
  is for, how many are waiting on it (the rail's badge figure) and, where the
  console has one, its key (`g` then a letter). With nothing typed, the desks with
  work waiting come first, most first, then the rest in the rail's order. With
  text typed, a name that starts with it ranks first, then a word that starts
  with it, then a name that contains it, then a line that mentions it.
- **Search for.** Below the desks, once something is typed: look it up as a
  reference (leads the list when you pasted one), search the open desk for the
  words, search people, and search the Unified queue.
- **Keys.** Arrow Down and Arrow Up move through the rows and wrap, Enter opens
  the highlighted one, Escape closes. Tab stays inside, focus returns to what
  opened it, and a polite line announces how many results there are.

**Keys on every desk** except Support, which has its own (`DeskKeys`,
`components/app/desk/desk-keys.ts`): `j` and `k` move to the next and previous
row, Enter opens the focused row, `a` and `x` put focus on Approve or Decline
(they never press it), `g` then a letter jumps to a desk (`q` Queue, `l`
Listings, `k` Verification, `s` Support, `b` Bookings, `p` Payments, `a` Alerts,
`o` Overview), and `?` lists the keys. None of them works while you are typing
or with Control, Command or Alt held.

**Keeping current.** Overview, Operations, Analytics and Payments re-read
themselves every minute while the tab is visible, and Listings, the listing under
review, Verification and the Held lane every thirty seconds, in each case at
once when you come back to the tab and without losing your place. Every
decision taken on a desk refreshes the pages it affects.

**Narrow screens: the phone drawer.** Below 1024px the rail becomes a drawer
behind the menu button at the top left. The button's name says which desk is
open and how many are waiting, and a cyan dot on it means work is waiting. The
drawer slides in from the left as a dialog: the Vallo mark and a close button
at the head, a line saying how many are waiting across the console, the same
rows as the rail with each desk's one line under its name and the open
section's desks beneath it, All desks, and Settings with your name at the foot.
It closes when you choose a destination, on Escape and on a tap on the scrim;
the page does not scroll behind it, Tab stays inside it and focus returns to the
menu button.

The rest of the narrow layout: panels stack one per row. Queue tables are card
rows; a table that is a real table (payments, bookings, supply) stacks into
labelled cards; a table with nothing else to be scrolls sideways inside its
panel, never the page. Below 768px a desk's filters open in a bottom sheet from
one control (the sliders button, with the number of filters on beside it): the
dates and the status chips together, with Clear filters and Show results at its
foot. From 768px they are inline. A decision control (approve, send back,
reject) sticks above the home indicator below 900px so a document can be read
and decided one-handed. Every header control is a 44px circle.

**A desk's sections.** The Money, Operations and Analytics desks answer several
questions on one page. Under the bar a quiet glass strip names the section being
read; pull it down or tap it and the desk's sections unfold, and choosing one
scrolls to it. The strip sticks under the bar as the page scrolls. A section is
also an address (`/admin/money#refunds`) that can be sent to a colleague, and
the page reads top to bottom with scripts off.

| Desk | Sections, in order |
|---|---|
| Money | The Guarantee, Cautions, Refunds, Reconciliation, Tenancy charges (only when its read worked), Refund clock, Payments and refunds |
| Operations | Health, the open tab's name, Recent alerts, Audit log |
| Analytics | Figures, Demand vs supply, Top areas by price checks, Areas with fewest listings, Price checks vs answered, Top common refusals, and Sent back when there is something to show |

**Desks that only read.** Supply, Operations, Analytics, Audit log, Team
oversight, Front door and Field speed carry one quiet line under their heading:
"This desk reads and reports. It changes nothing: decisions are taken on the
desk each item belongs to."

**Tables, filters and pages.** Every queue uses one dense row (`QueueTable`).
A row is the type's glyph on its tile with the type word under it, the title
with the place or person beneath, a detail column on desktop, the reference, the
status chip, the submitted stamp, then View and a more glyph. A row that carries
its own detail opens it in place; one that has its own page links to it. The
status chip draws the status as a word, a shape and a colour, never colour
alone. Count tabs above a queue (`QueueTabs`) show the live count beside each
tab and are links. The filters are one search box, a Lagos date range and
status chips, all in the address, so a narrowed queue can be shared. From 768px
a desk pages with a sliding indicator: desks that do not know their total
(`QueueSlidePager`) name only the pages they have evidence for, and desks that
count their rows (`NumberedSlidePager`: payments, bookings, supply) name every
page. Below 768px both give way to previous and next or numbered links.

**Documents and slides.** Where the console shows a record it draws a light
document sheet (`DocumentSheet`) inside the console's own theme: the Guarantee
reserve statement, the refund record, the payments and refunds ledger, the fee
revenue statement, a stay's payment record and the STR register. The controls
sit beside or under the sheet, never on it. Where a ruling is final, it is a
slide (`DragToConfirm`): the handle slides to the end, the ruling is confirmed
only after the server has answered, and a refused ruling says "That did not go
through" with the server's own sentence on the row. A slide marked as money does
not spring back once confirmed. Guarantee claims, caution rulings and the STR
approval and release are slides (sections 8 and 15.17). Money rulings are taken
one at a time and are never in the batch tray.

**The document viewer.** A person's identity, registration or ownership document
opens in a sheet inside Vallo (`DocumentViewer`), served from
`/api/documents/<id>` on Vallo's own origin behind the admin check, with one
audit row per view. Verification, Applications and Businesses use it. An image is
drawn in the sheet. The console does not draw a PDF yet, so a PDF is offered as a
file from Vallo's own origin.

**Case history.** On the person file and on a stay, the record of what
happened is folded into one disclosure with its title and entry count always
visible. Money, price, trust facts and a decision's state
stay on the page above it.

**People, Lookup and Account recovery** are on the rail (People and Account
recovery under Support, Lookup under Overview). They were reachable only by a
typed address or a link from another desk.

## 3. Overview

Drawn from the render `5EAA44CB`. Reads: `lib/admin/reads/overview.ts`
(`getConsolePulse`, `getCollectedSeries`, `getSupplyByType`,
`getNewListingsByRole`), `lib/admin/reads/operations.ts` (`getJobHealth`),
and the existing `getQueueCounts` and `getRiskAlerts`.

**The page, top to bottom.** A staff member's `/admin` is their own front page
(section 15.22), not this one. For an admin:

1. A heading, "Console overview", which is read out and not drawn, and, when you
   were sent here from a desk address, the "You were heading to" link (section 1).
2. **Waiting on a person.** The first answer: one larger tile with the total ("N in
   all", or "Nothing waiting on any desk"), then one tile for each of seven
   queues, in this order: Open message flags, Held content, Open risk alerts,
   Open reports, Agent applications, Listings in review and Support tickets. A
   tile shows its glyph, its name, its count (counting up once as the page
   arrives, not under reduced motion) and a chip that says Waiting or Nothing
   waiting. A zero is drawn as a zero. Each tile is one link into the desk that
   clears it: `/admin/queue?tab=flags`, `?tab=held`, `/admin/alerts`,
   `/admin/queue?tab=reports`, `/admin/agents`, `/admin/listings` and
   `/admin/support`. The figures are `getQueueCounts`, the reads behind the rail's
   badges, so they cannot disagree with it. Agreements and Guarantee claims are
   counted by the rail and have no tile. When the counts cannot be read the section
   says so and draws no figures.
3. The pulse strip and the four cards (below).
4. **Work by desk.** One gauge that shares the same seven counts between the
   desks. It is drawn only when something is waiting.
5. Naira transacted over time, Supply by type, New listings per month and Recent
   alerts (below).

**The pulse strip.**

| Figure | Where it comes from | The change |
|---|---|---|
| Listings live | exact count of `listings` with `status = 'PUBLISHED'` and `is_demo = false` | against the same count of listings that were already live seven days ago (`published_at` on or before then) |
| Sign-ups today | `profiles.created_at` on today's Lagos date; a caption gives how many people there are in all, the QA accounts left out | against yesterday |
| Naira transacted today | money collected today (see below) | against yesterday |
| Jobs healthy | the share of the Vercel Cron jobs (every one in `VERCEL_JOBS`) whose last run was on time and did not fail (Operations has the table) | none; a job count has no history |

**The four cards.** Live listings (as above), New supply this week (listings
submitted for review in the last seven days, examples excluded, against the
seven before), Naira transacted (money collected in the last seven days,
against the seven before), Open reviews (listings submitted, under review or
approved and not yet live, from `getQueueCounts`; no change is drawn because
an open count has no history). Each sparkline is the last fourteen Lagos days
of the same figure. Each card opens its desk.

**"Naira transacted" means money collected**, counted once on its way in. The
read (`collectedRows` in `lib/admin/reads/overview.ts`) counts successful
charges (`transactions.status = 'SUCCESSFUL'`) and nothing else. The comment
above it still names completed wallet top-ups; the read does not add them.

**Naira transacted over time.** The same money, per day (Last 30 days), per
week (Last 90 days) or per month (Last 12 months), chosen with the select at
the top right (it is in the address, `?range=`, so a view can be shared).
Hover or focus the chart and use the arrow keys for each bucket's amount and
number of payments.

**Supply by type.** Live listings, examples excluded, in six kinds that do not
overlap: Land, Hotels, Shortlets and Restaurants by property type, then every
other listing as Buy when it is for sale and Rent otherwise. Each is an exact
count; the bar is its share of the largest.

**New listings per month.** Listings created in each of the last twelve
months, examples excluded, split by who listed them: Owner, Agent or Firm, from
the door the lister came through (`agent_applications.supply_role`), or for
older listers from the agent record (`business` is a firm). The three are one
blue at three strengths with the third hatched, and hovering a month names
each.

**Recent alerts.** The five newest rows in `risk_alerts`, open or resolved.
The badge says Resolved (emerald) once somebody has cleared it, otherwise
High, Medium or Info. View all opens the Alerts desk, where alerts are
resolved.

**What the overview cannot tell you yet.** How many listings were withdrawn
last week (nothing records when a listing stops being live, so "live a week
ago" counts today's live listings that were already live then), and anything
about searches or views (see Analytics).

## 4. Listings: the review queue and the single listing under review

**Where:** `/admin/listings` (the queue) and `/admin/listings/<id>` (one listing
under review). Rail row: Listings. Built to `C1D98B3C` panels 1 and 2, with the
flow of `docs/design/references/roles/GOVERNING-12` panels 1 and 2.

**Who can use it.** Anyone holding the `admin` or `super_admin` role, or a staff
grant with the `listing_approval` scope (section 0). The
console layout checks the role once on the server (`requireAdmin`,
`lib/admin/guard.ts`) before any desk renders; every read below repeats the
check, and every read goes through the admin's own signed-in database client,
so row level security (`listings_admin_all` and friends) decides what comes
back. Nothing on this desk uses the service role.

### The queue

What you see, top to bottom:

- **Status tabs**: All, Waiting (`SUBMITTED`), Under review (`UNDER_REVIEW`),
  More info needed (`MORE_INFO_REQUIRED`), Approved (`APPROVED`, passed review
  and not yet live), Live (`PUBLISHED`), Rejected, Suspended. Every listing
  state has a tab; drafts do not, because a draft has not been submitted.
  Each tab's number is an exact count of listings in that status, examples
  included (`getListingStatusCounts`, `lib/admin/reads/listings.ts`, sixteen
  head-only count reads). A listing its lister closed with a reason is
  SUSPENDED underneath but is not a suspension: the count and the Suspended tab
  leave it out, and its row reads Closed.
- **Search and dates**: the search matches the title or the city (never the
  street address); From and To narrow by the date the listing was created.
  Both live in the URL, so a narrowed queue can be shared.
- **The table**: photo, the listing code (or `LST-xxxxxx` before it is live,
  since the database issues the real code at publish), type, area and city,
  the lister with their role tag (Owner, Agent or Firm, from their
  registration), the price with its unit, how long ago it was submitted, and
  the status badge. An **Example** tag marks every example listing
  (`listings.is_demo`): examples exist to show how the product looks and are
  never real supply. A waiting row whose photos also appear on another listing
  says "Photo seen elsewhere" with how many, and the lister's badge tier sits
  beside the name. Rows come from `getListingSubmissions`
  (`lib/admin/queries.ts`, Session A's), forty at a time; the pager numbers
  only pages it has evidence for (the read says whether there is another page,
  not how many).
- **Recently decided** (All tab, first page): the ten most recent decisions.
- **Queue health**: a donut over real listings only (Waiting, More info
  needed, Approved not yet live, Rejected), with the number of example
  listings left out written beneath it.
- **Average review time**: the median time from submission to decision over
  the last seven days, against the seven before, from the audit log's
  `listing.review` rows (`getListingReviewTimes`). `listings.reviewed_at` is
  overwritten by each decision, so it cannot give history; the audit log can.

The desk refreshes itself every thirty seconds while it is on screen.

### Mandates

Under the queue, the **Mandates** panel: what an agent or a firm holds instead
of ownership (`listing_mandates`), the owner's written instruction with the
owner's name and a number to ring. One status bar gives exact counts by
decision (Waiting, Approved, Rejected); the table lists every waiting mandate
(oldest first) and the twenty latest decisions: the listing, the kind
(letting, sale, management, and whether exclusive where the lister said), the
principal, the date signed and the status. Open a row for the principal's
number (the call to it is the check; the document is a photograph), whether a
document is on file and when the mandate expires, and for a refused one the
reason. Read by `getMandateQueue` (`lib/admin/reads/listings.ts`) under
`listing_mandates_staff_all`.

**Deciding a mandate.** A waiting mandate is decided in its own row
(`MandateDecision`, `decideListingMandate` in
`lib/compliance/beneficial-ownership-actions.ts`, SCUML item 17). Approving
records the principal's relationship to the lister, how the reviewer confirmed
the principal (a call back to the number, in person, a video call or documents),
when, and against the reviewer's name, with an ID document's reference if one
was seen; a NIN is refused before it is sent and again by the database. Refusing
asks for the sentence the lister will read, behind a confirm step. Beside it, the
principal's consent control for the landlord line says whether anything will be
sent to that number, and says so when the line is switched off. A listing
whose mandate was refused cannot be published (Track G migration 6).

### The listing under review

Open any row. You see: back to the queue (keeping your tab and search), the
code, a summary line (bedrooms, type, place, price), the photos with the
walkthrough video (plays in place; nothing is preloaded), Property details,
Power and water (the lister's own answers, worded exactly as the wizard asked
them), Amenities by name, the Location map (the listing's own pin on the
product's map tiles, with the provider's credit), Move-in costs or Purchase
costs **with every line naming who it is paid to** (landlord, agent, estate,
seller, state; Vallo takes no fee and the screen never implies it does),
Lister verification (role, verified or not, tier, which rungs passed), Reason
for review (the status in words, every admission check that fails, the last
note sent), the Description, and the full admission checklist. An example
listing says so above the photos.

A **Review progress** track under the heading draws where the listing stands
(Submitted, In review, Decision, Live), dating only the steps the record dates
(`listing-track.ts`); a draft or a suspended listing has none. Under the photos,
**Photographs that look like others on Vallo** says how many of the photos were
compared against how many others, lists any that resemble a photo on another
lister's listing or on one Vallo rejected, each linked, and offers a backfill
for photos not yet hashed; it is a resemblance for a person to look at, not a
decision. **Compound** shows the five compound answers as the renter reads them,
or says they were not answered. The lister's internal notes sit above the
listing (section 0).

Reads: the listing itself is Session A's `getListingSubmissions` view (so the
checklist and the costs are computed in one place); the pin, amenities,
availability, example flag, lister and the next listing are
`getListingReviewExtras` (Session B's).

### What the buttons do

- **Approve** calls `reviewListing(decision: "approve")`. The listing moves to
  `APPROVED`; the lister gets an in-app notification and an email ("passed
  review, we put it live next"); an audit row `listing.review` is appended
  with the before and after status and your note. It is NOT live yet.
- **Publish** (the same button once a listing is approved) calls
  `reviewListing(decision: "publish")`: `PUBLISHED`, the database issues the
  listing code, it enters public search, and the lister is told with the code.
- **Ask for more** calls `reviewListing(decision: "request_changes")`. It needs
  a reason (the field above the buttons); the lister receives it word for word
  and the listing moves to `MORE_INFO_REQUIRED`. Above the field a row of reason
  chips (Photos too few or unclear, Price missing a fee, Address does not match,
  Photos seen on another listing, Description too short, Wrong category) each add
  one reviewed sentence to what the lister reads, with the free note beneath, and
  the codes are kept on the `listing.review` audit row so Analytics can count them
  (`lib/admin/review-reasons.ts`).
- **Reject** asks to be pressed twice within five seconds, then calls
  `reviewListing(decision: "reject")`: `REJECTED`, the lister is told with
  your reason and can edit and resubmit.
- **Reopen the listing** appears instead of the decision bar on a listing its
  lister closed, with a field for why, which goes in the audit log.
- **Same property?** under the decision bar lists listings that may be the same
  flat, each with its signals (same or different owner on record, pins close
  together) and two buttons, Same property and Not the same; a listing already
  joined can be split. Nothing is joined until you say so, and an example has no
  panel.

After any decision the next listing waiting in your queue opens by itself; at
the end of the queue you return to it. A live or rejected listing shows no
buttons, only a line saying where it stands.

**What it cannot do.** It cannot suspend a live listing (that is Stops). It
cannot edit a listing. The Live, Rejected and Suspended tabs show the ten most
recent only, because Session A's read does not page its decided bucket; narrow
by title, city or date to reach older ones.

## 5. Moderation

**Where:** the Held lane of the unified queue, `/admin/queue?tab=held` (V-88: `/admin/moderation` redirects there). Built to `01F7DFC7` panel 1. The lanes are addressed with `?tab=`, not the `?lane=` the V-88 entry wrote, because the queue already named its tabs that way.

The Held lane lists only what the safety scan stopped before anybody saw it:
posts, stories, story comments, bios and events (`status = 'HELD'`), and its
count on the queue tab counts exactly those. **Reports** (what members filed
about a listing, a post, a story or a person) are the Reports lane, where the
reason chips (Payment outside, Scam, Unsafe and the rest) filter with
`?tab=reports&reason=<category>`.

- **Tabs**: Held by the scan (open) and Reports, by reason, which opens the
  Reports lane. The eight reasons a member can choose (payment off the platform,
  scam, unsafe, not as described, unavailable, offensive, duplicate, other) are
  chips on the Reports lane (`?tab=reports&reason=`), where they filter in the
  database and page forty at a time (`getReportsByCategory`).
- **Total reports**: open plus in review, exact, with new reports this week
  against last and a fourteen-day sparkline of new reports.
- **Over 24 hours**: reports still open past the 24-hour promise the Community
  rules make, plus held items older than a day.
- **The table**: item, reporter (or "Safety scan"), reason, age, status. Work
  still waiting comes first, oldest first. Open a row to read the words, open
  what was held, and decide. A held event can be read and opened but not
  decided: the row says there is no decision for one yet (request AR-10).
- **Report breakdown**: waiting reports by reason, on the blue ramp.
- **Queue health**: open, in review, held, and the median time from filing to
  closing this week against last.
- **Blocked terms**: says the list cannot be read from the console (request
  AR-11).
- **Safety holds**, for admins only, above the table: people whose new
  inspection requests are paused because somebody pressed "I feel unsafe" after
  writing to them, soonest to lapse first, each with Clear and Extend 72 hours.
  A hold lapses on its own. Staff with the moderation scope do not see the
  panel, because the database refuses them.

All figures: `getModerationSummary` (`lib/admin/reads/moderation.ts`), exact
counts and complete fourteen-day windows.

**Deciding a report** uses Session A's `ReportDecision` (`resolveReport`):
Start review, Resolve or Dismiss, each with a note; the report's status and
who moved it are written, and an audit row `report.review` is appended. The
reporter already heard their report arrived (trigger `notify_report`).

**Deciding a held item** uses `HoldDecision` (`decideHeldItem`): Let it
through (no reason needed) or Take it down (a reason is required, and the
author receives it word for word through the status triggers). Taking a bio
down empties it and leaves the profile.

Both decisions go through one database function, `public.moderation_decide`
(`20260929012228`), called as the operator: it checks the moderation scope,
changes the row only while it is HELD, and writes the `moderation.release` or
`moderation.remove` audit row in the same transaction. Staff holding the
moderation scope decide here too; the tables' update guards accept the change
only when it comes through that function (`private.may_moderate`).

**A lister's request about a review.** A lister who asks Vallo to look at a
review arrives on the Reports lane as a report on that review. Its card shows the
review's words, its rating, the reason the lister chose and their note, and two
outcomes, each confirmed in a panel: Keep the review (it stays up and keeps
counting toward the rating) or Hide the review (hidden behind a public note, never
deleted, and no longer counted). Either closes the report with your name on it and
tells the lister and the reviewer (`ContestDecision`, `decideReviewContest` in
`lib/admin/review-contest-actions.ts`).

**Cannot:** ban a member (Standing), or act on a message flag (Flags).

## 6. Verification

**Where:** `/admin/kyc`. Built to `8E9602E2` panel 2.

- **Awaiting review, Passed today, Failed today, Median decision time**:
  exact counts of documents from `agent_documents`, today being the Lagos
  calendar day; each against yesterday or a week ago
  (`getVerificationSummary`).
- **Identity verification queue**: one row per PERSON (their unit of work is
  a person, not a file): name, role (Owner, Agent or Firm, as they
  registered), tier on the four-rung ladder, rungs passed of four, latest
  upload, how many documents wait. Open a row for their ladder (including
  pending rungs an automated check raised), business details, and every
  document, opened inside Vallo in the DocumentViewer (never a raw storage
  link), with Approve or Reject on each pending one. Filter by document
  status and upload date; there is no name search because the name is not on
  the document row.
- **Verification funnel**: every document by decision, one status bar with
  the word on each part.
- **Results by rung**: identity, address, payout account, met in person, each
  counted passed, pending, failed (`agent_verification_checks`).
- **Recent verifications**: the ten latest decisions.
- **Recently decided**: under the queue, the people whose documents were just
  decided.

**Deciding** uses Session A's `DocumentDecision` (`reviewKycDocument`, then the
database function `review_kyc_document`): approving needs no reason;
rejecting needs one of at least twelve characters, which the person receives
word for word. The function writes the audit row and the notification.

**Documents sent from Get verified** (`/verification`) carry their uploader
and no application; the desk groups them by uploader like any other, marks the
person "From Get verified", and names them from their registered first name
and surname when they have not chosen a display name. Each person's card
carries the **consent receipt**: the three agreements the form records in
`kyc_consents` (accuracy, terms, processing), in the words the person was
shown, with when each was last given, and any not given named in rose. A
failed read of the receipt says so rather than "none recorded"
(`getKycQueue` in `lib/admin/kyc-queries.ts`).

**Two more controls on a person's card.** A form records a LASRERA or ESVARBON
entry checked by hand on the public register, with the name the register shows;
it is optional for the lister, never a gate, and only dates a fact the desk
checked. There is no CAC option, because the free CAC search shows a company and
not its directors. Beneath the person, their internal notes (section 0).

**The render draws a "match score" and "provider performance" (NIMC, BVN,
Bank, Selfie). Nothing records a provider or a score**, so the desk shows rungs
passed and results per rung instead, which are real.

## 7. Support

**Support staff (29 September):** the desk was rebuilt as a support agent's
workspace (lanes, the four-hour and one-day clocks, saved replies, hand-off to
money, safety or verification, member summary, ticket audit trail, keys), and
Settings > Staff gained a Support team panel. How to add a support person,
what they can and cannot see, and the SLA rules: [`docs/SUPPORT_STAFF.md`](/docs/SUPPORT_STAFF.md).
Some of what follows describes the earlier layout. The desk opens on seven
lanes: All open, New, Waiting on us, Waiting on member, Escalated, Mine and Done
(each with its count, Done without one), four tiles above them (Late, Due in 4
hours, With the member, Escalated), and a find-a-ticket box by reference or
email. An open ticket shows The member, Internal notes and What happened on this
ticket, with the thread, the escalations and a reply box.

**Where:** `/admin/support`. Tickets filed from the contact form and by the
assistant when it cannot answer. Search by reference or email, filter by
status and date, page forty at a time. Open a ticket to read who filed it and
the thread, reply (`replySupportTicket`; the database tells the person), and
change its status (`setTicketStatus`). A ticket about being asked to pay
outside Vallo carries the four-hour commitment rather than the ordinary day.

An open ticket also shows (`lib/admin/support-desk.ts`):

- **The clock from the member's unanswered message.** The row's chip counts
  from filing; the open ticket's counts from the first message the member
  sent after our last reply, and reads "We answered last" when we did
  (`waitingSince`, `lib/admin/support-rules.ts`). "Waiting on us since" gives
  the time.
- **Who has it.** Take it / Hand it back, the same claim the unified queue
  uses (`queue_take` / `queue_release`, kind `ticket`, audited as
  `queue.take` / `queue.release`), under the support scope, so a
  support-only staff member can take their own tickets. A claim lapses after
  thirty minutes untouched.
- **Who replied.** Each staff reply names the colleague who wrote it (staff
  side only; the member still reads "Vallo support").
- **Other tickets** from the same account, and for an admin a link to the
  member file.

A ticket opened by link (`/admin/support?ticket=<id>`: from a notification,
the member file or a colleague) opens even when it is not on the page of the
queue on screen; an unknown id says so.
A support ticket is also a row of the Unified queue (section 15.1), where it
can be taken, handed on or, if it reads as not a person, closed in bulk.

## 8. Money

**Route:** `/admin/money`. **Who:** the `finance` scope, which an admin holds
(`requireAdmin("finance")` in the page; a person without it sees "Your account
cannot open this desk."). This desk was rebuilt after custody ended (Track A):
there is no wallet, float, withdrawal or escrow on it. The money rules and the
reads behind each panel belong to Session 2 and live in
`docs/MONEY_ARCHITECTURE.md`, `lib/admin/reads/` and `lib/admin/*-actions.ts`;
this section says what each panel shows and which control it carries.

**What it is for.** The page head says it: watch the Guarantee, refunds to the
card and the reconciliation job. It is one page with seven sections, reached from
the desk's section strip (section 2) or by address (`/admin/money#caution`).

| Section | What it shows | Source |
|---|---|---|
| The Vallo Guarantee (`#guarantee`) | A statement on a document sheet: the figure in the reserve, "Contributions less approved claims", the rows Contributed and Paid out, and a note with the contribution share and the claim window as the read returns them. If the read fails it says so | `readGuaranteeDesk` in `lib/admin/reads/agreements.ts`, asked as the operator because the reserve's figures decide on `auth.uid()` |
| Claims (`#claims`, under the statement) | Each claim on the Guarantee: listing, claimant, status, the amount asked, the amount approved, the items it cites, the number of new evidence files, the bank reference once paid, the description and the decision reason. A submitted claim carries an amount field, a reason field and two slides, Slide to approve this claim and Slide to reject this claim (reject is enabled once the reason is ten characters). An approved claim carries a bank transfer reference field and Slide to mark it paid (enabled once the reference is four characters) | `decideClaim` and `markClaimPaid` in `lib/admin/agreements-actions.ts`; the database decides what amount it accepts |
| Cautions (`#caution`) | A note that Vallo never holds a caution and rules on the record of one, then two kinds of ruling. A disputed deduction shows the item, the amount proposed of the caution, the lister's note, a link to the tenancy file (both sides' reports) and the photo if there is one; its controls are the amount that stands (0 allows none), a reason both parties read (ten characters) and Slide to rule. A contested return shows the amount recorded as returned, the date, the method, the reference, the tenant's note and a link to the tenancy file; its controls are a reason and two slides, received and not received | `readCautionDesk` in `lib/admin/reads/caution-desk.ts`; `ruleCautionDispute` and `ruleCautionReturn` in `lib/admin/caution-desk-actions.ts` |
| Refunds (`#refunds`) | The refund record, on a document sheet: the total returned, how many were not credited, and a ledger of every refund decided, with when, the guest, the listing, the reason, the reference in full, an Open stay link, the amount (and what was kept) and a state with a word and a shape: filled circle for back at the card, hollow circle for not yet sent, filled square for refused, a bar for nothing owed. It has no control: a stay's refund is made on the stay's own page. The bar's search narrows it (`?q=`), and `?from=` and `?to=` narrow it by date | `getRefundConsole` in `lib/admin/money-queries.ts` (Session A's) |
| Reconciliation (`#reconciliation`) | A check plate and a badge: Healthy, Needs a person, Gone quiet (no run for longer than the 3 hour allowance in `lib/cron/freshness.ts`) or No runs recorded, with the last run and how many recorded runs were clean | `getReconciliationHealth()` in `lib/admin/reads/money.ts`, the `wallet.reconciliation.run` rows in `audit_log` |
| Tenancy charges (`#rent`) | Drawn only when its read worked: how many move-in charges have been opened, with the note that the latest are listed on each tenancy | `getRentCharges()` in `lib/admin/reads/money.ts` |
| Refund clock (`#refund-clock`) | Two lists, "Refunds past their due date" and "Refunds due within 24 hours". Each row is the amount, linked to the stay in Bookings, the kind (Guest asked, paid; Decided, not yet sent to Paystack; With Paystack, not yet on the card; Flatmate's share, not yet sent to Paystack; Flatmate's share, with Paystack; Owed by the lister) and the due date. A guest's request carries Decline, with the reason the guest reads. A failed read says it could not be read | `readRefundClockBoard` in `lib/after-gate/refunds.ts` |
| Payments and refunds (`#history`) | A ledger on a document sheet, platform-wide, read as the caller. First the totals: Paid by renters and guests, Settled to listers, To the Guarantee reserve, Vallo commission, Refunded (processed) and Payments. Then the latest fifty payments and refunds, each with its kind, listing, payer and payee, amount and a state. Under the sheet, Download CSV | `readAdminMoneyHistory` in `lib/money/history.ts`, from `admin_money_summary` and `admin_money_history`; the CSV is `/admin/money/export` |

**Actions on this desk.** Three, each Session A's or Session 2's and unchanged:
approve, reject or mark paid a Guarantee claim, rule on a caution, and decline a
guest's refund request on the refund clock. Every ruling is a slide (section 2).
Reading the desk needs the `finance` scope. Each ruling is checked again in
its own action: a claim or a caution ruling needs the `guarantee` scope
(`lib/admin/agreements-actions.ts`, `lib/admin/caution-desk-actions.ts`), and an
admin holds both. The Download CSV link is a plain link and not a prefetched
one, because opening it writes an audit row.

## 9. Agreements, and the retired Escrow desk

**Escrow.** There is no Escrow desk. `/admin/escrow` and everything under it
redirects to `/admin/agreements`, and `/escrow` to `/agreements`
(`next.config.ts`), because Vallo holds no escrow. The rail has no Escrow row;
Agreements takes its place as the review gate between an agreement and payment.

**Route:** `/admin/agreements`. **Who:** the `agreements` scope, which an admin
holds. A person who holds only the `guarantee` scope sees a page headed
"Guarantee claims" with the claims panel and nothing else, and a person with
neither sees "Your account cannot open this desk." Where the gate's rules live:
`readAgreementQueue` in `lib/admin/reads/agreements.ts`, `decideAgreement` in
`lib/admin/agreements-actions.ts`, and the `deal_agreement_events` and
`audit_log` records the database writes (Session 2's).

| Panel | What it shows | Source |
|---|---|---|
| Waiting for review (N) | One row per agreement. The listing, linked to its subject, with a Rental or Stay tag and, on a rental with no mandate behind it, a "No mandate on file" tag. Then renter and owner, the amount, the move-in or check-in date and the end date, the keys date where it differs, the number of inspection photos, the terms version, how long it has waited and the members' notes. Approve is one tap. Reject opens a reason field on the same row, with four common reasons as chips, a Send back button (enabled once the reason is ten characters) and Cancel. A decided row says what happened ("Approved. Both parties told; payment is open." or "Sent back. Both parties told with your reason."). Tab moves between a row's controls, and Enter in the reason field sends it | `readAgreementQueue` |
| Recently decided | The decided agreements, each with the parties, the amount and its status or, for a rejection, the reason it was sent back with | same |
| Guarantee claims (`#claims`) | For a person who holds the `guarantee` scope without being an admin: the same claim controls as on Money (section 8). An admin decides claims on the Money desk | `readGuaranteeDesk` |

**What this desk cannot do.** Change an amount, a date or the terms, or open an
agreement. A rejection's reason is read by both parties, so it must be written;
the page head says so.

## 10. Supply

**Route:** `/admin/supply` (new). **Who:** `admin` or `super_admin`.

**What it is for.** Knowing who supplies the platform: how many owners,
agents, firms and hosts, who is verified, what each one lists and what has
been paid to them, and where the supply is.

**The four roles,** exactly as the product's workspace switch resolves them
(`lib/supply/workspaces-queries.ts`): an `agents` row is an Owner or an Agent
by its application's `supply_role`, falling back to the agent type; a
`businesses` row is a Firm when its kind is `agency` and a Host otherwise.

**Examples are not supply.** Every listing, accommodation, agent and business
on the platform on 22 September carried `is_demo`. They are left out of every
figure by default and the page says how many were left out. The "Examples
left out" control (`?examples=1`) puts them back in and the control then reads
"Including examples", so a screenshot can never pass an example off as real
supply.

| Panel | What it shows | Source |
|---|---|---|
| Owners, Agents, Firms, Hosts | Accounts in each role, and the change against the count a week ago (from join dates). Each card is a link that narrows the table to that role | `getSupplyDesk()` in `lib/admin/reads/supply.ts` |
| Supply by role | Name, role, live listings (for a host, live accommodations; for a firm, the listings of its agent account), verified (a tick and the word Yes, or a cross and No), total transacted (escrow released to the account plus confirmed and completed bookings on its live listings), and the month it joined. Newest first, numbered pages of 8 | `getSupplyDesk()` over `agents`, `agent_applications`, `businesses`, `listings`, `accommodations`, `escrows`, `bookings` |
| Supply growth by role | How many accounts in each role had joined by the end of each of the last six months. Four series on one blue ramp, told apart by dash pattern and a name at the end of each line, never by colour alone. Hover a month for all four figures | `getSupplyDesk().growth` |
| Top 5 areas by supply | Live listings plus live accommodations by area (city where no area is given), ranked | `getSupplyDesk().topAreas` |
| Supply by property type | Live listings by property type, on the blue ramp, with share and count | `getSupplyDesk().byPropertyType` |
| Firm rosters | Who works at which firm (`firm_members`): exact counts of memberships Pending, Active and Revoked on one status bar with words, then each firm's roster under its name (firms with someone pending first): agent, Principal or Staff, the state, and the day admitted, or the day revoked with the revocation note. Members of example firms are left out unless examples are asked for, and the count left out is printed. With no member it keeps its bar and table head and says how a member is admitted | `getFirmRosters()` in `lib/admin/reads/supply.ts`, under `firm_members_staff_all` (select only), firm names from `businesses`, agent names from `agents` |

**Actions.** None. The desk reads; approving supply is on the Agent
applications and Businesses desks. Admitting or revoking a firm member is
`private.admit_firm_member` and `private.revoke_firm_member`, each of which
writes an audit row; no console control calls them yet.

**Today's reality.** With examples left out, every figure is zero: there is
no real supply yet, and the desk says so on every panel. `firm_members` holds
no rows, so the rosters panel reads 0 pending, 0 active, 0 revoked.

## 11. Bookings

**Route:** `/admin/bookings` (the stays desk), `/admin/bookings/[bookingId]`
(one stay), `/admin/bookings/reservations` (restaurant tables) and
`/admin/bookings/visits` (the visit calendar, section 11.1). **Who:**
`admin` or `super_admin`; every read repeats `requireAdmin()` and goes
through the admin's RLS client (`bookings_admin_all`, `listings_admin_all`,
`transactions_admin_select`, `booking_refunds_select_admin`,
`profiles_select_admin`).

| Panel | What it shows | Source |
|---|---|---|
| Requested | Stays in PENDING: asked for, not yet answered by the host. The card is a link that narrows the table to them | `getBookingsDesk()` in `lib/admin/reads/bookings.ts`, every `bookings` row |
| Confirmed | Stays in CONFIRMED | same |
| In stay now | CONFIRMED stays where today (Lagos) is on or after check-in and before check-out | same |
| Cancelled | Stays in CANCELLED, whoever cancelled | same |
| Refunded | Stays with a refund of more than nothing recorded in `booking_refunds` | same |
| Stays booked per day | Stays created each Lagos day for thirty days. Drawn only once two days have bookings; before that the frame stays and a calm note says what will fill it | same |
| By status | One bar on the status four: Requested (cyan), Confirmed (blue), Completed (emerald), Cancelled or no-show (rose), each with its word and count | same |
| Filter | Search a listing title, a guest's name or a booking id; a chip per booking status; a Lagos date range on when the stay was booked | `QueueFilters`, URL `q`, `status`, `from`, `to` |
| Stays | Every stay, newest first: the listing and where it is, the guest, the dates and nights, the status and any refund, what has been paid (successful `transactions`), and the total. Numbered pages of 12. Each title opens the stay | `getBookingsDesk()` |
| Restaurant tables | The link to the reservations queue with how many are waiting on the restaurant | `getReservationWaitingCount()` (Session A) |

**The one write, on a stay's own page.** Cancel and refund: the operator
chooses only the reason; the amount comes from the published cancellation
schedule (`previewCancellation`), and `cancelBookingAsAdmin` calls
`refund_and_cancel_booking`, which cancels, writes the refund to the guest's
wallet and records a `booking_refunds` row that the money desk's Refunds
panel then tracks. Reservations are accepted or declined with
`decideReservationAsAdmin`, which notifies the guest. All three are Session
A's, unchanged.

**Who may do what.** Reading the desk needs `admin` or `super_admin`
(`requireAdmin()` in the layout and again inside `getBookingsDesk`; the
tables publish their rows to those two roles by policy). Cancelling a stay
needs the same role; `cancelBookingAsAdmin` repeats the check at its own
door and the database function repeats it again. Nobody can change a price,
a date or a guest from the console.

**What it cannot do.** It cannot move a stay's dates, change what a guest
paid, pay a host, or refund outside the published schedule. "Checked in" is
not recorded by the product, so "In stay now" is worked out from the dates of
a confirmed stay, not from anybody arriving. Reservations have their own
queue and are not counted in these cards.

**Today's reality.** No stay and no reservation has ever been made; every
card reads 0 and every panel says what will fill it.

**One stay's page** (`/admin/bookings/<id>`) heads with the listing's title and
chips for what was paid and refunded, then the acting-for answer for the stay
(who the lister was acting for, staff only, with the lookup audited), the Stay and
People sections, the payment record on a document sheet (the price lines, what
settled, what was returned, each payment and each refund), the Cancel and refund
control, and the stay's history, folded (section 2).

**Hotel rooms (ROOM BOOKINGS 1, 29 September 2026).** A booking can now be
for a hotel room instead of a listing: `accommodation_id`, `room_type_id`,
`rate_plan_id` and `rooms` are set and `listing_id` is null. The desk shows it
under the hotel's name and area and links to the hotel's page (the guest's
own trip and checkout also name the room and how many). The host (the business owner) answers it on Host > Room
bookings; its agreement reaches Money > Agreements like any stay. Nothing is
bookable until `room_bookings` is on in Settings > Switches. The whole flow,
the host's payout and how to switch it on are in
[ROOM_CHECKOUT.md](ROOM_CHECKOUT.md).

### 11.1 Visits (Bookings > Visits, `/admin/bookings/visits`)

Visit ops, 13 October 2026. Every inspection request on the platform as a
calendar, on the Lagos day it is for: the agreed time, or the time the renter
asked for until one is agreed. Reached from the rail (a child of Bookings),
from the Bookings desk's head ("Visit calendar") and from Operations > In
flight's newest requests panel.

**Route:** `/admin/bookings/visits`. The whole desk is its address: `view`
(`week`, the default, or `month`), `day` (the Lagos day it is anchored on and
the day listed), `state`, `mode`, `city`, `lister` and `visit` (the one open).
**Who:** `admin`, `super_admin`, or a staff member holding the `operations`
scope (it is among that scope's desks in the staff frame). The page calls
`requireAdmin("operations")` before anything is read and answers anybody else
with the site's ordinary 404, as Provider checks does. **Reads:**
`lib/admin/reads/visits.ts` through `adminReader("operations")`
(`inspection_requests_select_admin`, `profiles` and `listings` admin reads,
`inspection_no_shows_select_admin`, and `viewing_reminders_select_admin` once
the pending migration is applied); the pure half (the address, the filters,
the counts, the history) is `visits-model.ts`.

| Panel | What it shows | Source |
|---|---|---|
| Filters | State (Requested, Proposed, Confirmed, Done, Missed), visit mode (In person, Video call), city and lister, as a plain GET form; the city and lister choices list everything in the range | `getVisitCalendar()`, URL `state`, `mode`, `city`, `lister` |
| Week | Seven day buttons, Monday first, each with its count, then every day of the week listed with its visits | same, `groupByDay` in `lib/visit-calendar/model.ts` |
| Month | The month as whole weeks with the count on each day; the picked day listed under it | same, `monthGrid` |
| A visit row | The Lagos time ("asked for" while nobody has agreed one), the visit mode as a glyph, the renter and the lister by display name, the listing and its city, and the state chip | same |
| Visit detail | The state and mode; when it is for; the listing (linked to `/admin/listings/<id>`, with its area and city); the lister and the renter by display name, each linked to their member file (`/admin/people/<id>`); the history from the record's own timestamps (requested, answered, confirmed, recorded as done, and a no-show's report, dispute and decision); the reminders sent, each with its stage, its audience and when; and any no-show with who is said to have stayed away and how it was decided | `getVisitDetail()`: `viewing_reminders`, `inspection_no_shows` |

**What it does not read.** No email, phone or address of anybody, no message,
no note a member wrote (the request's note, the lister's note and a no-show's
dispute note are left out on purpose), and nothing from the account record but
the display name. `visits.test.ts` holds the selected columns to that.

**What it cannot do.** Anything. It is read only, with the read-only line under
its head; a no-show is decided on Operations > In flight, as before. A range
holding more than 5,000 visits is refused with a line saying so rather than
drawn as a part.

**Today's reality.** No inspection request has ever been made, so both views
say what will fill them. Until the pending migration
`visit_reminders_both_sides.sql` is applied, the detail says the reminders
cannot be read from the console yet (the ledger has no admin read policy).

### 11.2 Referrals (Money > Referrals, `/admin/referrals`)

13 October 2026. The desk over the referral admin functions built on 6 October
(`admin_referral_liability`, `_budget_set`, `_decide`, `_clusters`,
`_cluster_exposure`, `_graph`, `admin_rewards_payout_decide`). **Who:**
`admin` or `super_admin` only (`requireAdmin()`; anybody else gets the 404):
the functions check `is_staff()` from the caller's own session and are not
granted to the service role, so a staff scope cannot use them. The rail badge
(on the desk and on Money) is `referrals + payouts` waiting on a decision.

| Part | What it shows or does | Source |
|---|---|---|
| Top row | Rewards owed (the ledger total, said to be a debt and not money held), budget committed against the month's cap with the set-budget control (confirm sheet, reason of 12+ characters, this month or next), referrals by outcome (qualified, pending, reversed) | `admin_referral_liability`, `referral_programme_status`, counts of `referrals` by status |
| Live campaign | The live campaign's reward, per-member cap, review period and what an invited person must do (`signup-80-phone`: confirm their phone number, accept the terms and set a first name); earlier and draft campaigns below | `referral_campaigns` |
| Review queue | Referrals with status `under_review`: who invited whom, reward, risk score and reasons in words, why it was sent, the inviter's group score and exposure; Approve or Reject with a required reason (8+ characters) | `referrals`, `admin_referral_cluster_exposure`, `admin_referral_decide` |
| Fraud view | Groups ranked by naira exposure with the signals their invited people share (browser and network masked), and a left to right graph of who invited whom (plain SVG, loop lines dashed, every invitation also listed) | `admin_referral_cluster_exposure`, `admin_referral_clusters`, `admin_referral_graph` |
| Payouts | Payouts `under_review`: Release or Refuse with a reason; payouts with the payout partner, and a never-sent decision once one has been open a day | `rewards_payouts`, `admin_rewards_payout_decide` |

**How rewards are paid.** Paystack, the payout partner, sends each payout from
Vallo's own marketing funds to the member's bank account; Vallo holds nobody's
money, and a payout counts as paid only when Paystack's signed webhook confirms
it. Release puts a payout back in the partner's send queue; it does not call the
partner. There is no separate hold action: a payout waiting in the queue is held
and nothing is sent while it waits.

**Reads.** The queue tables (`referrals`, `rewards_payouts`,
`referral_campaigns`, `referral_budget_periods`) are readable by `service_role`
alone, so the lists are read on the service client after `requireAdmin()`
passes in the same function (`lib/admin/reads/referrals.ts`), selecting only
what the desk shows: display names, the bank-returned account name and last four
digits, no email, phone, recipient code or network address. An unreadable read
is drawn as unreadable, never as zero.

## 12. Payments

**Route:** `/admin/payments`. **Who:** `admin` or `super_admin`.

**Two kinds of payment attempt:** a booking checkout (one `transactions`
row) and a wallet top-up (a `wallet_entries` row of kind `deposit`, whose
`metadata.channel` records the Paystack channel). **Five outcomes, from each
row's own status:** Succeeded (SUCCESSFUL or COMPLETED), Failed (FAILED or
REVERSED), Refunded (REFUNDED), Started (PENDING and less than 24 hours old)
and Abandoned (PENDING and older: the person began and did not finish; the
reconcile job settles any that did).

| Panel | What it shows | Source |
|---|---|---|
| Started, Succeeded, Failed, Abandoned | Attempts begun in the last 7 days by outcome, against the 7 days before (a change is drawn only when the earlier week had some) | `getPaymentsDesk()` in `lib/admin/reads/payments.ts`, every attempt |
| Money in per day | The value of attempts that succeeded, per Lagos day, thirty days. Drawn only once two days have some | same |
| By channel | Attempts in thirty days by channel (card, bank, USSD and so on; "unrecorded" where the row does not say), and the value that came in on each | same |
| Where payments ended | One bar on the status four with a word on every segment wide enough and a key naming all five with their counts | same |
| Every payment | Every attempt, newest first: when it started, the provider reference in full, the kind (a checkout links to its stay), the channel, the outcome and the amount. Narrow by outcome and by kind; numbered pages of 12 | same |
| Health | Money frozen by stuck holds and money waiting on the provider; the stuck withdrawal holds with the release control, and payments the provider has not settled. The overdrawn-wallets table and its shortfall figure were removed with custody (`admin_payment_health` still returns an always-empty `overdrawn`) | `getPaymentHealth()` (Session A), calling `public.admin_payment_health` |
| Look up a person | Saved cards and bank accounts (masked) and their terms standing, with removal | `findAdminSubject`, `getSavedMethods`, `getTermsStanding` (Session A) |
| Which Paystack | A line under the heading saying which Paystack account this deployment is talking to, so a sandbox deployment is never mistaken for the live one | `currentPaystack()`, read only |
| Acting for | A `?acting=` lookup that answers, for a transaction, who the lister was acting for (staff only, audited) | `ActingFor`, SCUML item 17 |

**Actions, all Session A's, unchanged.** Release stuck holds
(`expireStaleWithdrawalHolds`, calling `admin_expire_stale_withdrawal_holds`)
returns withdrawal holds older than the window to spendable balance. Removing
a saved method (`removePaymentMethodAsAdmin`, `removeBankAccountAsAdmin`)
notifies its owner.

**Who may do what.** Reading needs `admin` or `super_admin`; the payment
reads, the health RPC (`admin_payment_health`, security definer, repeats the
role check) and both actions check the role themselves. No one can create,
retry or refund a payment from this desk.

**What it cannot do.** It cannot re-ask the provider (that is the reconcile
job's decision, hourly), cannot see a checkout's channel (only top-ups record
one), and cannot see the provider's own abandoned status: "Abandoned" here is
a PENDING attempt older than 24 hours, which the handbook states rather than
the screen implying Paystack said so.

**Today's reality.** One top-up has ever succeeded (₦1,000 by bank, 9
August); no booking checkout has been attempted; nothing is stuck.

## 13. Operations: scheduled jobs, alerts, audit log, notifications

Drawn from the render `01F7DFC7`, panel two. `/admin/operations`, with six
tabs in the address (Jobs by default, then `?tab=alerts`, `?tab=audit`,
`?tab=notifications`, `?tab=inflight` and `?tab=store`) and a seventh link, Field
speed (section 15.21). The desk's sections strip is in section 2.
Reads: `lib/admin/reads/operations.ts` (`getJobHealth`, `getRunDays`,
`getAlertTrend`) and the existing `getRiskAlerts`, `getAuditLog` and
`getAuditActivity`. Nothing on this desk changes anything; it reads.

**Jobs healthy.** How many of the Vercel Cron jobs (all of `VERCEL_JOBS`) are on schedule and
did not fail on their last run, with the share in words and a line of the
scheduled runs that did not fail per day for fourteen days.

**Active alerts.** Open rows in `risk_alerts`, against how many were open a
week ago (an alert was open then if it had been raised by then and was not yet
resolved; both are exact counts from the alerts' own dates). Fewer is good, so
a fall is emerald. The line is alerts raised per day.

**Every scheduled job.** The platform has two schedulers.

| Job | Scheduler | When (Lagos) | Allowed silence | What it does |
|---|---|---|---|---|
| canary | Vercel Cron `*/5 * * * *` | every 5 min | 1 h | reads the published catalogue as the public role against the service role's count, and pages a person when it is refused, short or empty (`lib/ops/catalogue-canary.ts`) |
| email-outbox | Vercel Cron `*/15 * * * *` | every 15 min | 2 h | sends the queued emails in `email_outbox` |
| crypto-reconcile | Vercel Cron `3,18,33,48 * * * *` | every 15 min | 2 h | re-reads open crypto payments from the provider and applies any report the webhook missed; off until the crypto flag is on (`lib/crypto/reconcile.ts`) |
| arrangements-reconcile | Vercel Cron `8,18,28,38,48,58 * * * *` | every 10 min | 2 h | re-reads escrow arrangements still waiting on the payment partner (preparing, unknown, payment processing, release asked, disputed), at most 3 a run, and records what the partner says; never gated by the escrow switch (`lib/money/provider-arrangements.ts`) |
| hold-sweep | Vercel Cron `5 * * * *` | hourly at :05 | 3 h | releases booking holds past their window and closes stale card attempts |
| rent-share-refunds | Vercel Cron `35 * * * *` | hourly at :35 | 2 h | asks Paystack for the card refunds of flatmate shares whose split was cancelled or fell short, and records each answer (`lib/cron/jobs/rent-share-refunds.ts`) |
| paystack-reconcile | Vercel Cron `10 * * * *` | hourly at :10 | 3 h | matches Paystack charges to the ledger |
| pg-cron-watch | Vercel Cron `20 * * * *` | hourly at :20 | 3 h | watches the database's own jobs and raises failures |
| complete-stays | Vercel Cron `30 2 * * *` | daily 03:30 | 26 h | completes stays whose check-out has passed |
| inventory-drift | Vercel Cron `45 2 * * *` | daily 03:45 | 26 h | checks room inventory against bookings |
| account-purge | Vercel Cron `15 3 * * *` | daily 04:15 | 26 h | honours account deletions after thirty days |
| saved-search-alerts | Vercel Cron `40 7 * * *` | daily 08:40 | 26 h | tells people about new matches for saved searches |
| new-match-alerts | Vercel Cron `0,5,10,15,20,25,30,35,45,50,55 * * * *` | every 5 min except :40, so it never runs beside the 07:40 digest | 2 h | tells people within minutes about a listing just published, three times a day at most; the rest wait for the morning digest (V-15) |
| store-readiness | Vercel Cron `0 5 * * *` | daily 06:00 | 26 h | runs the Store tab's checks against production and raises an alert when one is red (V-52) |
| landlord-line | Vercel Cron `*/15 * * * *` | every 15 min | 2 h | asks consenting landlords whether the flat is still free and shows them the rent paid (V-31, V-32); a no-op while `landlord_line` is off |
| sanctions-lists | Vercel Cron `10 5 * * *` | daily 06:10 | 26 h | loads the UN and Nigeria sanctions lists from their configured URLs when they changed; a new version re-screens everyone (SCUML items 8, 9); a no-op with no URL set |
| sanctions-screen | Vercel Cron `7,22,37,52 * * * *` | every 15 min | 2 h | screens the people and transactions the triggers queued against the lists in force and raises matches on the compliance desk (SCUML item 8) |
| risk-classes | Vercel Cron `50 3 * * *` | daily 04:50 | 26 h | classifies every customer high, medium or low risk, dated, from the documented factors (SCUML item 15) |
| calendar-sync | Vercel Cron `2,17,32,47 * * * *` | every 15 min | 2 h | pulls the Airbnb, Booking.com and other calendars hosts linked on `/host/calendar` and holds those nights on Vallo (C2, `lib/cron/jobs/calendar-sync.ts`); a no-op while `CALENDAR_SYNC_ENABLED` is off |
| reservation-deposit-refunds | Vercel Cron `40 * * * *` | hourly at :40 | 2 h | D75: sends the restaurant table deposit refunds the restaurant's rule decided back to the card, once each, and closes deposit checkouts nobody paid within two hours (`lib/cron/jobs/reservation-deposit-refunds.ts`); a no-op while `restaurant_deposits` is off and nothing is due |
| calls-sweep | Vercel Cron `*/5 * * * *` | every 5 min | 1 h | VC1: runs the calls deadline sweep and deletes the provider room of every finished call, so an old token cannot sit in it and nothing keeps metering (`lib/cron/jobs/calls-sweep.ts`); skipped while `video_calls` is off |
| vallo_push_drain | pg_cron `*/5 * * * *` | every 5 min | | asks the app to drain the push queue (`private.request_push_drain`) |
| vallo_safety_share_sweep | pg_cron `*/10 * * * *` | every 10 min | | reminds a renter once when half an hour has passed since they expected to be back from an inspection they shared and they have not tapped I'm done (V-62) |
| vallo_release_stale_holds | pg_cron `*/15 * * * *` | every 15 min | | database side of the hold release |
| vallo_remind_hosts_to_decide | pg_cron `4,19,34,49 * * * *` | every 15 min | | reminds a host once, in the app and by push, when a room or table request has used three quarters of its window (C3, `private.remind_hosts_to_decide`) |
| vallo_send_reservation_reminders | pg_cron `1,16,31,46 * * * *` | every 15 min | | reminds a diner once the evening before (from 7pm Lagos) and once two hours before a confirmed restaurant table, recorded in `reservation_reminders` so none is sent twice (RESTAURANT-02, `private.send_reservation_reminders`) |
| vallo_ask_diners_unmarked_tables | pg_cron `17 * * * *` | hourly at :17 | | asks a diner "Did you dine at X?" about a confirmed restaurant table the restaurant never marked after 24 hours (`private.ask_diners_about_unmarked_tables`) |
| vallo_send_member_reminders | pg_cron `7,22,37,52 * * * *` | every 15 min | | sends each viewing reminder (7pm the evening before, two hours before; a third, 8am on the day; every message says the visit mode) to the renter and the lister, recorded in `viewing_reminders` (Bookings > Visits shows them), and each rent-due reminder (180, 90, 30 and 7 days) once, through the booking notifications (B5, B10, `private.send_member_reminders`) |
| vallo_purge_rate_limits | pg_cron `30 * * * *` | hourly at :30 | | clears old rate limit rows |
| vallo_purge_view_marks | pg_cron `41 * * * *` | hourly at :41 | | forgets the day's listing view marks and salt once the day ends (V-73) |
| vallo_alert_overdue_refunds | pg_cron `12 * * * *` | hourly at :12 | | alerts on refunds past their due-by date (V-24) |
| vallo_hold_claims_sweep | pg_cron `* * * * *` | every minute | | recomputes every person with a live compliance hold claim, so pending STR and sanctions claims take over within a minute of a "this was not me" hold ending; skips and cleans up deleted accounts (`private.hold_claims_sweep`, SCUML items 6 and 8) |
| vallo_calls_sweep | pg_cron `* * * * *` | every minute | | VC1: applies every call deadline and writes missed-call notices (`private.calls_sweep`) |
| vallo_referral_qualify | pg_cron `3,18,33,48 * * * *` | every 15 min | | D85: retries qualification for invited members who finished a step (`public.referral_qualify_pending`) |
| vallo_referral_flag_clusters | pg_cron `26 * * * *` | hourly at :26 | | D85: flags referral clusters that look like one person (`public.referral_flag_clusters`) |
| vallo_referral_release_due | pg_cron `11,41 * * * *` | every 30 min | | D85: makes a referral reward available once its review window has passed (`public.referral_release_due`) |
| vallo_subscriptions_sweep | pg_cron `9,24,39,54 * * * *` | every 15 min | | Pro and Business subscriptions follow the clock: trials end, lapsed and cancelled plans close, unpaid checkouts are abandoned (`private.subscriptions_sweep`) |
| vallo_str_nudge_overdue | pg_cron `17 * * * *` | hourly at :17 | | reminds staff of a Suspicious Transaction Report case past its clock, once a day per case (`private.str_nudge_overdue`, SCUML item 6) |
| vallo_reconcile_payments | pg_cron `47 * * * *` | hourly at :47 | | database side of reconciliation |
| vallo_purge_idempotency | pg_cron `10 2 * * *` | daily 03:10 | | clears old idempotency records |
| vallo-nightly-badges | pg_cron `20 2 * * *` | daily 03:20 | | awards earned badges |
| vallo_purge_email_outbox | pg_cron `25 2 * * *` | daily 03:25 | | forgets emails the outbox has already delivered |
| vallo_purge_web_vitals | pg_cron `35 2 * * *` | daily 03:35 | | deletes field speed figures older than 30 days (V-80) |
| vallo_photo_hash_backfill | pg_cron `5 2 * * *` | daily 03:05 | | asks the app to hash listing photos uploaded before hashing existed, so the duplicate-photo signal works (C8) |
| vallo_purge_job_runs | pg_cron `55 2 * * *` | daily 03:55 | | forgets counted scheduled runs older than 90 days (C7) |
| vallo_purge_money_step_ups | pg_cron `45 2 * * *` | daily 03:45 | | forgets used money-lock challenges and proofs after a day (V-81) |
| vallo_purge_funnel_events | pg_cron `50 2 * * *` | daily 03:50 | | forgets front door funnel counts (`public.funnel_events`) older than 90 days (A6) |
| vallo_sweep_price_check_events | pg_cron `40 3 * * *` | daily 04:40 | | deletes price check events older than 24 months (the retention schedule, run) |
| vallo_announce_completed_stays | pg_cron `20 5 * * *` | daily 06:20 | | announces completed stays |
| vallo_scuml17_mandate_grace_sweep | pg_cron `25 5 * * *` | daily 06:25 | | SCUML item 17: after the grace date, takes down agent and firm listings without a current mandate and tells the agent why |
| vallo_scuml17_mandate_expiry_reminders | pg_cron `30 5 * * *` | daily 06:30 | | SCUML item 17: tells an agent 30 days and again 7 days before a mandate runs out, once each, unless a renewal is already waiting |
| vallo_scuml17_purge_stale_mandates | pg_cron `35 5 * * *` | daily 06:35 | | SCUML item 17: deletes waiting or refused mandates of listings that never went live, five years after they were last touched |
| vallo_sweep_price_check_watches | pg_cron `50 5 * * *` | daily 06:50 | | re-runs the price check gate at each pending watch and tells the watcher once when it opens |
| vallo_send_followup_reminders | pg_cron `13 7,8,9,10,11,12 * * *` | hourly at :13, 08:13 to 13:13 | | tells a lister once, from 08:00 on the day, that it is the follow-up date they set on an enquiry thread; never for a date already past, or a thread marked Let or Lost (AGENT-01, `private.send_followup_reminders`) |
| vallo_landlord_not_reconfirmed | pg_cron `35 4 * * *` | daily 05:35 | | marks a listing Not reconfirmed after a delivered owner question goes 21 days unanswered, and clears every mark while the line is off (V-31) |
| vallo_owner_heartbeat | pg_cron `15 8 * * *` | daily 09:15 | | asks a lister who says they own the flat, in the app, whether it is still available, once a fortnight (V-31); a no-op while `landlord_line` is off |
| vallo-daily-note | pg_cron `0 6 * * *` | daily 07:00 | | the daily note |
| vallo_remind_caution_due | pg_cron `15 7 * * *` | daily 08:15 | | reminds listers and tenants when a caution is due back (V-36) |
| vallo_remind_renewals | pg_cron `20 7 * * *` | daily 08:20 | | tells tenants and listers a tenancy ends in 90, 60 or 30 days (V-93) |
| vallo_sweep_rent_splits | pg_cron `25 7 * * *` | daily 08:25 | | refunds the paid shares of a flatmate split still short on move-in day, or cancelled (V-86) |
| vallo_threshold_reminders | pg_cron `5 * * * *` | hourly at :05 | | tells staff three days and one day before a threshold report to the NFIU is due (SCUML item 7) |

21 Vercel Cron jobs and 40 pg_cron jobs in all. The numbers are derived,
not remembered: the Vercel list is `VERCEL_JOBS` in
`lib/admin/reads/jobs.ts`, held equal to `vercel.json` by a test, and the
database list is `PG_CRON_JOBS` in the same file, held equal by
`lib/admin/reads/jobs.test.ts` to every `cron.schedule` the migrations leave
in place. The same test holds this table and the sentence above to both
lists, so a new job fails `npm test` (and CI) until it is written down here.

The Vercel jobs' schedules come from `apps/web/vercel.json` (a test fails if
the console's copy drifts from it) and their allowances from `WATCHED_JOBS` in
`lib/cron/freshness.ts`. **Last run, duration and status** come from the
audit row every run writes (`lib/cron/report.ts`: `entity_type = 'cron_job'`,
`action = cron.<job>.<ok|attention|failed>`, `metadata.duration_ms`; the money
reconcile writes `wallet.reconciliation.run` with `metadata.outcome`, and
records no duration). The console reads the newest row per job, so "last run"
is exact however long ago it was. Status: **Healthy** (on time, last run ok),
**Attention** (on time, the run reported something to look at), **Failed**
(the last run failed, solid rose), **Overdue** (silent past its allowance),
**No run yet** (never reported).

The **database jobs** are one summary row until Request A5 lands: the newest
`pg-cron-watch` run's own counts of failures in the last day, how many of
those have since recovered, how many have not run yet and how many are
overdue.

**Alerts tab.** The forty newest alerts. Resolving one happens on the Alerts
desk (`/admin/alerts`), which records who resolved it and when.

**Audit log tab.** Entries per day for thirty days (the read counts up to
5,000 rows and says so if it hits that cap), the kinds of thing recorded,
and the latest entries. Each entry opens the Audit log desk filtered to that
record. The Audit log desk searches by id, by words in the action, by kind
and by date.

**Notifications tab.** Push first, from `push_queue` and `push_deliveries`
(both readable by an admin, `getPushActivity`): the push queue now, by state
(Waiting, Held for quiet hours, Sending, Retrying, Out of attempts, Done);
how pushes settled in the last seven days (Delivered, Push off, No device,
Expired, Summarised, Gave up); device attempts in the last seven days (Sent,
No reply yet, Failed, Device gone) with the newest attempts; and the newest
failures with the provider's status and error. No token or device reference
is shown. Beside them, two panels that cannot be read yet and say so: in-app
notifications by kind (booking, message, wallet, listing, agent, support,
system, social; the table's only read policy is the recipient's own, Request
A6) and the email outbox (row security on, no admin policy, Request A14).

**In flight tab.** Inspections, read by state (Requested, New time
proposed, Confirmed, Completed, Declined, Withdrawn: six exact counts from
`inspection_requests` under the admin read policy, `getInspectionActivity`)
with the eight newest requests. Beside them, panels for account deletions
(Request A12), business transfers (A13), the database's jobs one by one (A5)
and the money reconciliation watch (admin-money's request 10), each saying
what it needs because no admin can read those rows yet.

**Store tab.** Eight of the checks an App Store or Play reviewer runs by hand,
run against the live platform when the tab is opened (against the origin the
request came in on), plus one manual step, native versions, that a server cannot
read. Each check shows a word with a shape and a tone, Ready, Fix or Not run, what
it saw and, when it is not ready, the one thing to do. A summary line counts how
many are ready, how many need fixing and how many could not run, and "Run the
checks again" reopens the tab. The same checks run every night (the
`store-readiness` job) and raise an alert when one turns red. The tab does not
refresh itself, because its checks sign the reviewer account in.

**Recent alerts and Audit log** sit beneath every tab: the four newest alerts
and the five newest audit entries.

## 14. Analytics

Drawn from the render `01F7DFC7`, panel three. `/admin/analytics?range=30d`
(or `90d`, `12m`). Reads: `lib/admin/reads/analytics.ts`
(`getBookingOutcomes`, `getSupplySeries`, `getThinAreas`,
`getPriceCheckDemand`).

**Demand is price checks.** `price_check_events` is the platform's first
demand log: one row per stage of one price check (`submit`, then `outcome`
`answered` or `refused` with a `refusal_code`), located by state, local
government and a five character geohash, never an address. Admins read it
under `price_check_events_admin_read`; rows older than 24 months are swept
daily (`vallo_sweep_price_check_events`). The render's own measure, searches
of the listings, is still not recorded (A7, partly withdrawn), so the page
names its figures as price checks and does not call them searches.

| Panel | Source | State today |
|---|---|---|
| Price checks | `price_check_events` rows at stage `submit` in the range, against the same length of time before it (exact count), with a spark per bucket | real |
| Listing views | nothing records a listing view | Not recorded, Request A8 |
| Successful bookings | exact count of `bookings` confirmed or completed, created in the range, against the same length of time before it | real; zero on 22 September |
| Checks answered | outcomes `answered` over checks submitted in the range | real; a dash while nothing was checked |
| Demand vs supply | price checks submitted per bucket beside listings created per bucket (examples excluded) | real, both series |
| Top areas by price checks | submitted checks grouped by local government (`lga_code`, named from `local_governments`), top five | real |
| Areas with fewest listings | live listings grouped by area and city, fewest first, examples excluded | real; empty while no real listing is live |
| Price checks vs answered | checks submitted and checks answered per bucket | real |
| Top common refusals | the platform's refusals of a price check by `refusal_code`, in words | real; a person's decline of an inspection or reservation still carries no reason (A11) |

**Why listings were sent back.** When any listing was sent back or rejected with
reason codes in the last 30 days, a further panel counts each code, since reason
codes began on 30 September 2026; a review can carry several. It has an entry in
the desk's sections strip.

Every row of the range is read whole (the pager refuses rather than returns a
prefix past 50,000 rows), so no total is capped.

The render also draws an "All areas" filter; it is not built, because the
figures that vary by area already list their areas.

## 15. The other desks

These desks keep their own behaviour and were brought into the console's
register (panel material, page head, status badges, calm empty states)
without changing what they do. Each is reached from its parent row or from
All desks.

**Who may act, on every desk from 15.1 to 15.16.** Any account holding `admin`
or `super_admin` in `user_roles`, or for a queue the staff scope that opens it.
Every action first calls `requireAdmin()` (`lib/admin/guard.ts`) and refuses
anyone else with "This area is for the Vallo operations team"; no action on
these desks is reserved to `super_admin`. The desks from 15.17 on say who may
act on each, and Account recovery and Staff reserve some actions to a super
admin. Where an action goes through a database function, the function
repeats the role check itself. Every action writes one `audit_log` row with
your user id (`lib/admin/audit.ts: writeAudit`), which the Audit log desk
shows. Every list pages forty rows at a time and says when there are more.
Bulk decisions are on the Unified queue only (section 15.1); exports are the
three CSV downloads in section 0.

### 15.1 Unified queue (Overview > Unified queue, `/admin/queue`)

- **Shows** one table across five queues: listings to review, agent
  applications, open reports, open support tickets and open message flags. The
  tabs are All, Listings, Agents, Reports, Support, Flags and Held, each with its
  live count, and a staff member sees only the tabs their scopes open
  (`listing_approval`, `kyc_review`, `moderation`, `support`). The heading counts
  the five queues. The Reports, Flags and Held tabs draw the desk's own working
  view under the same tabs, with every decision control it had (sections 5, 15.7
  and 15.8). Under the table a link to Alerts carries its count.
- **Lanes** (V-89), a second row of chips above the table: Everything, Late, Mine,
  Nobody has it, and Probably not a person (offered on All and Support only). On
  Reports and Flags, Everything is the desk's working view and the other lanes are
  this table narrowed to that kind. Held has no lanes.
- **Rows** waiting on a decision carry the promise they are under: "Due in 5h",
  "Due within the hour" or "Late by 3h" (`lib/trust/standards.ts`), and the table
  is ordered by when it falls due, not by newest; decided rows follow, newest
  first. A report also shows why it is weighted as it is (an attended inspection,
  a confirmed phone, its reporter's record of upheld reports, or "First report from
  this person"). A support ticket from no account that carries a link or a domain
  pitch sits in Probably not a person, off the clock. Only the first forty rows
  show.
- **Owner slot.** Each row waiting on a decision has Take it, which claims it
  (`queue_take`), then shows "Yours" with Let it go. Another operator's live claim
  shows "Taken by" their name. A claim lapses after thirty minutes without work.
- **Batch tray.** Every row has a checkbox (a 44px target). Once one is ticked a
  tray rises with the count and the verbs: Take, Approve, Send back, Hand to and
  Close as not a person. Approve, Send back and Close as not a person open a
  confirmation sheet ("Apply to the selected rows?") first. Send back needs a
  reason chosen in the bulk form (a reviewed sentence for a listing or an
  application), and Hand to needs an operator chosen there; a verb that cannot run
  yet says what it is waiting for and takes you to the field. A select-all
  control and a clear control sit with it. The tray goes inert while the form is
  being sent, so a second tap cannot run the batch twice. The form, "Decide the
  selected rows", is in the page and works without scripts.
- **Saved views.** Name the tab, lane and search you use and save them, optionally
  shared with the desk; your own can be deleted. A view is a link.
- **Sources** the same reads as each desk (`getListingSubmissions`,
  `getAgentApplications`, `getReports`, `getMessageFlags`, `getSupportTickets` in
  `lib/admin/queries.ts`), plus the claims, views and report signals from
  `lib/admin/reads/queue-desk.ts`. The rules are in `lib/admin/queue-desk.ts`.
- **Actions** Take it and Let it go; the five bulk verbs; save and delete a view
  (`lib/admin/queue-desk-actions.ts`). View on a row opens the desk that decides
  it. Open to anyone holding one of the scopes `moderation`, `listing_approval`,
  `kyc_review` or `support`; each per-item action checks its own scope again.
- **Effects** a bulk verb calls the same per-item action the desk uses (Approve is
  the listing's or application's approve, Send back is its request for changes,
  Close as not a person closes the ticket after the server re-checks that it
  reads as one), at most fifty rows at a time, and writes one `queue.bulk` audit
  row per item under one batch id. Take and Hand to write their own rows in the
  database. A verb that does not apply to a kind (approving a ticket) and any row
  another operator holds are skipped and counted. The page then says "N done, N
  did not apply, N did not go through. One batch in the audit log."
- **Limits** money is never in this queue: a refund or a payout is decided one at
  a time, as a slide, on its own desk.
- **Rejected** a bulk write that skips the desk's own guards: every bulk verb is
  the desk's action called N times, never a second path.

### 15.2 Applications (Supply > Applications, `/admin/agents`)

- **Shows** people who asked to list as an owner, agent or firm
  (`agent_applications`), waiting and decided, with each applicant's
  verification ladder (`agent_verification_checks`, via
  `getVerificationLadders`).
- **Actions** Approve, Ask for changes, Reject (`reviewAgentApplication`);
  record a verification rung as passed or failed (`recordVerificationCheck`).
- **Effects** approve: the application goes to `APPROVED`, an `agents` row is
  created or updated with the lister's role and `APPROVED`, the `agent` role is
  granted in `user_roles`, and the applicant is notified. Ask for changes and
  reject move the status and notify with your note. A rung writes
  `agent_verification_checks` and notifies. Audit: `agent_application.review`,
  `agent.verification_check`.
- **Limits** an application already decided cannot be decided again; the role
  grant uses the service role because `user_roles` is super-admin-only under
  RLS, and only after the admin check has passed.
- **Rejected** approving without the ladder visible: the rungs sit beside the
  decision so an approval is never blind.

### 15.3 Businesses (Supply > Businesses, `/admin/businesses`)

- **Shows** hotels, restaurants and other businesses (`businesses`) with
  their documents (`business_documents`), their verification ladder
  (`business_verification_checks`: identity, registration, payout, on site)
  and their properties, filterable by status.
- **Actions** Approve, Ask for more, Reject (`approveBusiness`,
  `requestMoreInfo`, `rejectBusiness`); record each rung
  (`recordIdentityCheck`, `recordRegistrationCheck`, `recordPayoutCheck`,
  `recordOnSiteCheck`); put an accommodation or restaurant live
  (`publishAccommodation`, `publishRestaurant`).
- **Effects** status changes on `businesses` with a notification to the
  owner; rungs write `business_verification_checks`; publishing writes the
  catalogue rows guests search. Audit: `business.review`,
  `business.verification_check`, `accommodation.publish`, `business.publish`.
- **Limits** a business cannot go live past a blocker listed in
  `GO_LIVE_BLOCKERS` (`lib/admin/business-ladder.ts`); the TIN, website,
  hygiene and licence attestations are never rungs.
- **Rejected** one "verified" switch: the four rungs are recorded separately
  so a tier is earned, not granted.

### 15.4 Stops (Supply > Stops, `/admin/stops`)

- **Shows** listers who are stopped from trading and their history
  (`agent_suspensions`, via `getStopsDesk`), filterable.
- **Actions** Stop a lister (`stopAgentTrading`, with a reason) and lift a
  stop (`liftAgentStop`).
- **Effects** the database function `suspend_agent` records the stop and
  takes the lister's listings out of search; lifting reinstates
  (`reinstate_agent`). Audit: `agent.suspend`, `agent.suspension.lift`.
- **Limits** a reason is required; the functions run with the service role
  because their grant is narrow, and only after the admin check.
- **Rejected** deleting a lister: a stop is reversible and keeps the record.

### 15.5 Payments (Money > Payments, `/admin/payments`)

Owned by admin-money; handbook section 12.

### 15.6 Fees (Money > Fees, `/admin/fees`)

- **Shows** the fee rates in force and their history (`fee_rates`, via
  `getFeeConsole`) and revenue by source over 90 days
  (`admin_revenue_summary` via `getRevenueSummary`).
- **Actions** set a new rate (`setFeeRate`, through `set_fee_rate`).
- **Effects** a new `fee_rates` row takes effect for new charges; charges
  already made keep the rate they were made at. Audit written by the action.
- **Limits** Vallo charges no platform fee on rent; a rate here must name
  what it applies to (rule 15).
- **Rejected** editing a rate in place: a new row keeps the history true.

### 15.7 Message flags (the Flags lane, `/admin/queue?tab=flags`; `/admin/flags` redirects there, V-88)

- **Shows** messages the safety scan flagged (`message_flags`), with the
  surrounding thread lines and each party's role, filterable by status.
- **Actions** Clear or Escalate (`reviewMessageFlag`).
- **Effects** the flag goes to `reviewed` with your id; Escalate also raises
  an open `risk_alerts` row. Audit: `message_flag.review`.
- **Limits** a reviewed flag cannot be reviewed again; the desk shows the
  lines around the flag, not the whole conversation.
- **Rejected** deleting the message: evidence is kept; the scan's decision
  is reviewed, not erased.

### 15.8 Reports (the Reports lane, `/admin/queue?tab=reports`; `/admin/reports` redirects there, V-88)

- **Shows** reports people filed (`reports`), with category, target and the
  response clock (`REPORT_RESPONSE_HOURS`, overdue count via
  `countOverdueReports`).
- **Actions** Reviewing, Resolved, Dismissed (`resolveReport`), each with a
  note and, for the reporter, an optional line they will read. A report on a
  review carries the lister's request instead, decided with Keep the review or
  Hide the review (section 5). A line above the list says whether anything has
  waited longer than the 24-hour promise, and a row of reason chips filters it.
- **Effects** the report's status moves and the reporter is told. Audit:
  `report.review`.
- **Limits** a resolved or dismissed report is final on this desk.
- **Rejected** acting on the target from here: the report is decided here and
  the target is acted on at its own desk.

### 15.9 Around (Moderation > Around, `/admin/social`)

- **Shows** proposed areas (`areas` with `PROPOSED`) and area moderator
  applications (`area_moderator_applications` `PENDING`), via
  `getSocialQueue`.
- **Actions** decide an area (`decideArea`), decide a moderator application
  (`decideModeratorApplication`), pause or resume an area (`setAreaPaused`).
- **Effects** the area opens or is refused, the moderator is appointed or
  refused, a paused area stops taking posts; each is audited.
- **Limits** only a `PROPOSED` area can be decided.
- **Rejected** gating these actions behind the `social` switch: the likeliest
  reason Around is switched off is that something needs moderating, so the
  console keeps its hands on it while members' own actions are refused
  (`lib/social/admin-actions.ts`). Also rejected: letting any member-facing
  screen make a place public or a member a moderator; the `areas` and
  `area_members` insert policies pin new rows to `PROPOSED` and `MEMBER`.

### 15.10 Standing (Moderation > Standing, `/admin/standing`)

- **Shows** badges granted by hand and their history (`user_badges`, via
  `getStandingDesk`).
- **Actions** Grant a badge to a handle with a reason
  (`grantStandingBadge`), revoke it (`revokeStandingBadge`).
- **Effects** a `user_badges` row is written or marked revoked with your id.
  Audit: `badge.grant`, `badge.revoke`.
- **Limits** only badges the platform allows to be granted by hand; earned
  badges are awarded by the nightly badges job.
- **Rejected** hard deletes: a revoked badge keeps its record.

### 15.11 Alerts (Operations > Alerts, `/admin/alerts`)

- **Shows** every risk alert (`risk_alerts`, via `getRiskAlerts`) by status
  and severity, and inventory drift alerts (`getInventoryDriftAlerts`).
- **Actions** Resolve (`resolveRiskAlert`, with a note), and I have this
  (`acknowledgeRiskAlert`), which puts your name on an open alert so nobody else
  chases the same fault and decides nothing about it. An inventory drift finding
  from the nightly sweep is drawn above the general queue, with the same resolve
  control; resolving says a person looked and does not move inventory.
- **Effects** the alert goes to `resolved` with your id and the time; the
  rail and Operations counts fall. Audit: `risk_alert.resolve`.
- **Limits** resolving does not fix the cause; a job that keeps failing
  raises a new alert on its next run.
- **Rejected** deleting alerts: history is kept (267 resolved rows on 22
  September).

### 15.12 Audit log (Operations > Audit log, `/admin/audit`)

- **Shows** every recorded decision and scheduled run (`audit_log`, via
  `getAuditLog`), searchable by id or words, filterable by kind and date,
  with actions per day and by kind (`getAuditActivity`, up to 5,000 rows
  and it says so when it hits that).
- **Actions** none; the log is read only, and identity documents and
  credentials in a row's detail are withheld (`safeAuditMetadata`). The page also
  has three charts (actions per day, by kind and by actor), two tabs for who
  wrote it (People, and Everything with scheduled jobs), tabs by kind, and a
  Download CSV link for the period (the last 30 days unless a date range is set;
  the download is itself recorded, section 0).
- **Effects** none: reading the log writes nothing, not even a view record.
- **Limits** forty entries a page (`QUEUE_PAGE_SIZE`), newest first; the
  search matches an exact id or words in the action and the target id, not
  the detail bag; the charts on Operations > Audit log read at most 5,000
  rows and say so when they reach it; a row shows only what its writer kept,
  nothing is joined in from the target.
- **Rejected** editing or deleting entries: a log that can be changed is not
  a log.

### 15.13 Switches (Settings > Switches, `/admin/switches`)

- **Shows** each surface that can be turned off in an incident
  (`feature_flags`, via `getFeatureFlags`) and whether it is on.
- **Actions** Switch off and Switch on (`toggleFeatureFlag`), with a
  confirmation sheet that says who loses what.
- **Effects** `feature_flags.enabled` changes; every page picks it up within
  about thirty seconds. Audit: `feature_flag.enable`, `feature_flag.disable`.
- **Limits** nothing already saved is deleted by a switch.
- **Rejected** a bare toggle: turning a surface off opens a confirmation
  first.

### 15.14 Reference data (Settings > Reference data, `/admin/reference`)

- **Shows** the occupations and local governments every profile picks from
  (`listOccupationsForAdmin`, `listLocalGovernmentsForAdmin`), searchable.
- **Actions** add or edit an occupation (`saveOccupation`) or a local
  government (`saveLocalGovernment`).
- **Effects** the `occupations` or `local_governments` row is inserted or
  updated; profiles choose from it at once. Audit:
  `reference.occupation.create` or `.update`, and the same for local
  governments.
- **Limits** no delete: a value in use on profiles is renamed, not removed.
- **Rejected** a Delete button: both tables are referenced by `profiles`
  with `on delete set null`, so a delete would quietly empty the answer of
  every person who had chosen the value, with no way to tell who
  (`lib/admin/reference-actions.ts`).

### 15.15 Examples (Settings > Examples, `/admin/examples`)

- **Shows** the example listings that show the product before real supply
  arrives (`listings.is_demo`), live and retired, with each one's retirement
  date and an overdue count (`getExamplesConsole`).
- **Actions** retire examples (`retireExampleListings`, through
  `admin_retire_demo_listings`).
- **Effects** retired examples leave search; the retirement is audited.
- **Limits** examples are never counted as supply on the overview or
  analytics.
- **Rejected** mixing examples into supply figures: a seeded market is a
  false window.

### 15.16 People and the member file (`/admin/people`, `/admin/people/<id>`)

- **Shows** a member search: by name (display name, first name, surname; two
  words also match first name and surname), `@handle`, full email address
  (through `admin_user_id_by_email`) or account id, the first 25 matches
  newest first; with nothing typed, the twenty newest sign-ups. Results show
  name, handle, roles, lister status and tier, and join date, never an email
  or phone. Each opens the member file.
- **The member file** is V-90's person file (`admin_person_file`: who, the
  lister record and ladder, a standing stop, linked accounts, fraud matches,
  the timeline) plus, from `readMemberExtras` (`lib/admin/member-queries.ts`):
  account (signed up as, terms accepted and version, whether a phone is on
  file, staff access and its history, shown to super admins only under
  `staff_grants_read`), verification (state, each document
  with subtype, issue date and where it came from, and the consent receipt),
  listings (count and the newest twenty by status), agreements (either side)
  and stays booked, support tickets (each opens on the support desk),
  reports filed and reports about them, devices (the device's own words and
  first and last seen; the fingerprint is never shown), and team notes.
- **Actions** one: **Add a note** (`addMemberNote`). Notes live in
  `public.member_notes` (`20260928233527`): admin and super admin read and
  write under RLS through their own client, only as themselves; the server
  stamps the time; there is no edit and no delete; each note writes a
  `member_note.add` audit row with its length, never its words, so the
  timeline shows it.
- **Who** admins and super admins. Scoped staff are refused: the person file
  is admin-only in the database, and the search is the widest read in the
  console.
- **Also on the file**: Consider an STR (opens a case on the Compliance desk,
  section 15.17); a standing stop, with, for a senior reviewer, **Uphold this
  stop as fraud** (a sentence of at least ten characters, which a later match
  reads out and which puts the person's identity keys on the deny-list until the
  stop is lifted; other reviewers are told who can); **Matches an upheld fraud
  stop**; **Linked accounts** (a shared device, mailbox pattern, phone number,
  payout account or NIN, compared inside the database and never shown); and the
  timeline, folded under "Everything, newest first" with a link to the audit
  trail (section 2).
- **Limits** a section whose read failed says "could not be read", never
  "none". Lists stop at twenty with the total where one is counted. The route is
  declared in `lib/nav/route-parents.ts` (People under the console, a member file
  under People) and People is on the rail under Support.
- **Not built** suspending or reinstating a member who is not a lister (only
  lister stops exist, `agent_suspensions`), a read-only "view as", and
  per-session sign-out (sessions live in GoTrue; the console sees devices).

### 15.17 Compliance (Verification > Compliance, `/admin/compliance`)

The AML/CFT desk, one lane per SCUML checklist item, as tabs (`?tab=`). Staff
only: the compliance scope opens it (`requireAdmin("compliance")` in each lane),
and nothing on it is ever shown to a member. Each lane reads its own data and
draws three states: the work, an honest empty, and a failure that says the check
could not run, never "none waiting". The item number is printed under the tabs.
The lane table is one line per lane in `app/admin/compliance/page.tsx`; the rules
and reads are in `lib/compliance/` and `lib/admin/str*.ts` and are not Session 3's.

| Lane (tab) | Item | What it shows | Controls |
|---|---|---|---|
| STRs (default) | 6, 19 | Suspicious Transaction Report cases: the source, the due date (marked overdue), the state, when it opened, the grounds, the linked transactions and people, and the file or do not file decision with its reasons. Releases waiting on a second person. A register of filed reports on a document sheet: the goAML reference, when it was filed, the case and the people who decided and approved | Open a case (other screens link in, prefilled: the person file, an alert, a sanctions hit); decide, link, hold a person's money, record the filing; a second person's approval is Slide to approve this decision, and ending a hold is Slide to approve the release. A decision bar sticks above the home indicator on a phone |
| Threshold reports | 7 | Each movement above the threshold, or a run of smaller ones for one party over the same limit within a week: the amount, the kind, the party and counterparty with their class, the threshold, the date, a due clock chip, and the recorded decision | Record that it was reported (with the goAML reference and date) or is not reportable (with a reason), then a second person approves. A monitor fault is shown as an alarm, never as "nothing to report" |
| Sanctions | 8, 9 | The lists in force (UN Consolidated and Nigeria) with their version date and entries, a list waiting to be activated, the matches waiting on a decision (exact first, close matches with their score, and a lower group for close matches on common names), confirmed matches with whether money is held, and the latest screenings | Load a list file (the UN list as XML or the Nigeria list as CSV, up to 4 MB; it loads inactive and a second person activates it, which re-screens everyone); decide a match, with a second person; a link to open an STR case |
| Risk | 15 | The counts by class (high, medium, low, reviews due), the open enhanced due diligence reviews, class changes waiting for a second person, and each person's class with its reasons, factors, whether derived or set by hand, and when its review is due | Decide an open review, with a second person; approve a class change proposed by someone else; set a class by hand with a reason; reopen a cleared review |
| Acting for | 17 | For agent and firm listings: how many are live with a mandate and without, the awaiting and taken-down counts, the mandates waiting, the grace date, and the listings still missing a mandate with a link to decide on Listings | A lookup: given a transaction, booking, rent payment or listing, who the lister was acting for (`ActingFor`); the lookup is staff only and writes an audit row |
| PEP | 20 | How many listers have not been asked, the open reviews of politically exposed persons' transactions, the people flagged (declared or flagged by staff), clears waiting on a second person, and the settled reviews | Flag a person; record the source of funds on a review and approve it as a second person; approve a clear proposed by someone else |

An approval that is final (a second person approving a recorded decision) is a
slide, and sending it back reopens the case, so that stays a button. The same
two-person rule applies on every lane (item 19): nobody approves their own
proposal, and the card says so.

### 15.18 Lookup (Overview > Lookup, `/admin/lookup`)

- **Shows** one search box (Control K opens the console search, which sends a
  reference here) and, once something is searched, "Results for" the kind it read
  as: a ticket reference, an id, an email address, a listing code, a payment
  reference or an error reference. Each hit has its kind, a link to the desk that
  holds it and a line of detail. A plain word is told it reads as a word and to
  search a desk instead; a reference with no hit says "Nothing matched on the
  desks you can open"; the desks your access does not include are named as not
  searched. An error reference carries a note about finding the crash report.
- **Sources** `lookup` in `lib/admin/lookup-reads.ts`, classified by
  `lib/admin/lookup-classify.ts`, each desk read under its own scope.
- **Actions** none.

### 15.19 Account recovery (Support > Account recovery, `/admin/account-recovery`)

- **Shows** the latest fifty requests to move an account to a new address when its
  owner has lost the mailbox (`email_recovery_requests`): the old and new address,
  the state (cooling off, completing, completed or cancelled), when it opened, the
  earliest time it may move, the evidence reference, whether the old address has
  been told, and for a completed one when it moved. The page head states the
  sequence, and the database enforces it (SEC-15): the NIN must match an approved
  identity on file, the cooling-off period counts from the notice to the old
  address, and a different super admin from the one who opened it completes the
  move.
- **Actions** Open a request (account id, new email address, the NIN the person
  gave, a ticket or evidence reference; super admins only), Send the notice again,
  Move the account (super admins only), and Cancel with a reason (any admin)
  (`lib/admin/email-recovery-actions.ts`). A person who is not a super admin is
  told only a super admin can open or complete one.
- **Effects** every step is in the audit log; completing signs the account out
  everywhere.

### 15.20 Front door (Analytics > Front door, `/admin/front-door`)

- **Shows** how many visits reach each step of joining, over 7 and 30 days, with
  the conversion from the step before, in one table; landing views by language
  over 30 days; and confirmed sign-ups by invite code over 30 days. It is first
  party only (`public.funnel_events`, kept 90 days). Until the migrations for the
  funnel or for invite codes are applied, the panel says it is not recorded yet
  rather than printing zeros.
- **Sources** `getFunnel(7)`, `getFunnel(30)` and `getReferralCounts(30)` in
  `lib/admin/reads/front-door.ts`. **Actions** none.

### 15.21 Field speed (Operations > Field speed, `/admin/field-speed`)

- **Shows** a table per route and connection class over the last seven days:
  samples, 75th percentile Largest Contentful Paint (seconds), Interaction to Next
  Paint (milliseconds), layout shift and page weight (KB). The samples are one page
  view in ten on real phones, with nothing that identifies a person
  (`components/app/VitalsReporter.tsx`). With no samples it says so instead of
  drawing a zero.
- **Sources** the `admin_field_speed()` function, which refuses anybody who is not
  staff. **Actions** none. It has no rail row; it is the last tab link on
  Operations.

### 15.22 Staff, the handbook and Settings

- **Staff** (Settings > Staff, `/admin/staff`) opens only for the founder's super
  admin account; the database refuses a grant from anybody else. Its panels:
  Give access (a person, a position and the scopes it brings), Support team,
  Everybody who can act in the console (name, position, the desks they hold or
  "Every desk", when and by whom it was given, the handbook acknowledgement, last
  active, actions in 30 days, and for a staff member a revoke control; admin roles
  change only through the founder's database runbook), Console keys (each
  person's keys with their label, when added and last proved, a warning where
  someone could be locked out, and a control to clear a person's keys), Left out
  of figures (anyone marked as internal, so they are left out of analytics, the
  overview and the view counter; staff and the QA accounts are left out
  automatically), and What staff did, last 30 days.
- **Staff handbook** (Settings > Staff handbook, `/admin/handbook`) shows the
  handbook by version, with a panel per section, then Your role and Acknowledge.
  A staff member's desks unlock when they acknowledge it. **Your role**
  (`/admin/handbook/position`) shows what the position is, what you are
  responsible for, what is expected of you and when to escalate.
- **Settings** (`/admin/settings`) reads nothing. It is one door to the desks
  under it: a panel per desk (Switches, Reference data, Examples, Staff, Staff
  handbook, Help and support), each a link.
- **What a staff member sees.** Not the operator's rail: a short frame with their
  position, Console, Handbook, Your role, Help and support, and one link per desk
  their scopes open once they have acknowledged the handbook
  (`app/admin/_components/StaffFrame.tsx`). Their front page lists those desks.

### 15.23 Team oversight (Operations > Team oversight, `/admin/oversight`)

- **Shows** two tables read from the records themselves. Backlog by queue: the
  queue, the desk that owns it, how many are waiting and the age of the oldest
  waiting item. Work by staff member, last 30 days: the person, their number of
  actions, the three they did most often and their last action. Each table has a
  Download CSV link (`/admin/oversight/export?kind=backlog` and `kind=throughput`).
  It is for admins and the `operations` scope, and carries the read-only line.
- **Actions** none.

### 15.24 What no desk shows yet

Inspections are on Operations > In flight (counts) and Bookings > Visits (the
calendar, section 11.1), push notifications on Operations >
Notifications, price checks on Analytics. Account deletions (A12), business
transfers (A13), the database's jobs one by one with their runs (A5) and the
money reconciliation watch (admin-money's request 10) each have a panel on
In flight that says what it needs; in-app notification volumes (A6) and the
email outbox (A14) have theirs on Notifications. Held events and the safety
scan's blocked terms are admin-review's (section 5). Mandates
(`listing_mandates`) and firm members (`firm_members`) are shown on the desks
that own them (sections 4 and 10). Escrow and the daily float snapshots have no
desk: the escrow desk is retired (section 9).

**The badge (B-BADGE).** Wherever the console draws a person's name (the
operator in the rail and bar, the people named in audit and alert rows, and
any desk that passes a tier), it keeps one slot, `PersonTier`, fed from
`public.person_badge` (gold for a checked supplier, platinum for platform
staff) by `getPersonTiers`. Session A owns the badge's artwork and component;
until that lands the slot draws nothing, so no badge appears anywhere in
the console yet.

## 16. Everyday procedures

(each worker adds the step by step runbooks for its desks: approving a listing,
asking for more, rejecting, deciding a report, passing or failing a
verification, releasing or refunding an escrow, investigating a failed charge,
reading a reconciliation failure)

### Review desks (admin-review)

**Approving a listing.** Open `/admin/listings`, Waiting tab. Open the oldest
row you are responsible for. Read Reason for review first: every admission
check that fails is listed there. Check the photos and play the walkthrough,
read Power and water against the description, check the costs (every line says
who it is paid to; a total that is "summed from the parts" was not stated by
the lister), and check Lister verification. If it passes, press Approve (a
note is optional). The next listing opens by itself. When you are ready to put
approved listings into search, open the Approved tab, open each, and press
Publish.

**Asking for more.** Write exactly what must change in the reason field ("The
fourth photo is of a different flat; replace it"). The lister reads it word
for word. Press Ask for more. The listing moves to More info needed and comes
back to Waiting when they resubmit.

**Rejecting.** Only for a listing that cannot become acceptable by editing
(not the lister's to let, a scam, a duplicate). Write why, press Reject, press
it again to confirm. The lister is told and may still edit and resubmit.

**Deciding a report.** The Reports lane, `/admin/queue?tab=reports`, narrowed by reason with `&reason=` if you like. Work top down: waiting items are
oldest first. Open the row, read the reporter's words and open what was
reported. Start review if it will take time (the reporter's report now shows
as in review under your name). Resolve when you have acted (for a listing,
suspend it on Stops or send it back through the listings desk); Dismiss when
there is nothing to act on. Write a note either way; it is in the audit log.

**A held post, story, comment or bio.** Open the row, read the words and why
the scan held them. Let it through, or write the reason and Take it down: the
author reads your reason word for word.

**Passing or failing a verification.** `/admin/kyc`. Open the person's row.
Open each document in the viewer. For a proof of address, check the issue date
(a badge says when it is older than 92 days or undated). Approve, or Reject
with a reason of at least twelve characters that tells them what to upload
instead. Their ladder and tier update when the rung's documents are decided.

### Money desks (admin-money)

**Reading an empty panel.** On money, supply, bookings and payments an
empty panel keeps its frame (axes, legend, table head) and shows a calm note:
the first line says what fills the panel, the second what creates that data,
and the link goes to the desk where that happens. A red note means the read
did not answer, not that there is nothing; reload.

**Ruling on a Guarantee claim.** Open `/admin/money#claims` (staff with the
`guarantee` scope open it at `/admin/agreements#claims`). Read what the claim
asked, what it cites, how many new evidence files there are and the description.
To approve, check the amount to pay from the Guarantee and slide to approve; to
reject, write a reason of at least ten characters and slide to reject, and the
claimant reads it. An approved claim then asks for the bank transfer reference:
pay it from the reserve account, enter the reference (at least four characters)
and slide to mark it paid. If the server refuses, the track says "That did not go
through" and the row carries the server's sentence. What amount the database
accepts is Session 2's rule (`docs/MONEY_ARCHITECTURE.md`).

**Ruling on a caution.** Open `/admin/money#caution`. For a disputed deduction,
open the tenancy file to read both sides' reports, enter the amount that stands
(0 allows none) and a reason both parties read (at least ten characters), and
slide to rule. For a contested return, write the reason and slide received or
not received.

**Deciding an agreement.** Open `/admin/agreements`. Read the row (the
inspection photos, the dates, the amount, whether a mandate stands behind the
owner), then Approve, or Reject with a reason both parties read, using one of the
four quick reasons if it fits.

**Declining a refund request.** On `/admin/money#refund-clock`, find the guest's
request in the due or overdue list, press Decline and write the reason the guest
reads. A refund itself is made on the stay's own page, never here.

**Investigating a failed charge.** On `/admin/payments`, narrow Every payment by
the Failed outcome, or look the person up. The row gives the provider reference
in full; give it to Paystack support.

**Reading a reconciliation failure.** The Reconciliation check badge reads:
Healthy (the newest run was clean and the job ran inside its 3 hour allowance),
Needs a person (the newest run reported something to look at; open Alerts for
the `cron.reconcile.needs_attention` alert with the counts), Gone quiet (no run
for more than 3 hours: the scheduler or the site origin in Vault is broken; tell
an engineer, this is how the job failed silently for three weeks in August), or
No runs recorded.

**Answering "where is my money".** Find the person on People, or the stay on
Bookings (search the booking id or the guest). The stay's payment record lists
each payment and refund; the refund's state is on `/admin/money#refunds`; the
platform-wide ledger is `/admin/money#history`, and Payments looks up a person's
saved methods.

### Operations runbooks (admin-shell)

**A job reads Overdue or Failed.**
1. Open Operations. Note the job, its last run and its schedule.
2. Open the Alerts tab: a failed run raises a `cron.<job>.failed` alert with
   the reason; a scheduler that could not get in raises `cron.<job>.locked_out`
   with the fix in its detail.
3. Locked out: the scheduler's secret does not match. `CRON_SECRET` on the
   scheduler must equal `RECONCILE_CRON_SECRET` on the host, and the
   scheduler's variable must be named exactly `CRON_SECRET` (docs/DEPLOY.md,
   section 2). This is an engineering fix; hand it on with the alert.
4. Failed: the reason in the alert is the job's own error. Hand it on.
5. When the next run succeeds the row turns Healthy on its own within a
   minute; resolve the alert on the Alerts desk so the count comes down.

**The database jobs row reads Attention.** The watch found a failure that has
not recovered, or a job overdue. The per-job list needs Request A5; until then
the `cron.pg_cron.job_failed` alert names the job.

**A figure reads Unavailable.** A read failed. Reload once. If it persists on
every desk, the database is unreachable (check the Alerts tab and the
platform status); if only one panel, report it with the panel's name.

## 17. What the console cannot do, and the open requests

(each worker: honest limits, and the scope-file request numbers for data the
console needs and does not have yet)

### Review desks (admin-review)

- **The Live, Rejected and Suspended tabs show the ten most recent.** Session
  A's `getListingSubmissions` caps its decided bucket at ten with no offset;
  narrowing by title, city or date reaches older ones. Tab COUNTS are exact.
- **The listing under review is found by its own title and status** inside
  Session A's view, so that the checklist and the costs are computed in one
  place. A listing whose title contains a comma or brackets may not be found
  that way; the page says it could not be opened rather than guessing.
- **Verification cannot be searched by name**: the name is not on the
  document row. Status and date narrow it. Find the person on People and
  open their file instead.
- **Scoped staff reach the whole of their desk.** A `listing_approval` staff
  member gets the photo provenance, property matches, reopening, principal
  consent, mandate decisions and the photo backfill; a `kyc_review` staff
  member records credentials and opens documents in the viewer. Each door
  names its scope and calls the database with the caller's own client, and
  each function gates on `private.staff_can(<caller>, '<scope>')`
  (`20260929010611`). The document viewer opens every document for
  `kyc_review`, and for `listing_approval` only an ownership or mandate
  proof filed against a listing. `lib/admin/staff-scopes.test.ts` pins each scope.
- **Safety holds stay admin-only.** `open_safety_holds`, `clear_safety_hold`
  and `extend_safety_hold` check the admin role in the database; the Held
  lane hides the panel from moderation staff rather than drawing buttons that
  refuse.
- **No provider match score exists** in the schema, so none is shown.
- **The desks decide nothing of their own.** Approve, Publish, Ask for more,
  Reject, report decisions, held-item decisions and document decisions all
  call Session A's existing actions, unchanged.
- Open requests: AR-10 (deciding a held event) and AR-11 (reading the blocked
  terms list). AR-12 (deciding a listing mandate) is met by the decision control
  in the mandate row (section 4).
  AR-1 to AR-9 were withdrawn when Session B wrote the reads itself
  (`lib/admin/reads/listings.ts`, `moderation.ts`, `verification.ts`).

### Money desks (admin-money)

- **The reconciliation job's last HTTP reply is not on the desks.** It lives in
  `private.reconciliation_watch`, which no admin read can reach. Scope request
  10 asks Session A for an admin-callable function; until then the panels show
  the audit history only.
- **Sums are taken over rows, not in Postgres.** PostgREST aggregates are off,
  so every total pages through the whole table (checked against an exact
  count). Above 50,000 rows a desk says its figures are floors. A database
  side aggregate would lift this; it is a migration, not requested yet
  because the platform is five orders of magnitude below it.
- **Supply cannot yet say who owns versus who agents a particular property.**
  The role is per account; `lib/supply/roles.ts` records that ownership is a
  property of a person and a property together, and that pair is not in the
  schema yet.
- **What these desks write.** On Money, the Guarantee claim, caution and
  refund-request decisions; on Agreements, the agreement decision; on bookings and
  payments, Session A's cancel, reservation decision, hold release and saved
  method removal. Supply, Operations and Analytics write nothing.
- **Bookings has no "checked in".** The schema has no such status; the card
  is "In stay now", from a confirmed stay's dates.
- **Payments cannot name a checkout's channel.** `transactions` does not
  carry one; the desk says "unrecorded" rather than guessing card.
- **The generated database types lag the live schema** (`CANCELLED`,
  `agency_fee`). The desks count unknown values instead of failing; the types
  are Session A's to regenerate.

### Overview and analytics limits (admin-shell)

- "Live a week ago" counts the listings live now that were already live then.
  A listing withdrawn during the week is not in it, because nothing records
  when a listing stops being live.
- Searches of the listings and listing views are not recorded (Requests A7,
  A8), so the render's Total searches, Conversion rate and Searches vs results
  are drawn as price checks (the one demand log there is) and listing views
  say "Not recorded". A person's decline of an inspection or reservation
  carries no reason (A11), so common refusals are the platform's price check
  refusals only.
- The database's own scheduled jobs (`PG_CRON_JOBS`) are summarised, not listed
  (Request A5).
- In-app notification volumes (Request A6) and the email outbox (Request
  A14) cannot be read by an admin; push can, and is shown.
- Open reviews has no week-on-week change: an open count has no history until
  something snapshots it.
- The render's "All areas" filter on Analytics is not built.

## 18. Options considered and rejected

(each worker: the alternatives weighed for its desks and why they lost; charting
approach and palette decisions from `docs/research/UI_UNIQUENESS_AND_ADMIN_RESEARCH.md`
part four belong here)

### Review desks (admin-review)

- **The render's reason tabs (Abuse, Fraud, Spam, Sexual content,
  Impersonation).** Rejected: the platform records eight other reasons
  (`reports_category_chk`), and a tab for a reason nobody can choose filters
  nothing. The tabs are the real eight.
- **Filtering reports by reason over a fetched page.** Rejected: it searches
  only what the page cap returned. The reason is narrowed in the query.
- **Counting a tab from the rows on screen.** Rejected: a count of a page is
  not a count of a queue. Every figure is a head-only exact count.
- **Folding example listings into the counts.** Rejected: on 22 September all
  64 live listings were examples and real supply was zero. Examples are
  counted apart and tagged wherever they are listed.
- **Average review time from `listings.reviewed_at`.** Rejected: each decision
  overwrites it, so it holds only the latest. The audit log's `listing.review`
  rows give every decision.
- **A confirmation sheet on every decision** (the old desk). Replaced by the
  render's inline bar; the two decisions that cannot be undone by the lister
  keep a guard (Ask for more needs a reason; Reject asks twice).
- **Drawing "match score" and "provider performance" from the render.**
  Rejected under the claims rule: nothing records them. The rung results
  are real and stand in their place.
- **A local copy of the sparkline.** Rejected once admin-shell's shared
  `Sparkline` landed; the donut stays local because the shared one is the
  agent console's booking-sources chart with a different anatomy.

### Money desks (admin-money)

- **A charting library (Recharts and friends).** Rejected for the reasons in
  research part four: every console page is a server component and a library
  chart is a client one; our theme is CSS custom properties that SVG follows
  without script; every library ships a default palette with banned hues.
  Inline SVG drawn on the server, with a small client layer that only tracks
  the pointer for the hover readout.
- **A four hue palette for four supply roles, and the render's teal, mauve and
  pink donut slices.** Rejected: research part four proved no four slot
  categorical palette passes inside the colour law. One blue ramp by
  magnitude, dash patterns and direct labels on lines, and the word, share
  and count beside every donut slice.
- **Deriving the money cards from `getMoneyConsole`.** Tried first, behind a
  gate that only used its rows when they were provably every row. It worked
  for today's data and would have gone dark at the sixtieth entry. Replaced
  by `getMoneyDesk`, which reads everything and checks the count.
- **"+100%" against an empty week.** Rejected: a change is only drawn when
  the earlier period had a real, non-zero figure. Otherwise the card says
  what the figure is and draws no arrow.
- **Counting examples as supply.** Rejected under the founder's claims
  ruling: examples are excluded by default and the page counts them
  separately.
- **A "Checked in" card on bookings.** Rejected: nothing records an arrival,
  so a count of check-ins would be a guess. "In stay now" is what the data
  supports.
- **Treating every PENDING payment as in progress.** Rejected: a checkout a
  person walked away from three days ago is not in progress. Split at 24
  hours into Started and Abandoned, with the rule written down.
- **One status palette slot per payment outcome.** Five outcomes, four status
  colours: Abandoned and Failed share rose and are told apart by their words
  on the bar and in the key.
- **A cursor pager on escrow** (a desk since retired, section 9). The shared queue pager offers only next and
  previous because the old read had no total. The render draws numbered
  pages, and `getEscrowDesk` has an exact total, so the desk uses numbered
  pages.

### Shell, overview, operations and analytics (admin-shell)

- **A charting library** (Recharts, Nivo, Chart.js, ECharts, Tremor): rejected
  for the reasons in `docs/research/UI_UNIQUENESS_AND_ADMIN_RESEARCH.md` part
  four: each makes every chart a client component, fights the CSS custom
  property themes, ships a banned default palette and costs 90 to 200KB. The
  charts are hand drawn inline SVG in `components/agent/charts/` beside the
  two that were already there, with only the hover readout on the client.
- **Four colours for Owner, Agent and Firm**, as the render draws them:
  rejected; a four slot palette cannot pass the colour-blind checks inside the
  colour law. One blue at three strengths, the third hatched, with a legend
  and a readout naming each.
- **Counting example listings as supply**: rejected; seeded stock read as a
  market is exactly the false window the founder condemned. Examples live on
  the Examples desk.
- **"Naira transacted" as every wallet movement**: rejected; a payment from a
  wallet into escrow and its release would count the same naira three times.
  Money is counted once, on its way in.
- **Deriving job health from a page of recent audit rows**: rejected; a daily
  job falls off a forty row page of hourly runs and would read as missing. One
  read per job, newest first.
- **Drawing a flat line through an empty series**: rejected; an empty chart
  says in words that nothing has happened and what will fill it.
- **Keeping the banded nineteen-row rail**: replaced by the renders' twelve
  rows with every other desk as a child and in All desks, so the rail matches
  the images and no desk is orphaned.
- **Putting the pulse strip in the top bar**, as the overview render does:
  rejected in favour of the three-panel renders' bar (search, bell, operator)
  shared by every desk; the strip leads the overview page instead.

### Session 3 additions (the shell and the rulings)

- **A tray that decides money.** Rejected: the batch tray holds only verbs that
  the queue already ran in bulk. A refund, a payout or a ruling on money is one
  slide on its own desk, one at a time, and is never in the queue.
- **A command palette that reads records.** Rejected: the console search only
  routes. Every row is a link to a desk or a search, and the search runs on the
  desk it lands on, under that desk's own access check, so the palette adds no
  new way to read a record.
- **A page count the pager cannot stand behind.** Rejected: the queues page by
  offset and do not know their total, so the sliding pager names only the pages it
  has evidence for, and the desks that count their rows name every page.
- **Filters inline on a phone.** Rejected: the dates push the queue down the
  screen and a long chip row scrolls sideways under a thumb, so below 768px the
  filters are one sheet with its actions above the home indicator. The inline
  form stays in the page, so nothing is lost with scripts off.
- **A reason-free ruling.** Rejected: a slide is only confirmed once the server
  has answered, so the track never claims a decision that was refused.
- **Drawing a PDF in the document viewer.** Not done: the console has no in-app
  PDF renderer, and the two ways to add one need a content security policy change
  that belongs to whoever holds `lib/security/csp.ts`. A PDF is offered as a file
  from Vallo's own origin instead.
