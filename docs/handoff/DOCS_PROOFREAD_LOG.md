# DOCS PROOFREAD LOG

November 2026. This is the second, real pass: every chapter below was read in
full, in order, with each number checked against code or a migration where one
could be found. (The first pass in an earlier version of this file was a
mechanical scan and is superseded by this one.)

## Read in full

| File | Lines | Result |
|---|---|---|
| `app/(site)/docs/chapters.tsx` (What Vallo is, How paying works, Cancellations and refunds, Avoiding scams, Privacy and your data, Troubleshooting) | 1,160 | 1 fix |
| `chapters-guide.tsx` (Quick start, What Vallo costs, Viewings, Hosting, Restaurants, Badges) | 993 | 0 fixes; every number checked |
| `chapters-more.tsx` (Getting around, Price Check, Assistant, Listing, Messages, Around) | 825 | 3 fixes |
| `chapters-people.tsx` (Account, Search, Reading a listing, Viewing to keys, Booking a stay, Reviews, Owners, Agents) | 1,178 | 0 fixes; nearly clean |
| `facts.ts`, `docs-groups.ts`, `glance.ts`, docs `page.tsx` and layout | about 330 | 0 fixes |
| `lib/support/help-articles.ts` (all 60 answers) | 461 | 1 fix |
| Staff manual: access, desks, queues, decisions, records, escalation, my-desk, weekly-report, parts, views | 1,838 | 11 fixes |
| `PROTECTED_HOW` copy in `lib/money/copy.ts` (the text of /docs/how-protection-works) | about 170 | 1 fix |

Not line-read: the fee calculator's interface strings
(`docs/fee-calculator/FeeCalculator.tsx`) and the code of
`docs/[slug]/page.tsx` (no prose). The dictionary-driven sentences in
`chapters-more.tsx` (settings, Price Check, assistant disclosure) are built from
`@vallo/i18n` strings that were not read here.

Chapters found almost clean after a genuine read: Quick start, What Vallo costs,
Viewings, Hosting, Restaurants, Badges, Account and workspaces, Search, Reading
a listing, Viewing to keys, Booking a stay, Reviews, For owners, For agents,
Price Check, The assistant, Messages, Weekly report. These documents were
already carefully fact-checked against the product (their prose imports the
money sentences and limits from code).

## Fixes: 18 edits in 10 files

By type: factual 5, product name 2, link 1, completeness 7, clarity of wording 3.

### Factual corrections (old to new, with reference)

| Where | Old | New | Reference |
|---|---|---|---|
| Around chapter, Post section | "Replies are one level deep." | "Replies can go three levels deep, and after that a reply attaches to the one above." | placement trigger refuses depth over 3 (`supabase/migrations/20260804105404_social_content_core.sql:249`); `MAX_DEPTH = 3` and `replyTargetOf` in `app/(app)/post/[id]/ThreadView.tsx` |
| Staff manual, Desks, "What is true about money today" | "Stays, hotel rooms and restaurants pay by card through Paystack" | "Stays and hotel rooms pay by card ... A restaurant table is free to book." | restaurant tables take no payment (`PAY_INSIDE_VALLO` family, `chapters-guide.tsx` Restaurants chapter) |
| Staff manual, Access, "Business development and social media" | said the console has no access area or position for either | both exist: `business_development` and `social_media` areas, the Business Development Director and Social Media Manager positions; the section now says so | `lib/admin/staff-positions.ts:304-334`, the access table above it in the same chapter |
| Staff manual, Records, at a glance | "Nobody can edit or delete the audit log, admins and the founder included." (contradicted the chapter's own body) | adds the one exception the body already states: a person's name is removed from their own rows when they delete their account | Records chapter, "The audit log" section |
| Staff manual, My desk | "Three tabs" | four tabs, with Weekly report | `app/admin/my-desk/DeskTabs.tsx:4-7` |

### Accuracy of who pays (2 edits)

"There is no holding fee or platform fee to pay anyone" (Avoiding scams) and
"Anyone presenting ... a platform fee as a Vallo charge is lying" (help answer)
read as if no one pays a platform fee, but a lister's commission comes out of
their share. Both now say the renter or guest pays none. References:
`COMMISSION_FROM_SHARE` in `app/(site)/docs/facts.ts`, Terms section 6.

### Names, links, completeness, wording

- "Terms of use" became "Terms of service" in the How protection works page
  (`lib/money/copy.ts` `PROTECTED_HOW.related.terms`); the document is titled
  Terms of service everywhere else.
- "Vallo Stays" in the Getting around chapter became "the Stays side", matching
  What Vallo is.
- `/around/manage` (a permanent redirect, `next.config.ts:288`) became
  `/around/settings` in the Around chapter.
- Staff manual Desks chapter claimed to list every desk on the rail but left out
  four: added Business development, Protected payments (noting the rail is
  switched off), Social media and Pages that fail, with their access areas
  read from each page's `requireAdmin`.
- Staff manual My desk: added the Undo banner on a task status change,
  a reassignment, and a pin (new this month), and the Weekly report tab.
- "runs on 4 hours" and similar became "runs on a 4 hour clock" (Escalation,
  Queues, 3 phrases in 2 files).

## Verified against code or migrations (no change needed)

Cancellation presets (Flexible 24 h; Moderate 5 days then half; Firm 30 days,
7 days half; Strict 7 days half) against
`20261013062641_four_preset_cancellation_policies.sql`; 72 hours
(`FULL_REFUND_HOURS`); three hours for "Is it as listed?"
(`lib/stays/arrival-check-actions.ts`); viewing reminders (evening before, 08:00,
two hours before; `20261013100331_visit_reminders_both_sides.sql`); join a video
visit 10 minutes before (`JOIN_LEAD_MINUTES`); no-show 14 days and 48 hour
dispute (`20261013063125_viewing_no_show_c_functions.sql`,
`NO_SHOW_DISPUTE_MS`); suggest a visit time two hours ahead
(`lib/inspections/visit.ts`); delete for everyone 2 days 12 hours
(`20261011142249_messages_reply_trigger.sql`); handle rule 3 to 20 characters
(`HANDLE_RE`); photo and video limits (`lib/agent/listings-model.ts`); the
48 hour hold (`lib/bookings/checkout-view.ts`); urgent reports within 4 hours
(`RESPONSE_COMMITMENTS`); seated opens three hours before the table
(`lib/reservations/seating.ts`); the 30 day deletion window
(`GRACE_WINDOW_DAYS`); the hotel commission of 10 percent against the dated row
cited in `facts.ts`.

Retired or switched-off features: the Guarantee is described as retired on
9 November 2026 everywhere it appears; escrow and the protected rail are
described as not offered or not open; no wallet is described. No stale claim
found.

## Could not verify

- "Published through Google Play and the App Store" (What Vallo is, help
  answer): no store listing is visible in code. Needs the founder's yes.
- "Most decisions come back within one working day" (Badges) and "about five
  minutes" for the owner form (help): no constant behind them.
- That a review "cannot be edited once it is posted" (Reviews).
- Enquiry stage names (agents chapter), and the exact set of charges at the
  door.
- The restaurant fee figure in the database
  (`restaurant_money_settings.seated_fee_minor`); the docs print the code
  default.
- Whether the docs' complaint route to the Nigeria Data Protection Commission
  should also be in the Privacy Policy (it is not; see LEGAL_PAGES_CHANGES.md).
- `MANUAL_UPDATED` (`lib/admin/manual/chapters.ts`) was not moved; the founder
  or lead should move it if these manual edits count as a re-read.
