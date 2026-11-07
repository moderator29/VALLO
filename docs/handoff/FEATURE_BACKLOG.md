# FEATURE BACKLOG: everything the founder asked for, with an owner

The founder, 7 November 2026: "have all of this in queue so it's not missed".
Every line has an owner and a state. Built means end to end: database (SQL
sent to the founder to paste), server, the screen in light and dark at 390
and 360, phone, tablet and desktop, tests, and the page ticked in
PAGE_LEDGER.md. Hauslet is a reference for how many clean, useful tools a
platform offers, never a design to copy.

States: QUEUED, BUILDING, BUILT (not on a device), LIVE (after "push to main").

## A. Notifications, the founder's top priority right now

| # | What | Owner | State |
|---|---|---|---|
| A1 | Rich push on iOS: a Notification Service Extension that downloads the listing or person photo into the notification (like the trending card on his lock screen), grouped by thread (`thread-id` exists), a category header line | NATIVE (native) | QUEUED, needs build 1.0.2 |
| A2 | Rich push on Android: a monochrome Vallo small icon with the brand accent, the photo as large icon and big picture, channels per kind (messages, bookings, money, activity, offers) | NATIVE | QUEUED, needs build 1.0.2 |
| A3 | The payload carries `image` (a signed or public listing or avatar URL), `category` and `subtitle`; web push shows the image too | NATIVE (owns `lib/push/**` for this job; the lead reviews) | QUEUED |
| A4 | Lock screen words with a header, the way the best apps write them: "New in Lekki" / "A 2 bedroom flat just listed near you", "Booking confirmed" / place and dates, "Ada replied" / the message; one voice, short, never shouty | FEATURES with the lead (`lib/push/copy.ts`, notification inserts) | QUEUED |
| A5 | New kinds: new listings in your area (matching saved searches and stated interests, at most once a day, a digest when many), new neighbours (Circle members or followed people near you), price drops on saved places (exists: keep), a saved place back on the market, a viewing tomorrow, a stay check-in tomorrow, a review to leave after a stay or move-in | FEATURES | BUILT (SQL live 20261107210100; new in your area, new neighbours, move-in review added; the rest already existed and are kept) |
| A6 | Gentle nudges that are never spammy: confirm your phone, verify your ID before a long rental, finish your listing draft, complete your profile. At most one nudge a week per person, never two kinds in a day, stop after three, each one switchable in settings | FEATURES | BUILT (SQL live; switches at /settings/notifications/reminders) |
| A7 | The in-app Activity Centre shows the same rich cards (photo, header, time) and opens the exact destination | FE (universal systems job) | QUEUED |
| A8 | Email headers in the same high end style (logo lockup, one header line, the photo) | FEATURES | QUEUED |

## B. Vallo Circle (founder: "I kinda like it, think more, build it high end")

| # | What | Owner | State |
|---|---|---|---|
| B1 | Circle spec v2 in `VALLO_CIRCLE.md`: the problems it solves (finding a flatmate, trusting a landlord, planning a stay with friends, choosing where to eat), the tools, the flows with the feed, a side nav entry, notifications, privacy | FEATURES | SUPERSEDED: the founder chose a real estate community (FEED_AND_CIRCLE_BRIEF.md); v3 written in VALLO_CIRCLE.md, research in FEED_CIRCLE_RECOMMENDATIONS.md |
| B2 | Build it end to end after the founder reads v2: tables and RLS (SQL for the founder), the Circle lens in the feed, the Circle page in the side nav, invites, shared shortlists, plans, vouches | FEATURES | BUILDING as v3 (SQL live 20261107210200 and 210300; /circle, communities, Ask, create, threads, helpful, accept, follow built) |

## C. Ratings, like the App Store (founder)

| # | What | Owner | State |
|---|---|---|---|
| C1 | Rate a person after a real deal (stay, move-in, viewing): stars plus a short review, both sides, released together (or after 14 days) so nobody rates in revenge; reply once; report | FEATURES | QUEUED |
| C2 | The App Store style summary: big average, count, the 5 to 1 star bars, most helpful and newest, on the public profile, on your own profile (with what people praise) and on the listing's host card | FEATURES (logic) + FE (shared rating components) | QUEUED |

## D. More tools per area (the Hauslet lesson: many clean, useful tools)

Agent FEATURES proposes 5 or more per area in this file, then builds the best,
end to end, in order of value. Starting ideas:

- **Home**: continue where you left off, your next booking or viewing card, a
  "new near you" rail, weather and power status for your area where data
  exists, a quick switch between Rent, Stays and Eat.
- **Search**: saved searches with alerts, draw an area on the map, commute
  time to a place you name, recent searches, sort by move-in cost, compare.
- **Listings**: the gallery with rooms labelled, a move-in cost calculator,
  "ask the host" quick questions, availability calendar, neighbourhood facts,
  share as a card, report, similar places, the host's rating summary (C2).
- **Stays**: date and guest sheets, price for your dates up front, house
  rules at a glance, check-in guide unlocked after booking, split the bill.
- **Restaurants**: reserve a table, menus with photos, deposits, group size,
  reminders, "book again".
- **Messages**: (done: pin, mute, swipe, voice, reactions) next: scheduled
  messages, saved replies for hosts, translate a message, shared media and
  links tab per chat, block and report from the chat.
- **Profile**: rating summary, badges, verified marks, what I'm looking for,
  shareable profile card.
- **Admin**: a calmer overview, the crash log (done), user lookup with a
  timeline, bulk actions with undo, saved filters, an audit trail per record.

## E. Everywhere

| # | What | Owner | State |
|---|---|---|---|
| E1 | Remove every plate or dark container behind a logo, flag or glyph that makes it look pasted on (the flags are fixed; sweep the rest) | FE | QUEUED |
| E2 | Tablet, iPad and desktop: layouts that use the width, Back inside the page header (never floating at the screen edge) | PAGES (pages) + FE (shared frame) | QUEUED |
| E3 | The docs and help pages upgraded (`/docs`, `/help`, `/guides`): searchable, clean, on PageFrame, light and dark | PAGES | QUEUED |
| E5 | Marketing email consent at sign up is pre-ticked (AcceptTerms defaultChecked): make it unticked by default, with the choice also in Privacy choices (Nigeria data protection law, NDPR) | FE (Privacy choices job) | QUEUED |
| E4 | Every new piece audited front and back: looks solid, the data path real, RLS on, tests | Lead | ONGOING |
