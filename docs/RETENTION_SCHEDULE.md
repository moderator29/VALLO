# Data retention and destruction schedule

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

**Controller:** VALLO SPACES LTD, Plot 5, Zone 6, Dutse Alhaji, Bwari Area
Council, Federal Capital Territory, Abuja.
**Instrument:** Nigeria Data Protection Act 2023, storage limitation.
**Written:** 14 September 2026. **Status: DRAFT, not yet approved.**

This is the schedule required by `HANDOFF_01` section 4.3. It exists so that
`HANDOFF_02` implements a decision rather than inventing one. Nothing here is
code yet, and no period below should be written into a migration until the
founder has approved the schedule and the solicitor has confirmed the four
questions in section 7.

---

## 1. Why this document exists

The privacy notice states that personal data is kept only as long as it is
needed. **Most of it is not enforced.** Since this was written, two periods
have become mechanisms: the account purge (`/api/cron/account-purge`, daily)
and the price-check events sweep (`vallo_sweep_price_check_events`), described
in the later sections below. Every other period the notice promises, including
the case below, is still a sentence rather than a mechanism (checked 23
September 2026 against `cron.job` and `apps/web/vercel.json`).

The sharpest case is the one that names a real person: an applicant who applied
to become an agent, uploaded a government identity document and a NIN, and was
rejected. Their document is still in the `agent-documents` bucket and their ID
number is still in `public.agent_applications.id_number`. The lawful basis for
holding it was the assessment of their application. **That basis expired when
the decision was made.** Everything after that is storage without a basis, which
is the single most legible finding an NDPC auditor can make, because the record
carries its own timestamp of when the basis ended.

---

## 2. The principle, in one line

Every category of personal data has a **trigger** (the event that starts the
clock), a **period** (how long after the trigger it is kept), and a **disposal
action** (what happens at the end). A category with no trigger is a category
kept forever, and that is the defect.

Three disposal actions, and they are not interchangeable:

| Action | What it means |
| --- | --- |
| **Purge** | The row or object is deleted. Nothing recoverable remains |
| **Redact** | The record survives, the personal fields are overwritten. Used where a financial or audit record must keep its shape but not its subject |
| **Anonymise** | The link to a person is severed irreversibly. The data stays, the subject does not |

"Anonymise" is only honest if re-identification is genuinely impossible. A
"deleted" row whose `user_id` still resolves is redacted, not anonymised, and
must be described as such in the notice.

---

## 3. The schedule

Periods marked **[C]** are driven by a legal obligation to keep data, and are
floors: the data may not be destroyed earlier. Periods marked **[L]** are
limitation periods chosen by the company, and are ceilings: the data must not be
kept longer. Where both apply, the obligation wins and the ceiling starts when
the obligation ends.

### 3.1 Agent verification, the category that carries the risk

| Data | Where it lives | Trigger | Period | Action |
| --- | --- | --- | ---: | --- |
| Identity document, NIN slip, business registration document | `agent-documents` bucket, path on `public.agent_documents.storage_path` | Application reaches `REJECTED` and the appeal window closes | **30 days [L]** | Purge |
| `id_type`, `id_number`, `residential_address`, `bank_name`, `account_number`, `account_name` | `public.agent_applications` | Same | **30 days [L]** | Redact, keep the row |
| The application row itself, minus the redacted fields | `public.agent_applications` | Same | 2 years [L] | Purge |
| Identity document for an `APPROVED` agent | `agent-documents` bucket | The agent relationship ends, by account closure or termination | **5 years [C]** | Purge |
| `id_number` and payout details for an approved agent | `public.agent_applications`, `public.payout_accounts` | Same | **5 years [C]** | Redact |
| HMACs of the NIN, phone numbers and payout accounts of a person whose stop was upheld as fraud (V-90); never the values | `private.identity_denylist` | The stop is lifted, or the stop row is deleted | **While the upheld stop stands [L]** | Purge, automatically when the stop lifts |
| Application abandoned at `DRAFT`, never submitted | `public.agent_applications`, `agent-documents` | Last update to the row | 12 months [L] | Purge, row and objects |

**The 5 year figure is the anti money laundering floor, not an NDPA period.**
Real estate is a designated non-financial business under Nigeria's AML regime
and customer identification records must be retained for a period after the
business relationship ends. That obligation is what makes an approved agent's
document different from a rejected applicant's.

