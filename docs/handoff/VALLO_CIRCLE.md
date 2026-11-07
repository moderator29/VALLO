# VALLO CIRCLE: spec v2 (Agent FEATURES, 7 November 2026)

v1 was the lead's brief (7 November 2026). The founder "kinda likes it" and
asked for it thought through much more. This is v2: the real problems, the
tools, how it flows with the feed, its side nav entry, its notifications,
privacy and safety, and the data model, checked against the live database.
Nothing here is built until the founder approves it (FEATURE_BACKLOG.md B2).
The decisions he needs to make are at the end (section 13).

## 0. What changed from v1

- **One Circle per person, plus Plans.** v1 had `circles` as groups. In v2
  your Circle is your own set of two-way ties (like a phone's favourites, but
  both people said yes), and the work happens in small **Plans** (a flat hunt,
  a trip, a table) that you start with a few people from it. One list to
  manage, many small rooms to get things done.
- **Six real problems first, then tools**, each tool built on a table Vallo
  already has (briefs, saved collections, bookings, reservations, rent
  payments, inspection safety shares, share links, blocks, reports).
- **The Circle signal travels**: a listing, a host card and a profile tell
  you when someone in your Circle has stayed, rented or eaten there, with
  their yes.
- **Viewing buddy**: the existing viewing safety share, sent to a Circle
  member instead of a bare link.
- **Vouches are statements, never a score** (V-21, the trust score is gone
  and stays gone), from a closed list, limited, and tied to time in a Circle.
- **Notifications are designed with the A4 voice** and capped.
- **The data model is checked against the live schema**, including the one
  trap: `posts_select` is a permissive policy, so the audience rule has to go
  inside it, not beside it.

## 1. The idea in one line

**The feed is everyone near you. Your Circle is the people you trust, and
what they know about living, staying and eating well.** Two lenses on one
screen, one swipe apart. Around is for discovering; Circle is for deciding.

## 2. The real problems it solves

Each one is a moment a Nigerian renter, guest or diner has today, what they do
now, and what Circle does instead.

| # | The moment | What people do today | What Circle does |
|---|---|---|---|
| P1 | **"Who has actually rented from this agent?"** Trusting a landlord or agent before paying a year up front | Ask on WhatsApp groups, wait, get hearsay | On the listing and the host card: "Tunde in your Circle rented through this agent in 2025". Ask him in one tap. Built on rent payments and bookings, only with Tunde's yes |
| P2 | **Finding a flatmate or co-tenant** someone you can live with, not a stranger | Post in a group, meet strangers | A **Moving soon** card from a Circle member's brief ("Looking in Yaba, 2 bed, from January"), and a **Hunt** plan two people share |
| P3 | **House hunting as a couple, family or flatmates** | Screenshots sent back and forth, lost links | A Hunt plan: one shortlist, each person's yes, maybe or no per place, a note, a viewing booked for both |
| P4 | **Planning a stay with friends** (a December trip, a wedding weekend) | One person collects money and does all the work | A **Trip** plan: dates and headcount, a shortlist of stays, a vote, one booker, each person's share shown up front |
| P5 | **Choosing where to eat** with people whose taste you trust | Ask around, scroll strangers' reviews | **Been there**: "Ada and 2 others ate here" on restaurants, and a **Table** plan to pick a place and book for the group |
| P6 | **Going to a viewing alone in a new area** | Text a friend the address and hope | **Viewing buddy**: the viewing safety share goes to a Circle member, who is told the place and the time you expect to be back, and is told if you have not checked in |
| P7 | **Helping someone you know find a place** ("my cousin needs a room") | Forward random links | "I know a place" on a Moving soon card opens a chat with the listing attached |

What Circle is NOT: not a follower count (follows stay as they are), not a
group chat (Messages does that and a Plan links to it), not a score (no
number out of anything, ever), not public, not a marketing channel for
agents.

## 3. The shape

- **Your Circle** is the people you have a mutual tie with: one invites, the
  other accepts. At most **150** (a real circle, not an audience).
