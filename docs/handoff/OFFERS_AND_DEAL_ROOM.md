# VALLO OFFERS, NEGOTIATION AND THE DEAL ROOM

The founder's commission, 10 November 2026. For the session already working on
`platform-grade-1-readiness`. **All phases in one go, not phased**: he was
offered a phased plan and ruled against it, so build the whole system.

Read with `PLATFORM_GRADE_1_READINESS.md` (his rules), `FOUNDER_BRIEF_VERBATIM.md`
(his own words), `DOCS_AND_PRESENCE_UPGRADE.md` (the documents, which this
feature must land inside) and `PROTECTED_PAYMENTS_BUILD.md` (what may and may
not be said about money). Every rule in those applies here.

He has also supplied a long written specification of his own and a set of
reference screenshots. **His specification is the requirement; this document is
the grounding**: what already exists, what must be reused, what must never be
said, and what the thing should feel like. Where his specification and this
document disagree on scope, his wins. Where they disagree on a safety rule or
on reusing existing architecture, this one wins, because it was written from
the source.

---

## 1. THE ONE-PARAGRAPH VERSION

A buyer finds a house for sale, checks they are eligible, makes an offer, the
seller counters, they agree a figure, and from that moment both of them work
inside a Deal Room that holds the negotiation, the messages, the inspection,
the documents and the next step, until the deal completes or ends. Vallo
records all of it and takes none of the money. Today none of this exists: a
sale listing can be browsed, inspected and messaged about, and then the entire
transaction leaves the platform and is never seen again.

---

## 2. WHAT EXISTS TODAY, READ FROM THE SOURCE

Verify each of these yourself before building on it.

### 2.1 Sales today are listings and leads, not transactions

- `listings.intent` is `check (intent in ('rent', 'sale'))`. Sale is a
  first-class listing kind: search, filters, the map, cards and price display
  all handle it.
- `inspection_requests` work for sale.
  `components/app/inspections/visit/property.ts` reads `salePriceMinor`.
- Messaging the agent works.
- **And that is the whole of it.** There is no offer, no counteroffer, no
  negotiation record, no deal room, no seller inbox, no buyer offer list, no
  per-deal documents, no completion.

### 2.2 The negotiation machinery you MUST build on

`deal_agreements`, from
`20260925121219_track_a2_split_settlement_guarantee_agreements_claims.sql`:

```
kind                      check (kind in ('rent', 'stay'))
listing_id                references listings
inspection_id             unique, references inspection_requests
booking_id                unique, references bookings
renter_id, owner_id       references auth.users, must differ
amount_minor              bigint, > 0
terms                     jsonb
terms_version             integer, >= 1
renter_confirmed_version  integer
renter_confirmed_at       timestamptz
owner_confirmed_version   integer
owner_confirmed_at        timestamptz
mandate_id                references listing_mandates
status                    agreement_status
submitted_at, decided_at, decided_by, decision_reason, paid_at
```

`agreement_status` is the enum
`('awaiting_parties', 'in_review', 'approved', 'rejected', 'cancelled', 'paid')`.

`deal_agreement_versions (agreement_id, terms_version, terms, amount_minor)`
with a trigger, `private.snapshot_agreement_version()`, that writes a snapshot
on every change. `deal_agreement_events` records every transition.

**Look closely at what that already gives you.** `terms_version` IS the
counteroffer version. `renter_confirmed_version` and `owner_confirmed_version`
ARE accept-this-specific-version. When both confirm the same number, that is
the agreed deal, and the snapshot table proves what each side agreed to. The
founder's specification asks for exactly this and it is already built, tested
and under RLS for rent and stays.

### 2.3 Everything else you are told to build and already have