**A rejected applicant never became a customer.** No business relationship was
established and no transaction occurred, so the AML retention floor does not
attach to them, and the storage limitation principle is the only rule left. This
is the pivot the whole schedule turns on and it is question 1 for the solicitor
in section 7.

### 3.1a Sanctions screening (SCUML items 8 and 9)

| Data | Where it lives | Trigger | Period | Action |
| --- | --- | --- | ---: | --- |
| Every screening, clean ones included, with the names screened and the list versions used | `public.sanctions_screenings` (append-only) | The screening | **5 years [C], at least** | None: no purge job touches it. `person_id` is a plain uuid, so account deletion leaves it standing |
| Matches and their two-person decisions | `public.sanctions_hits`, `public.sanctions_hit_decisions` | The decision | **5 years [C], at least** | None |
| Loaded list versions and their entries | `public.sanctions_list_versions`, `public.sanctions_entries` | Superseded by a newer version | **5 years [C]**, because a screening names the version it used | None |
| The screening queue | `public.sanctions_screen_queue` | Screened (`done_at` set) | Working data | May be purged once done; it is not the record |

These are AML records (Money Laundering (Prevention and Prohibition) Act 2022),
not NDPA personal data kept for convenience: the Act's five year floor wins, and
deleting an account anonymises the person elsewhere without deleting them.

### 3.2 Account and profile

| Data | Where it lives | Trigger | Period | Action |
| --- | --- | --- | ---: | --- |
| Name, email, phone, language and theme preference | `auth.users`, `public.profiles` | Account closure | 30 days [L] | Purge |
| Avatar image | `avatars` bucket | Account closure | 30 days [L] | Purge |
| Social profile, handle, posts, stories, comments, reactions | `public.social_profiles`, `public.posts`, `public.stories` and related | Account closure | 30 days [L] | Purge or anonymise, see 5.2 |
| `story_views`, `post_views` | `public.story_views`, `public.post_views` | Row creation | 90 days [L] | Purge |
| Sign-up step counts (A6): step, locale, surface, door, a random visit id, and an account only on the steps after verification | `public.funnel_events` (migration `20260930084814`) | Row creation | 90 days [L] | Purge, nightly by `vallo_purge_funnel_events` |

The 30 day window exists so that an account closed in error can be restored. It
must be stated in the notice if it is adopted, because during those 30 days the
data is still held and the notice currently implies it is not.

### 3.3 Financial records

| Data | Where it lives | Trigger | Period | Action |
| --- | --- | --- | ---: | --- |
| Bookings, reservations, refunds | `public.bookings`, `public.reservations`, `public.booking_refunds` | Booking completion or cancellation | **6 years [C]** | Redact the subject, keep the record |
| Ledger entries, transactions, Guarantee reserve entries | `public.ledger_entries`, `public.transactions`, `public.guarantee_reserve_entries` | Entry date | **6 years [C]** | Redact, never purge |
| Retired custody records: wallets, wallet entries, pots, escrows and their evidence and rulings (retired 25 September 2026, reachable by no app role) | `retired_custody.wallets`, `retired_custody.wallet_entries`, `retired_custody.wallet_pots`, `retired_custody.escrows`, `retired_custody.escrow_evidence`, `retired_custody.escrow_rulings`, `retired_custody.escrow_float_snapshots` | Entry date | **6 years [C]** | Redact, never purge. Kept as money records |
| Platform revenue, fee rates | `public.platform_revenue`, `public.fee_rates` | Entry date | **6 years [C]** | Keep, no personal data |
| Tenancy evidence: the rent charge, the move-in quote, the promise snapshot, the caution register (obligation, deductions, answers, returns), the move-in and move-out reports and their photos, and pins | `public.rent_payments`, `public.move_in_quotes`, `public.tenancy_snapshots`, `public.caution_obligations`, `public.caution_deductions`, `public.caution_deduction_answers`, `public.caution_returns`, `public.tenancy_reports`, `public.tenancy_report_items`, `public.tenancy_report_photos`, `public.tenancy_pins`, the `tenancy-evidence` bucket, the viewing report (`public.inspection_report*`) of the inspection behind the charge | **Tenancy end** (move-in plus one rent period) | **6 years [C]** | Keep until tenancy end plus six years, then redact the subject. V-47 |
| Refund requests | `public.refund_requests` | Booking completion or cancellation | **6 years [C]** | Redact the subject, keep the record. V-24 |
| Threshold reports (SCUML item 7): the monitor's observations, the reportable events, the officer's decisions and the second approvals, and the reminders sent | `public.aml_ledger_observations`, `public.threshold_events`, `public.threshold_decisions`, `public.threshold_approvals`, `public.threshold_reminders` | Entry date | **At least 5 years (SCUML item 11)** | Never purged and never edited: triggers refuse update, delete and truncate. A party is a plain uuid, so an account deletion anonymises the person and leaves the record whole |
| Mandates and the principal's identity record (name, number, relationship, how, when and by whom they were confirmed, the ID document's kind and reference; never a NIN) | `public.listing_mandates` | The later of the listing closing (`listings.closed_at`) and the mandate being refused | **5 years [C]** | Keep. No delete reaches a mandate, directly or by cascade from its listing or agent, until five years after the later of the two. A listing that never went live and never had a mandate approved may be deleted with its mandates, and its waiting or refused mandates are purged five years after they were last touched (`purge_stale_mandates`, 20260924171200) (`listing_mandates_kept_five_years`, `listings_keep_their_mandates`). An agent's account deletion strips the agent's name and keeps the mandate. A mandate replaced by a renewal is kept, marked `superseded_at` (20260924171100). SCUML item 17 |