- **A Plan** is a small room inside your Circle with a purpose: **Hunt**
  (find a home), **Trip** (a stay), **Table** (a meal), **Viewing** (go
  together, or as a buddy). 2 to 12 people, all from the starter's Circle.
  A Plan ends: when its booking is made, when its owner closes it, or after
  60 days quiet. An ended Plan is read only and kept.
- **Shares** are per kind and per person: what your Circle may see about you
  (section 9). Default: nothing but posts you mark Circle.

## 4. The tools

Every tool lists its home, what it reads, and its first version.

| # | Tool | Where it lives | Built on | First version |
|---|---|---|---|---|
| T1 | **Circle lens** | Around masthead, the second lens | `posts` + `posts.audience` | Circle-only posts and Circle members' public posts, newest first, no ranking |
| T2 | **Circle-only posts** | The composer's audience chip: Everyone or My Circle | `posts.audience` | A Circle post cannot be reposted or quoted; the composer says screenshots cannot be stopped |
| T3 | **Moving soon** | Top strip of the Circle lens; the member's Circle card | `briefs` (areas, intent, bedrooms_min, max_minor, move_from) | Shown only if the member switched "My brief" on; budget as a band, never the exact figure; "I know a place" opens a chat |
| T4 | **Hunt plan** with a shared shortlist | `/circle/plans/[id]` | `saved_collections` + `saved_collection_items` (SAV4) | Add from any listing's save sheet ("Add to a plan"), yes, maybe or no per person, one short note each, the tally on each card |
| T5 | **Trip plan** | Same page, Stays side | stays search, `bookings` | Dates and headcount, shortlist, vote, the owner names the booker, each share shown as the price divided by heads. Collecting the money through Vallo is a later decision (section 13, Q4) |
| T6 | **Table plan** | Same page, Eat side | `reservations` (party_size, reserved_for), `reservation_reminders` | Pick from a shortlist, the booker reserves for the group, every member gets the reminder |
| T7 | **Viewing buddy** | The viewing's safety step | `inspection_safety_shares` (expected_back_at, checked_in_at), `inspection_delegates` | Choose a Circle member instead of copying a link; they see the area, the slot and "back by"; they are told on check in, and told if you are late |
| T8 | **Been there** | Listing page, restaurant page, host card, profile | `bookings` checked out, `reservations` with a `reservation_seatings` row, `rent_payments` completed | "Ada stayed here in March", "2 people in your Circle ate here"; only members whose matching share is on; tap opens a chat |
| T9 | **Ask my Circle** | Composer kind ASK with audience Circle; the listing's three-dot menu | `posts` kind ASK with `listing_id` | "Anyone know this place or agent?" with the listing card attached |
| T10 | **Vouches** | Profile and the Vallo passport | new `vouches` | A statement from a closed list (section 9.4); count on the passport, names only to viewers who share the voucher in their own Circle |
| T11 | **Invite** | `/circle/invite`, a profile's button, a chat's three-dot menu, QR | `share_links` (kind `circle_invite`) | Invite people you follow, who follow you, or you have done a deal or chatted with; or by your link or QR |

## 5. How it flows with the feed

- **The lens switch** (already drawn by Agent FE in `FeedMasthead.tsx`,
  `FeedLenses`): Around and Circle. When Circle opens, the Circle word becomes
  tappable and the closed tag goes. Swipe sideways between the lenses, the
  way a phone moves between home screens; the lens is kept in the address
  (`/around?lens=circle`) so Back and a shared link land right. Reduced
  motion: a cross fade, no slide.
- **The Circle lens, top to bottom**:
  1. **Now**: up to three cards in one row, the open Plans you are in (with
     what changed: "Kemi voted on 2 places") and Moving soon briefs.
  2. **Posts**: Circle-only posts and members' public posts, newest first,
     with the same post card as Around.
  3. **Been there** rail after the fifth post: places your Circle booked and
     rated, each with the member's face.
- **Empty Circle lens** (first visit): one glyph, "Your Circle is the people
  you trust on Vallo", and two actions: "Invite people" and, when we have
  them, three suggestions from mutual follows and people you have had a deal
  with (never strangers, never contacts uploaded).
- **The Circle mark**: a Circle member's post in the Around lens carries a
  small mark beside the name, so the two lenses feel like one place.