| The specification asks for | What exists |
|---|---|
| Messaging, structured cards, attachments | Conversations, messages, `message_attachments`, reactions, voice notes, system messages |
| Eligibility and identity | `identity_checks`, `kyc_consents`, the verification flow, the manual KYC desk |
| Inspections | `inspection_requests`, `viewing_windows`, `inspection_confirmations`, the eight-item `inspection_reports` with photographs |
| Notifications | `notifications`, `notice_preferences`, push, email |
| Admin oversight, RBAC, audit | The console with step-up MFA (`console_step_ups`), `moderation_cases`, `moderation_case_events`, `reports`, `risk_alerts` |
| Agent authorisation | `listing_mandates`, `kind in ('letting','sale','management')`, with a signed document, `signed_on`, `expires_on`, `review_status` |
| Immutable history | `deal_agreement_versions` and `deal_agreement_events` |

### 2.4 The genuine gaps

Only these are actually missing: `kind = 'sale'`, offer expiry, a per-deal
document vault, the Deal Room surface itself, the two dashboards, the admin
Offers and Deals desk, and the background jobs for expiry.

---

## 3. THE ARCHITECTURAL RULING: EXTEND, DO NOT DUPLICATE

**Do NOT create `property_offers`, `offer_versions`, `counteroffers` or
`deal_rooms` as new tables.** The founder's specification lists those as
"conceptual names only, adapt to existing naming conventions", and the existing
convention is `deal_agreements`.

A sale offer is a `deal_agreements` row with `kind = 'sale'`.

- `renter_id` is the **buyer**, `owner_id` is the **seller or the agent's
  principal**. Do NOT rename those columns: they are referenced across the
  rent and stay code, the RLS policies, the probes and the admin desk. Map the
  names in one typed module and let the interface say buyer and seller.
- `inspection_id` stays nullable for sale. The existing constraint
  `check (kind <> 'rent' or inspection_id is not null)` already permits that.
- `booking_id` is null for sale. Same reasoning.
- `amount_minor` is the offer amount. `terms` jsonb carries payment
  preference, deposit, the instalment proposal, the target closing date, the
  note, and the expiry.
- `terms_version` increments on every counteroffer. The snapshot trigger
  already preserves each one, so **an earlier offer can never be overwritten**,
  which is the specification's hardest requirement and you get it free.
- `mandate_id` links the agent's sale mandate.

**Multiple offers on one listing already work**: there is no unique constraint
on `listing_id`, so one listing can carry many agreement rows.

**The Deal Room is a surface, not a table.** It is a view over one agreement
plus its versions, events, conversation, inspection and documents. Do not
model it as its own entity with its own state that can drift from the
agreement.

### 3.1 The status enum

`agreement_status` needs `'withdrawn'` and `'expired'` added. Adding an enum
value is additive and safe.

**`'paid'` must be unreachable for `kind = 'sale'`.** Add a check or a trigger
that refuses it, because Vallo does not take money for a purchase and a status
of paid on a sale would be a false record of a thing that never happened.

### 3.2 New tables, the only ones

- `deal_documents`: agreement_id, category, uploaded_by, storage path, review
  status (`requested`, `uploaded`, `under_review`, `approved`, `rejected`,
  `more_information`), reviewer, notes, version, timestamps. Private storage,
  signed access only, never public.
- Reuse `moderation_cases` and `reports` for disputes. Do not build a parallel
  dispute system; add the deal reasons to the existing taxonomy.

---

## 4. THE REFERENCE SCREENSHOTS: WHAT TO TAKE, WHAT TO REFUSE

### 4.1 Take the shape of the offer gate

The reference shows eligibility checked **before** the form, as a card listing
each requirement (Government ID, Minimum Age 18+) with a **Fix** button on the
one that is actionable, a red banner saying requirements are not met, and the
form visible but unsubmittable underneath. That is correct and humane: the
buyer sees exactly what is blocking them and one tap fixes it.

Also correct, and worth matching: the amount may be left blank to offer the
asking price; three payment preferences; an optional target closing date; an
expandable note to the seller; and the quiet honest line under the submit
button, "Nothing is charged. The seller reviews it and responds."

### 4.2 Refuse their price presentation outright

Their listing shows **₦85,000,000** as the asking price in the description and
**₦98,750,000** as "Total Closing Cost" in the sticky bar. That is a sixteen
per cent difference with no breakdown offered anywhere on the screen.