**Tenancy evidence runs from the end of the tenancy, not from the payment.**
A multi-year tenancy is argued about years after the move-in money moved, and
six years is the ordinary limitation period for a contract claim. A message
either party pinned to the tenancy (`public.tenancy_pins`) is tenancy evidence:
any message purge must ask `private.message_is_tenancy_evidence(message_id)`
and skip a message for which it answers true, whatever the three-year thread
rule in 3.4 says.

**A ledger is never purged.** Company accounting records carry a statutory
retention period and a financial record with a hole in it is worse than one that
names a person. The disposal action here is always redaction of the subject,
never deletion of the entry. Confirm the exact period with the solicitor,
question 2 in section 7.

### 3.3a AML/CFT due diligence records (SCUML items 20 and 15)

| Data | Where it lives | Trigger | Period | Action |
| --- | --- | --- | ---: | --- |
| PEP answers, staff's PEP record and the approvals of taking somebody off it | `public.pep_declarations`, `public.pep_flags`, `public.pep_clear_approvals` | Date recorded | **5 years [C]** | Keep; on account deletion the record stays against the tombstoned account |
| Enhanced due diligence reviews, decisions and approvals | `public.edd_reviews`, `public.edd_decisions`, `public.edd_approvals` | Date recorded | **5 years [C]** | Keep; the same on deletion |
| Risk class history and the approvals of a class lowered by hand | `public.risk_classes`, `public.risk_override_approvals` | Date recorded | **5 years [C]** | Keep; the same on deletion |

**AML retention wins over minimisation for these.** The Money Laundering
(Prevention and Prohibition) Act 2022 and the SCUML checklist ask for five
years of due diligence records, reconstructable. Every table above is append
only (`private.aml_append_only` refuses an edit or a delete) and no purge job
touches it. Account deletion does not delete the `auth.users` row: the purge
(20260919160100) strips it to a tombstone, a uuid with no address, telephone,
name or password, banned for ever. So the uuid on these records stays and
resolves to an anonymous account: the person is gone, and the record of what
was checked, by whom and when, still points at one distinct subject. (The
foreign keys are ON DELETE SET NULL, and the guard allows that one change, only
for the case where an auth row is ever deleted outright.) A disposal job after
five years is not written yet; until it is, nothing here is deleted early.

### 3.4 Communications and support

| Data | Where it lives | Trigger | Period | Action |
| --- | --- | --- | ---: | --- |
| Messages, conversations | `public.messages`, `public.conversations` | Last message in the conversation | 3 years [L] | Purge, except a message pinned to a tenancy (3.3) |
| Message attachments | `public.message_attachments` rows and the `message-attachments` bucket | Last message in the conversation | 3 years [L] | Purge, objects before rows |
| Flagged messages and the reason for the flag | `public.message_flags` | Flag resolution | 3 years [L] | Purge |
| Support tickets and their replies | `public.support_tickets`, `public.support_ticket_messages` | Ticket closure | 3 years [L] | Purge |
| Reports and risk alerts | `public.reports`, `public.risk_alerts` | Resolution | 3 years [L] | Purge |
| Assistant conversations | `public.ai_conversations`, `public.ai_messages` | Last message | 12 months [L] | Purge |

Messages get the longer period because a dispute over a booking is argued from
them, and a report of harassment is evidenced by them.

### 3.5 Operational and technical