- **The composer**: an audience chip under the text, Everyone (default) or
  My Circle. The last choice is remembered per person. A post's audience
  never changes after it is posted (delete and post again), and nothing
  posted before Circle changes audience.
- **From the feed into a Plan**: a listing post in either lens has "Add to a
  plan" in its menu.

## 6. The side nav entry and routes

- **Side nav** (`components/app/nav-model.ts`, the approved single addition):
  one row **Circle**, right after People in the main section, on both the
  Rent and the Stays side, glyph `user-check` until Agent FE draws a Circle
  glyph in the same family and weight. A small count dot only for pending
  invites to you. The bottom bar does not change.
- **Routes** (new, owned by FEATURES):

| Route | What |
|---|---|
| `/circle` | Your Circle: requests to you, open Plans, members (search, sort by recent) |
| `/circle/invite` | Invite: suggestions, search by handle, your link and QR |
| `/circle/join/[token]` | Accept an invite from a link (signed in, phone confirmed) |
| `/circle/plans/new` | Start a Plan: kind, name, members |
| `/circle/plans/[id]` | A Plan: shortlist, votes, notes, the booking step, members, leave |
| `/circle/sharing` | What your Circle sees about you (also linked from `/settings/privacy`) |

`route-parents.ts` and `route-labels.ts` get one additive line each. All pages
on PageFrame, light and dark, 360 to 1280; on tablet and desktop `/circle`
is two columns (members left, Plans right) and a Plan shows the shortlist
beside the members and votes.

## 7. Notifications

All through `lib/notify/junction.ts`, notification kind `social` (no enum
change), each event declared in `lib/notify/channel-policy.ts`, never SMS.
Written in the A4 voice: a header line, then the words.

| Event | Channels | Lock screen (header / words) |
|---|---|---|
| `circle_invite` | in app, push | "Circle invite" / "Ada wants to add you to her Circle" |
| `circle_accepted` | in app, push | "Circle" / "Tunde is in your Circle now" |
| `circle_plan_added` | in app, push | "Hunt in Yaba" / "Kemi added you to a plan" |
| `circle_plan_activity` | in app, push (digest) | "Hunt in Yaba" / "Kemi voted yes on 2 places" |
| `circle_plan_booked` | in app, push | "Trip to Calabar" / "Booked: Marina Suites, 20 to 23 Dec" |
| `circle_moving_soon` | in app only, daily digest | "Circle" / "Bola is looking for a 2 bed in Yaba" |
| `circle_vouch` | in app, push | "Vouch" / "Ada vouched for you: rented together" |
| `circle_viewing_buddy` | in app, push | "Viewing buddy" / "Ada is at a viewing in Yaba, back by 4:30pm" |
| `circle_viewing_late` | in app, push, even in quiet hours | "Viewing buddy" / "Ada has not checked in yet. Back by was 4:30pm" |

Rules: at most **3 Circle pushes a day** per person outside the viewing
buddy events; Plan activity is batched (one push per Plan per hour, the rest
fold into it); each Plan can be muted; `circle_moving_soon` never pushes.
Every push carries `thread-id` = the Plan or `circle`, so a phone groups
them. A switch per event family on `/settings/notifications`. A blocked or
removed person never causes a notification.

## 8. The rules that keep it safe

1. **Mutual yes before anything is shared.** An invite is accepted before
   either side sees the other's Circle content. Declining is silent: the
   inviter sees "Sent" until it expires after 30 days.
2. **Phone confirmed to join** (asked at that moment, like the first deal;
   founder ruling: phone is out of sign-up). The ID badge is shown where a
   member has it, never required.
3. **Every share is opt in, per kind** (section 9.1). Default off.
4. **Leave, remove, block and report** on every member and every Plan, one
   tap each, silent to the other person. A block removes the tie both ways at
   once and hides each from the other's Plans (`private.blocked_between`).
5. **Who you can invite**: someone you follow, who follows you, you have
   chatted with, or you had a booking, viewing or rental with; anyone else
   only through your own link or QR. At most 20 invites a day and 50
   pending. The 150 cap counts accepted ties.
6. **Not a sales channel.** An agent or host is in Circle as a person. A
   SHOWCASE post (a listing advert) cannot be posted to a Circle, and a Plan
   cannot be started by an account with someone else's listing in it as a
   paid promotion.