A Nigerian buyer who notices that assumes they are being set up, and they are
right to. **Vallo must never do this.**

The rule:
- Show the **asking price** as the price.
- Show additional costs **only where real configured data exists for this
  listing**, each one labelled: confirmed, estimated, optional, or paid
  directly to a third party.
- Show a total **only** when every component of it is real, and always with
  the breakdown one tap away.
- Where the breakdown is not available, say so: the asking price, and a plain
  line that other closing costs will apply and are not yet itemised.
- **Never invent a legal, agency, government or transaction fee**, and never
  silently add an estimate to the asking price.

The repository's `check-valuation-words.mjs` gate will probably refuse
invented fee language anyway. If the gate refuses your sentence, the sentence
is wrong. Do not work around the gate.

### 4.3 Where they stop is where Vallo starts

Their own listing page says: "Hauslet doesn't handle payments or agreements
for this listing. See the property and check its documents before you pay
anything." They take the offer and then abandon the buyer.

Vallo says the same true thing about money, and then **keeps going**: the Deal
Room, the inspection report, the document checklist, the progress tracker, the
next action. That is the whole competitive argument for this feature.

### 4.4 Three things Vallo has that they do not

1. **The inspection report.** Eight items, each with photographs, already
   built, already the record an agreement is drawn from. Attach it to a sale
   Deal Room and the buyer has dated evidence of the property's condition.
2. **The mandate.** `listing_mandates` can show "this agent holds a signed
   sale mandate from the owner, reviewed on <date>, expiring <date>". The
   single biggest fraud in Nigerian property is an agent selling a property
   they have no right to sell. That one line is worth more than the rest of
   the feature.
3. **The Deal Room itself.**

Surface all three. They are the reason to use Vallo instead of WhatsApp.

---

## 5. THE JOURNEY, END TO END

### 5.1 Buyer

1. **Discover.** The listing page, improved: premium gallery, the summary
   facts, the honest price block of 4.2, amenities grouped with "show all",
   the map, the documentation information, the seller or agent card with the
   mandate line, similar listings.
2. **The action area.** A sticky bar whose primary action depends on listing
   kind and the viewer. For sale: **Make an Offer**, with Contact Agent,
   Schedule Inspection, Save and Share. For rent: the existing rental journey,
   never an offer. The action must know the listing status, whether offers are
   enabled, whether the viewer is the seller or the listing's own agent, and
   whether they already have a live offer. Never allow an offer on a
   suspended, unavailable or ineligible listing.
3. **Eligibility.** Checked on the server before the form is usable. Each
   requirement shown with its own state: met, required, in progress, needs
   review. Each actionable one gets a control that goes straight into the
   existing verification flow and **comes back to the offer with everything
   already typed still there.** Requirements are configurable per listing or
   category, not hardcoded for every listing. Never disable submit without
   saying why.
4. **The offer.** Amount (blank means asking price, and the resulting figure
   is shown explicitly before submission, never a zero or null record).
   Payment preference: Cash, Mortgage or Instalment, each revealing only the
   fields it needs. Optional target closing date, labelled proposed. An
   expandable note. Then a summary screen that makes them look at it once
   before it goes.
5. **Submission.** Revalidate everything server-side: the user, the listing,
   eligibility, the amount, the listing's current price and status. Create the
   agreement, its first version and its event, link or reuse the conversation,
   post the structured offer card into it, notify the seller, open the Deal
   Room. **Idempotent**, so a double tap or a retry on a flaky Lagos
   connection cannot create two offers.
6. **Confirmation.** Not a bounce back to the listing. A real page: the offer
   reference, property, amount, payment preference, date, status, who has it
   now, what happens next in plain words, and two actions, View Deal Room and
   Return to Property.
7. **Afterwards.** "My offers" in the buyer's account, and the Deal Room.

### 5.2 Seller and agent

1. **Offers received**, a workspace of its own, grouped and filterable by
   status, with the counts that are actually true.
2. **The offer card**: property, buyer display name, offer, asking price, the
   difference between them, payment preference, proposed closing date, when it
   arrived, how long it has been waiting, unread marker.
