# Subject access: giving a person a copy of their data

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

The privacy notice promises a copy of the personal data Vallo holds about a
person, in a portable format (Nigeria Data Protection Act 2023). This is how
that promise is kept.

## Self-serve (the normal case)

A signed-in member opens **Settings → Privacy & Security → A copy of your
data → Download your data**. The browser downloads `vallo-data-<date>.json`
from `GET /api/account/export`.

- **What is in it:** the account (id, email, created), the profile, and every
  table that names the member: roles, terms acceptances, applications and
  document records, businesses and transfers offered or received, wallets and
  their entries, pots, bank accounts and saved cards (as stored, which is
  masked), bookings and the card payments against them (`transactions`),
  booking changes the member made, refunds, reservations, rent payments,
  escrows as payer and as payee, inspections, escrow evidence, conversations
  as guest and as host, messages the member sent, support tickets, assistant
  conversations and messages, notifications, push devices, saved items and
  searches, Price Check history, posts, stories, comments, reactions,
  reviews, reports, follows, blocks, mutes, places created and joined,
  moderator applications, events hosted and attended, badges. For a lister or
  host: their listings and listing photos, their venues' accommodations,
  photos and business documents. The lists are `OWNED_TABLES` and
  `CHILD_TABLES` in `apps/web/src/lib/account/export.ts`.
- **The retired money tables (dated note, 29 September 2026).** Those lists
  still name `wallets`, `wallet_pots`, `wallet_entries`, `escrows` and
  `escrow_evidence`. On 25 September 2026 those tables moved to the
  `retired_custody` schema, which no app role can read, so in the export
  each of them comes back marked `unavailable` instead of holding rows. A
  person who wants their retired wallet or escrow records gets them through
  the by-request route below. The newer money records (`deal_agreements`,
  `guarantee_claims`, payout accounts) are not in the lists yet.
- **How it is kept to that person:** every read uses the member's own session
  (RLS applies) and is filtered on the table's owner column to the member's
  id. Child rows are reached only through the member's own parent rows.
- **Staff identities are removed** from every row (`STAFF_KEYS`: who
  reviewed, verified, resolved, decided, hid or granted something). The
  decision stays, and so do `review_notes`, `decision_note` and
  `resolution_note`: those are the reasons the member is already shown in
  the app (application status, the listing and business review banners), so
  they are data about the member, not internal notes. A new `*_by` column on
  an exported table fails `export.test.ts` until it is classified as staff
  or party.
- **Details the member gave about someone else stay in:** `bookings.guest_name`,
  `guest_phone` and `guest_email` hold the arriving guest's details when the
  member booked for another person. The member supplied them, so they are
  returned to the member.
- **What it leaves out, and says so in the file (`notIncluded`):** security
  records only our systems read (`known_devices`, `account_identities`),
  queued emails (`email_outbox`), Price Check share cards (area figures, not
  personal data), the files themselves (photographs and documents are listed
  by storage path, not embedded), messages the member received and support's
  replies (the other side's words are theirs), staff identities, and a firm's
  listings and a venue's room types, rates and opening hours (the business's
  records).
- **Pacing:** three exports an hour per account (`data_export` bucket). The
  limiter fails open when its store is unreachable. That is a decision, not a
  gap: the export reads only the member's own rows, and with the database
  down the export fails anyway.
- **Tests:** `lib/account/export.test.ts`, `app/api/account/export/route.test.ts`.

## By request (what the export leaves out, or someone who cannot sign in)

1. Confirm the requester controls the account's email address (reply from it).
2. With the service role, read the rows `notIncluded` names for that user id,
   and the files under their uid folder in each bucket.
3. Send them within 30 days of the request, and write an `audit_log` row
   (`account.subject_access`, the user id, what was sent). Do not paste
   another person's data into the reply: messages from the other party in a
   conversation are theirs.