7. **Circle posts stay in the Circle**: no repost, no quote (`allow_quotes`
   forced off), excluded from search, share cards and Open Graph images.
   The composer says plainly that a screenshot cannot be stopped.
8. **Reports** go into the existing `reports` table with target types
   `circle_member`, `circle_plan`, `vouch`, and to the existing review desk.
9. **Your data**: Circle is in the data download, and account deletion
   removes ties, plans you own (members are told "This plan was closed"),
   your votes and your vouches.
10. **Logs never name a person**: ids only, in the same pattern as today.

## 9. Privacy choices (on `/circle/sharing`, linked from `/settings/privacy`)

### 9.1 What your Circle may see (each a switch, all off by default)

| Share | What it shows | From |
|---|---|---|
| My brief | Moving soon card: areas, intent, bedrooms, budget band, month | `briefs` |
| Stays | Been there on stays you checked out of, month and year | `bookings` |
| Rentals | "Rented through this agent" on a host card, year only | `rent_payments` |
| Places I ate | Been there on restaurants, month and year | `reservation_seatings` |
| My ratings | Your stars on a place beside "Been there" | `reviews`, `reservation_reviews` |

Turning a share off hides it at once, at the source (the read function
returns nothing for it), matching the passport rule "hidden means absent".

### 9.2 Who can invite me

Everyone I could be invited by (section 8.5), People I follow, or Nobody
(links only). Default: the first.

### 9.3 Who sees that I am in someone's Circle

Nobody but the two of us. A member list is never shown to a third person,
and Been there names only members of the viewer's own Circle.

### 9.4 Vouches

- **What a vouch says**, from a closed list only: "Rented with", "Lived
  with", "Stayed with", "Known for years", "Worked with". No free text, so it
  cannot be a review in disguise or an insult.
- **Who can vouch**: a member in your Circle for 30 days or more, phone
  confirmed. At most 5 vouches given a month. One vouch per pair.
- **Who sees it**: the passport line "Vouched for by 4 people" is visible
  wherever the passport is; the names only to a viewer who has that voucher
  in their own Circle. The owner can hide the line (`passport_settings`).
- **Never a score**: a count of statements, never weighted, never added to
  ratings, never ranked. The no-trust-score test grows to cover it.
- Withdrawn at any time by the voucher, silently. Reported vouches go to the
  desk; a vouch ring (many vouches among accounts that joined together) is
  surfaced to staff for review, never acted on automatically.

## 10. The data model (checked against the live database, 7 November 2026)

What exists and is reused: `follows`, `blocks` and `private.blocked_between`,
`confirmed_phones`, `private.badge_tier_for`, `briefs`, `saved_collections`
and `saved_collection_items`, `bookings`, `reservations`, `rent_payments`,
`inspection_safety_shares`, `inspection_delegates`, `share_links`, `reports`,
`passport_settings`, `notifications` (kind `social`), `posts` (kinds GIST,
ASK, REPLY, SHOWCASE, SYSTEM, STORY).

New, in `supabase/migrations/pending/features_circle_*.sql`, RLS on every
table, every function `security definer set search_path = ''`:

| Table | Columns | RLS |
|---|---|---|
| `circle_ties` | `user_low uuid, user_high uuid` (ordered pair, primary key), `invited_by uuid`, `status text` (invited, accepted), `invited_at`, `accepted_at`, `expires_at` | Select where you are either side. No direct insert or update: `circle_invite`, `circle_accept`, `circle_remove` functions |
| `circle_shares` | `user_id uuid, kind text, on boolean, updated_at` (primary key user_id, kind) | Own rows only |
| `circle_settings` | `user_id uuid primary key, invite_policy text, last_audience text, updated_at` | Own row only |
| `circle_plans` | `id, owner_id, kind text` (hunt, trip, table, viewing), `name, side text, starts_on, ends_on, headcount, collection_id uuid` (the shared shortlist), `booking_ref text, status text` (open, booked, closed), `created_at, updated_at, last_activity_at` | Select and write for plan members via `private.in_plan(plan, uid)`; owner closes |
| `circle_plan_members` | `plan_id, user_id, role text` (owner, member), `muted boolean, joined_at, left_at` | Select for plan members; insert through `circle_plan_add` which checks a tie with the owner and no block |
| `circle_plan_votes` | `plan_id, user_id, kind text, target_id uuid, vote text` (yes, maybe, no), `note text` (140 chars), `updated_at` | Plan members read; own row write |
| `vouches` | `voucher_id, vouchee_id` (primary key), `basis text` (closed list), `created_at, withdrawn_at` | Voucher reads and writes own; readers through `public.vouch_summary(uid)` only |