3. **The offer detail**: everything needed to decide, and nothing private.
   The buyer's eligibility **outcome** only. **Never** an ID number, never a
   document image, never a date of birth.
4. **Four responses**: Accept, Decline with an optional reason, Counteroffer,
   or Request more information. A counteroffer is a new version, never an edit
   of the buyer's offer.
5. **Accepting** requires confirmation, shows the exact terms being accepted,
   records who and when and which version, and then says plainly what has and
   has not happened. See section 7.

### 5.3 Both

The Deal Room, from the first offer until the deal ends.

---

## 6. THE DEAL ROOM

The feature that makes this worth building.

**Header.** Property thumbnail, name, the two parties, the offer reference,
the current status as a clear state chip.

**Progress tracker.** Offer submitted, Seller reviewing, Negotiation, Offer
accepted, Inspection and due diligence, Documentation, Closing, Completed.
Plus the end states: declined, withdrawn, expired, cancelled, disputed.
**Stages advance on recorded events, never on elapsed time.**

**Sections**, tabs on a phone and a balanced two-column layout on a desktop:

- **Overview**: the current terms, the asking price, who must act next, and
  the one next action as a real button.
- **Negotiation**: every version in order, each showing what changed from the
  one before, who proposed it and when, and which version each party has
  confirmed. This is the spine of the room.
- **Messages**: the existing conversation, in place, not a second inbox.
- **Inspection**: propose, confirm, reschedule, complete, with the eight-item
  report attached once it exists.
- **Documents**: the checklist and the vault, section 8.
- **Activity**: the full event timeline, every entry with person, time and
  action.

**At every moment both parties must be able to answer four questions without
asking anyone**: what has happened, what is waiting, whose turn it is, and
whether there is a deadline. If a screen cannot answer those four, it is not
finished.

---

## 7. WHAT MAY AND MAY NOT BE SAID

This is the part where being wrong is not a design problem.

- **An accepted offer is not a sale.** Not a contract, not a transfer, not a
  completion. The product must never blur them. After acceptance, say what is
  true: the terms are agreed and recorded, and the inspection, the documents,
  the solicitors and the transfer still have to happen.
- **Vallo takes no money for a purchase, at any stage.** No deposit, no
  commitment fee, no "secure this property" payment. The existing payment gate
  already refuses it; do not route around it, and do not create a transaction
  record when an offer is accepted.
- **Vallo never holds customer money.** Enforced by
  `check-valuation-words.mjs` and the custody tests.
- **Never claim a document is verified** because somebody uploaded it.
  Uploaded, reviewed and verified are three different states and the interface
  must show which one applies.
- **Never claim funds are verified.** A buyer choosing Cash has stated an
  intention, nothing more.
- **Never imply Vallo provides mortgages or instalment financing.** The buyer
  is proposing terms to the seller. Vallo is not a lender.
- **Do not mark a property sold because an offer was accepted.** Listing
  availability follows a configured rule and keeps its history.
- **Do not show a verification badge that is not real.**
- The title is **not** verified by Vallo. Say so where a buyer is deciding.

---

## 8. DOCUMENTS AND DUE DILIGENCE

Categories that match Nigerian practice: Certificate of Occupancy, Deed of
Assignment, survey plan, building approval, the agent's authorisation to sell,
governor's consent where relevant, agreement drafts, the inspection report.

States: requested, uploaded, under review, approved, rejected, more
information required. Show the uploader, the time, the version and the
reviewer. Private storage with signed, time-limited access. Never a public
URL. Access is limited to the two parties and authorised staff, and every
access is logged.

---

## 9. SAFETY, FRAUD AND CONCURRENCY

Property fraud is the real risk in this market, and an offer button makes
Vallo look like it is vouching for the property. It is not, and the interface
must say so while still being useful.

Build against: fake sellers and agents, impersonation, an agent without a
mandate, the same property sold twice, altered offer terms, unauthorised
acceptance, replayed requests, and document leakage.

Non-negotiable:

- **Every transition is validated server-side** in a definer function. The
  frontend is never the authority.