| Data | Where it lives | Trigger | Period | Action |
| --- | --- | --- | ---: | --- |
| Admin action audit trail | `public.audit_log` | Entry date | 6 years [C] | Keep. See the note below |
| Suspicious Transaction Report cases, links, decisions, approvals and the goAML register (SCUML item 6, MLPPA 2022) | `private.str_cases`, `private.str_case_links`, `private.str_decisions`, `private.str_approvals`, `private.str_register` | The filing, or the approved decision not to file | 5 years [C] | Keep. Append-only by trigger; account deletion does not reach them (no foreign key to the account) |
| Rate limit counters | `public.rate_limits` | Entry date | 30 days [L] | Purge |
| Idempotency records | `public.idempotency_records` | Entry date | 90 days [L] | Purge |
| Notifications | `public.notifications` | Read, or creation if never read | 12 months [L] | Purge |
| Places cache | `public.places_cache` | Entry date | Per the provider's terms | Purge |
| Application and error logs | The hosting provider | Entry date | 90 days [L] | Purge |
| Price Check funnel rows | `public.price_check_events` | Entry date | 24 months [L] | Purge |
| A watched Price Check spot | `public.price_check_watches` | The watcher's account closes | Cascade | Purge |

**`price_check_events` holds a five character geohash and never a point, and
that is why 24 months is a defensible period rather than a long one.** The
table exists to answer where people are asking, where demand is outrunning
supply, and which areas to recruit in next, and every one of those questions
needs a year-on-year comparison to mean anything. It carries no address, no
coordinate and no free-text hint: there are no such columns, which is the
enforcement rather than a rule somebody has to remember. The cell is roughly
five kilometres across at Nigerian latitudes, measured in
`apps/web/src/lib/price-check/geohash.test.ts` rather than asserted. The purge
is run rather than written down: `private.sweep_price_check_events` is
scheduled nightly in `cron.job` as `vallo_sweep_price_check_events`, because a
retention period nothing enforces is a sentence in a policy.

**The audit log is the one table that must never be purged on a user's
request.** It is the record that proves the company did what it says it did,
including that it honoured a deletion. An audit row must therefore never contain
the personal data it describes: it references a subject, it does not reproduce
one. That is a constraint on how audit rows are written, and it is checked in
section 6.

---

## 4. The rejected applicant purge, specified

This is the first thing `HANDOFF_02` builds from this document.

**Trigger.** `agent_applications.status = 'REJECTED'` and
`reviewed_at < now() - interval '30 days'`.

**The appeal window is 30 days from `reviewed_at`**, and it is a business
decision, not a legal one. It needs the founder's approval before it is coded.
Thirty days is proposed because it matches the adjustment window the company
already uses elsewhere and because it is long enough that a rejected applicant
who wants to correct a document has not lost the chance.

**What the job does, in order:**

1. Select applications matching the trigger
2. For each, list its `agent_documents` rows and delete the objects from the
   `agent-documents` bucket **by storage path**
3. Delete the `agent_documents` rows
4. Overwrite `id_type`, `id_number`, `residential_address`, `bank_name`,
   `account_number`, `account_name` on the application with null
5. Write one `audit_log` row per application, recording the application id, the
   count of objects destroyed and the timestamp, **and no personal data**
6. Mark the application so the job never reprocesses it

**Step 5 is not optional.** Deleting personal data silently is its own problem:
the day somebody asks the company to prove it destroyed their document, an
absence of evidence is indistinguishable from an absence of deletion. The audit
row is the proof and it is the reason this is a purge rather than a delete.

**Step 2 before step 3, and never the reverse.** Delete the row first and the
storage path is gone, the object is unreachable, and the identity document stays
in the bucket forever with nothing pointing at it. That is the exact failure
described in section 5.1 below, arriving by a different route.

**Mechanism.** `pg_cron`, which is already running six jobs in this database, so
nothing new has to be stood up. Nightly is frequent enough for a 30 day window.

---

## 5. What account deletion leaves behind, audited

Section 4.3 of `HANDOFF_01` says nobody has audited this. This is that audit,
read from the code and the migrations. **It is a reading of the source, not a
test run against a live database**, and each finding should be confirmed against
the real project before it is relied on.

### 5.1 Storage objects survive the cascade. This is the significant one

`apps/web/src/lib/profile/actions.ts` deletes an account by calling the Supabase
auth admin API, which removes the `auth.users` row. The database cascade then
runs: `agent_applications.user_id` references `auth.users` with
`on delete cascade`, and `agent_documents.application_id` references
`agent_applications` with `on delete cascade`, so both rows go.