Changes to existing tables:

- `posts.audience text not null default 'everyone'` with a check
  (`everyone`, `circle`). **The trap**: `posts_select` is one permissive
  policy, so a second policy would OR with it and leak. The migration
  REPLACES `posts_select` with the same text plus `and (audience =
  'everyone' or author_id = auth.uid() or private.in_circle(author_id,
  auth.uid()))`. Insert check: SHOWCASE never `circle`. A trigger forces
  `allow_quotes = false` on Circle posts and refuses a repost of one.
- Every service-role reader of posts (search index, share cards, OG images,
  bots) adds `audience = 'everyone'`; a test lists them.
- `share_links.kind` gains `circle_invite` (one token per person, revocable).
- `saved_collections`: a plan's shortlist is a collection owned by the plan's
  owner; plan members read and add through `circle_plan_items` functions, so
  the existing owner-only policy stays untouched.

Helpers: `private.in_circle(a uuid, b uuid) returns boolean` (accepted tie,
no block), `private.in_plan(plan uuid, uid uuid)`, `public.circle_members()`,
`public.circle_lens(cursor)`, `public.been_there(kind, target_id)` (names only
members with the share on), `public.vouch_summary(uid)`. Grants: execute to
`authenticated` only, revoked from `anon` and `public`.

Realtime: one channel per member for ties and plan activity, named with
`ownChannelName("circle")` (`lib/supabase/channel-name.ts`), filtered by the
member's own id; a Plan page listens to its votes filtered by `plan_id`.

The code degrades to nothing until the SQL is live: every reader probes the
function and returns empty, the lens stays "closed" as today, the side nav
row is hidden.

## 11. Copy (English, through the existing patterns)

Calm, short, never shouty. "Circle" is always the word, never "squad",
"tribe" or "friends". No schedule promises (`lib/copy/banned-phrases.ts`).
Examples: "Your Circle is the people you trust on Vallo." "Only your Circle
sees this." "Left the plan. Nobody was told." "Ada vouched for you: rented
together."

## 12. Build order for B2 (after approval)

1. Ties, invites, `/circle`, `/circle/invite`, join links, the side nav row,
   `/circle/sharing`, notifications for invite and accept.
2. `posts.audience`, the composer chip, the Circle lens (the lens switch goes
   live), the Circle mark.
3. Plans: Hunt with the shared shortlist and votes, "Add to a plan".
4. Been there (listing, restaurant, host card) and Moving soon.
5. Viewing buddy on the existing safety share.
6. Vouches on the passport.
7. Trip and Table plans.

Each step ships end to end with its SQL file, tests (RLS cases for a
stranger, a blocked person, a removed member), and the pages in the ledger.

## 13. Decisions for the founder

| # | Question | Recommendation |
|---|---|---|
| Q1 | One Circle per person with Plans inside, or many named Circles? | One Circle plus Plans: simpler to understand, and Plans cover the "group" need |
| Q2 | Cap at 150 people? | Yes |
| Q3 | Vouches: count visible to all, names only to people who share the voucher? | Yes |
| Q4 | Trip plans: show each person's share only, or collect each share through Vallo? | Show shares now; collecting through the existing payment rails is a later job with the money agent, because it touches escrow and refunds |
| Q5 | Phone confirmed to join Circle? | Yes, asked at that moment |
| Q6 | Viewing buddy late alert in quiet hours? | Yes, it is a safety alert |

## What Agent FE does now (unchanged from v1)

Only the room for it, in the feed redesign: the masthead's lens switch
drawn with Around selected and Circle shown as closed (not tappable), and the
feed laid out so a second lens can slide in beside it. Nothing else is built
until the founder approves this brief.