- **Acceptance is transactional and takes a lock**, and revalidates the
  listing's current state. Two sellers, or one seller in two tabs, must never
  produce two conflicting acceptances.
- **An expired or superseded version can never be accepted.**
- **A buyer can never change their own eligibility, and never a seller's
  decision. A seller can never change the buyer's identity. An agent can only
  act on listings they hold a mandate for.**
- **Idempotency keys** on every write that a retry could duplicate.
- Rate limits on offer creation.
- Every sensitive action writes an audit event. An authorised correction
  preserves the original and records the correction.
- Admin access to private messages is restricted, justified and audited, using
  the existing Trust and Safety permissions. Not every admin sees everything.

---

## 10. THE ADMIN CONSOLE: OFFERS AND DEALS

Inside the existing console, with the existing RBAC and step-up MFA. Not a
second admin app.

Overview with real metrics only, each with a stated definition: submitted,
new, awaiting seller, negotiating, accepted, withdrawn, expired, completed,
disputed, median response time, acceptance rate against an explicitly defined
population. **Never present the value of accepted offers as Vallo revenue.**
Vallo does not receive that money.

A powerful table with the columns and actions his specification lists, deal
inspection under policy, intervention that cannot rewrite agreed terms, and
disputes routed to the right desk through the existing case system.

---

## 11. THE DESIGN DIRECTION

His words: premium, 2030, clean, confident, elegant, intelligent, serious.
Translated into what you actually build.

- **Both themes, properly.** Dark neon blue is the default (page about
  `#000612`, cards `#040a20`, raised `#0b1838`, action about `#0066FF`), light
  when chosen. Every state chip, table, sheet, timeline and empty state is
  designed twice and checked twice.
- **Use the Grade 1 kit.** PageFrame, StepFrame, the sheet, the banner, the
  doc cards and tables. This feature must not invent its own language. If
  something is missing from the kit, add it to the kit.
- **Money is typeset, not just printed.** The offer, the asking price and the
  difference between them are the most important numbers on the screen and
  should read instantly. Tabular figures, the naira sign never orphaned, the
  difference shown as both an amount and a percentage, coloured by direction
  but never only by colour.
- **State is a chip with a word**, not a colour alone. Negotiating, Awaiting
  you, Accepted, Expired. Colour supports the word.
- **The next action is always one obvious button.** If a member has to work
  out what to do next, the screen has failed.
- **Motion with a job**: a version joining the timeline, a sheet rising, a
  stage advancing, a counteroffer landing. Brief, and it respects reduced
  motion.
- **Mobile first and genuinely finished**: bottom sheets, sticky actions that
  never cover content, safe areas, the keyboard handled, no horizontal
  overflow, large touch targets, long forms that are pleasant on a phone.
- **Desktop is not a stretched phone.** The seller's inbox and the admin desk
  are real workspaces with tables, filters and keyboard support.
- **Every empty, loading, offline and error state is designed.** A buyer with
  no offers yet should see an invitation, not a blank.
- Avoid what he listed: too many gradients, everything rounded, clutter,
  border soup, overloaded dashboards, tiny text, inconsistent buttons, and
  anything that looks generically generated.

---

## 12. THE DOCUMENTATION THIS FEATURE OWES

Nothing here is finished until it is explained. This builds on
`DOCS_AND_PRESENCE_UPGRADE.md` and uses the same document kit.

Write, in the member documentation:

- **How offers work on Vallo**, for buyers: what an offer is, what it is not,
  what happens after you send one, what Vallo does and does not do.
- **How to make an offer**, a step guide with real captured screenshots of
  each step, the way the reference does it.
- **Receiving and answering offers**, for sellers and agents.
- **Counteroffers and negotiation**, with a worked example and the figures.
- **The Deal Room explained**, section by section.
- **Inspections and due diligence.**
- **Documents: what to ask for, and what Vallo has and has not checked.**
- **Fees and what you will actually pay**, honest, and reading real
  configuration.
- A page in the **staff manual** for the Offers and Deals desk.