**The objects in the `agent-documents` bucket do not.** `storage.objects` has no
foreign key to `auth.users` and no trigger in any migration deletes from it. I
searched every migration for a storage cleanup trigger and found none; the only
delete rules on `storage.objects` are RLS policies, which govern who may delete
an object, not what happens when a user disappears.

So a person who uploads a government identity document and then deletes their
account leaves the document in the bucket, with the row that recorded its path
now gone. It is unreachable through the application and undeletable through it
too, because the only handle on it was the row. **That is worse than the
retention gap this schedule was written for**, because it has no expiry at all
and no record that it exists.

**The same hole exists in every bucket, not only this one.** There are six:
`agent-documents`, `avatars`, `listing-photos`, `message-attachments`,
`social-covers` and `social-media`. None of them is reached by a cascade. The
identity documents are named first because they are the most sensitive, but an
account deletion today leaves that person's avatar, their listing photographs
and their message attachments behind as well.

The fix belongs with the purge job: the same "objects first, row second"
ordering, applied on account deletion rather than on rejection. It is specified
here because the purge and the deletion path must use one routine, not two, and
because that routine has to cover all six buckets.

### 5.2 Content authored by a deleted user

Posts, stories, comments, reactions and reviews are owned rows and will cascade
if their foreign keys are declared that way. **I have not verified the cascade
behaviour of every social table**, and the answer changes what the notice should
say: content that survives its author must be anonymised and the notice must say
so, and content that vanishes takes a conversation's other half with it. This
needs a table by table check before the notice's deletion sentence is finalised.

### 5.3 The deletion path has a null in a user-facing string

`DELETE_GATED_MESSAGE` and `DELETE_FAILED_MESSAGE` in
`apps/web/src/lib/profile/actions.ts` interpolate `SUPPORT_EMAIL` directly.
`SUPPORT_EMAIL` is `string | null` and its own module documents that **null is
the normal case today**. With no mailbox configured, a person who tries to
delete their account is told to email `null`.

`SUPPORT_SENTENCE` exists in the same module for exactly this and reads "open the
contact form" when there is no mailbox. This is a one line fix, it is a
`HANDOFF_02` task, and it matters here because the string appears on the
account deletion path, which is an NDPA rights channel. A rights channel that
prints `null` is a rights channel that does not exist.

---

## 6. What must be true before any of this is coded

1. The founder approves the periods in section 3, particularly the 30 day appeal
   window in 3.1 and the 30 day account closure window in 3.2
2. The solicitor confirms the four questions in section 7
3. The privacy notice is reconciled with this schedule. **The notice must not
   promise a period this schedule does not enforce**, and it currently describes
   retention in general terms only. Once the periods are approved, section 7 of
   the notice states them
4. Every audit row written by a purge job is checked to contain no personal
   data, per the constraint in 3.5
5. The purge runs in a staging project first, against seeded rejected
   applications with real file objects, and the bucket is inspected afterwards.
   **A purge job that is wrong destroys data that cannot be recovered**, so this
   is the one job that does not go to production on a code review alone

---

## 7. Open questions for the solicitor

These are the four points where I could not verify the answer and where getting
it wrong is expensive. Each is phrased so it can be sent as written.

1. **Does the AML customer identification retention obligation attach to a
   rejected agent applicant**, who never entered a business relationship and
   never transacted, or only to an onboarded agent? Section 3.1 assumes only the
   latter, and the whole rejected applicant purge depends on that reading
2. **What is the correct retention period for company accounting records**
   under CAMA 2020 and the FIRS rules, and does it run from the transaction or
   from the end of the financial year in which it fell? Section 3.3 uses 6 years
   from the transaction as a working figure
3. **Is a 30 day appeal window defensible** for a rejected agent application, or
   does any Nigerian rule set a longer minimum before an applicant's submitted
   documents may be destroyed?
4. **Does redaction satisfy a deletion request** against a financial record the
   company is separately obliged to keep, and what exactly should the notice
   tell a person who asks for deletion of a booking they paid for?

**I have not verified the statutory periods cited above against the text of the
Acts.** They are the working figures this schedule is built on and they are
named so the solicitor can correct them. Nothing in section 3 marked **[C]**
should be coded until he has.

---

## 8. Review

This schedule is reviewed when a new category of personal data is added, and in
any case annually alongside the NDPC compliance audit. The person accountable
for it is the Data Protection Officer, who is the founder until somebody is
appointed.