Every one of those pages carries **buttons into the product**: "Make an
offer", "Open my offers", "Start verification", "Open the Deal Room". A member
reading a guide should be one tap from doing the thing. That is the founder's
instruction and it applies to every document, not only these.

Screenshots come from the capture harness, both themes, never hand-taken.

---

## 13. THE PLATFORM-WIDE DOCUMENTATION SWEEP

The founder's separate instruction, in his words: an agent goes wide across
the platform, finds everything that exists but is not documented, and
documents it, with how it works and how the flow goes.

Give this to one agent as its own job.

1. **Inventory.** Walk `PAGE_LEDGER.md`, the route table and the admin desks,
   and list every feature a member or a staff member can meet.
2. **Compare** that list with the documentation that exists after the docs
   upgrade.
3. **Write the gap list** to `docs/handoff/DOCS_COVERAGE.md`: every feature,
   whether it is documented, where, and whether what is written is still true.
4. **Then write the missing pages**, in the document kit, in both themes,
   each with: what it is, who it is for, how to reach it in the platform, the
   flow step by step with captured screenshots, what can go wrong, and the
   buttons that take the reader to it.
5. **Correct what is stale.** Where a document and the code disagree, the code
   is right and the document is fixed. Record what changed.
6. **Leave the check behind.** A test that fails when a route exists in the
   ledger with no documentation entry, so this never rots again.

Do not let this agent write into the same files as the offers work. Split by
path before you start.

---

## 14. BUILD ORDER

All of it ships, but in this sequence, because each step depends on the one
before.

1. **Audit.** Confirm every claim in section 2 against the source, and write
   what you find to `docs/handoff/OFFERS_AUDIT.md`. Show the founder before
   writing code.
2. **Database.** `kind = 'sale'`, the two new statuses, the sale guard on
   `paid`, `deal_documents`, indexes, RLS, the definer functions for every
   transition. Into `supabase/migrations/pending/`, never applied by you.
3. **Server.** Eligibility, create, counter, accept, decline, withdraw,
   expire, documents, stage transitions. Transactional, locked, idempotent,
   audited.
4. **Design pass.** The whole journey, both themes, both form factors, before
   the screens are built. Show the founder.
5. **Buyer side**: listing action area, eligibility, the offer flow,
   confirmation, My offers.
6. **Seller side**: Offers received, the detail view, the four responses.
7. **The Deal Room**, every section.
8. **Messaging integration**: structured cards, system events, access rules.
9. **Inspections and documents** inside the room.
10. **Admin Offers and Deals**, metrics, table, intervention, disputes.
11. **Notifications and emails**, every template, linked to the right place,
    deduplicated, respecting preferences.
12. **Background jobs**: expiry, reminders, stale-offer nudges.
13. **Documentation**, section 12, and the sweep, section 13.
14. **Tests**, section 15.

---

## 15. TESTING

Run them. Never report a test as passing that you have not executed.

The buyer journey including the verification detour and the preserved form.
Cash, Mortgage and Instalment. Invalid amounts and missing requirements. The
seller journey for all four responses. A full negotiation with three versions,
checking the history survives and the agreed terms are right. Messaging access
rules, including that a stranger cannot reach a Deal Room. Expiry. Withdrawal.
Admin permissions, including that a support role cannot change terms.

**Concurrency, which is the one that will actually bite you**: two acceptances
at once, a double-tapped submission, accepting an expired version, and a
listing that changes status mid-transition.

---

## 16. DONE MEANS

Every part of the founder's specification is built, not mocked. The whole
journey works end to end on a phone and on a desktop, in both themes. No
screen claims Vallo holds money, verifies title, or has completed a sale.
Multiple offers on one listing behave correctly. Acceptance is safe under
concurrency. Private identity data never reaches a seller. Documents are
private and signed. The admin desk is inside the existing console with the
existing permissions. Every feature has documentation with real screenshots
and buttons into the product. The coverage sweep is done and the check is in
place. All the gates pass, CI is green, and the SQL is in `pending/` as one
ordered block for the founder with a line each on what it does and how to roll
it back.
