# Manual verification on Vallo

Written 2 November 2026. The founder's decision: verify people by hand for
now, free, the way the big platforms do it. Dojah is built and parked for
later (`docs/identity/DOJAH.md`).

## Who verifies

Only people who list property or get paid: agents, landlords, owners, hosts
and firms. Renters and buyers are never asked.

## The member's flow (`/verification`)

1. **Your ID.** A photo of a passport photo page, driver's licence, NIN slip or
   card, or voter's card. They say which one it is.
2. **A quick selfie.** A live photo of the face, taken with the front camera
   inside an oval guide. Nobody is asked to hold their ID up (most people do
   not have it in hand). If the browser will not give a camera, the phone's own
   camera opens instead.
3. **Where you live.** A utility bill, bank statement or tenancy agreement dated
   in the last three months, with its date.
4. **Do you run a property business?** If yes, the CAC name, number and contacts.
5. **Permissions.** Three separate agreements (documents are theirs and
   accurate, terms, processing for identity and fraud checks).
6. **Check and send.** Nothing is filed until they press Send for review.

Then: "What happens next": a person checks the ID, selfie and address within a
working day; and, for a lister, **add the bank account you are paid into**. The
name on that account is checked against the ID automatically through Paystack.

All three files go to the private `agent-documents` bucket under the person's
own folder and are filed in one insert. The reviewers are notified once.

## The reviewer's desk (`/admin/kyc`)

Only admins and staff holding the `kyc_review` scope (positions: KYC reviewer,
Trust and Safety lead, Compliance officer) can open it, and nobody can decide
their own documents. Each person shows:

- **Identity at a glance**: their ID beside their selfie (streamed from our own
  origin, never a public link, every view logged), the name given at sign-up,
  the name on their application, the name printed on the ID, and the bank
  account name with "matches" or "differs".
- **The checklist**, and a link to the full **reviewer guide**
  (`/admin/kyc/guide`): the flow, what to check on each document, the name
  rules, words for sending something back, when to book a video call, how to
  report suspected fraud without tipping off, and the privacy rules.
- **Each document** with Approve or Reject (a reason the person is sent word
  for word). Approving an ID needs the name exactly as printed on it.

The Verification menu row carries a count of documents waiting.

## When a reviewer does not trust it: one more photo

Never a step of the flow (most people do not have their ID in hand). Only for
a person the reviewer cannot confirm:

1. On the person, the reviewer presses **Ask for a selfie holding their ID**
   and writes why (a starting sentence is filled in to edit).
2. The person is notified with those words, and finds the request at the top
   of `/verification`: the message, the same camera, and **Send to our team**.
3. The photo comes back to the desk as **Selfie holding their ID (asked for)**,
   in place of the selfie in doubt. Approving it as the same person completes
   the identity step; rejecting it sends the reason back as usual.

One open request per person; nobody can ask about themselves; the photo must be
in the person's own folder. Database: `verification_requests`,
`request_selfie_with_id` (staff), `answer_verification_request` (the person),
`agent_documents.request_id`.

## What a decision does (database)

`public.review_kyc_document` (wrapper) and `private.review_kyc_document`:

- The identity step is the ID **and** the selfie. When every current ID and
  selfie document is approved, the person's identity is confirmed: one matched
  `identity_verifications` row (method `photo`, "Identity document seen by
  Vallo") carrying the name on the ID, for **everyone**, not only agents. Agents
  also get the identity rung on their ladder, which earns the Verified badge.
- The address step passes when every current address document is approved.
- The payout step passes on its own when the bank's account name matches
  (`verify_payout_account`, Paystack resolve), and waits for a person when not.
- Every decision writes `audit_log` and notifies the person.

`public.set_document_name` stores the reviewer-typed name on the ID
(`agent_documents.name_on_document`). The payout name match prefers it.

## Still to run in the SQL editor

`docs/sql-editor/05-staff-alert-on-new-documents.sql`: the staff alert when
documents arrive (the connector stopped for approval on its `drop trigger`
line). The desk fix found on 2 November 2026 (the review function assigned
text to the `review_status` enum, so every Approve and Reject had failed since
25 September 2026) is applied: migration
`20261102223038_manual_kyc_3_desk_decisions_cast`.

## Cost

Nothing per check. The bank account name check uses Paystack's free account
resolve. Video calls for doubtful cases use Vallo's own call system.

## Later

- A staff-only "check this NIN" button for doubtful cases only (one paid lookup).
- Dojah's full selfie + NIN/BVN check when there is budget: one flag and five
  environment variables (`docs/identity/DOJAH.md`, section 5).

## Platform Grade 1 (November 2026): the flow and the gate

**The flow.** `/verification` now opens on an intro card ("Verify your
identity": what you will need, that documents are private, about five
minutes, one working day for a decision) with one Start button. Start opens
the same steps as before (ID, live selfie, address, business, agreements,
review) as full-screen pages on the shared `StepFrame`
(`components/ui/StepFrame.tsx`, `overlay`): a section eyebrow, the step's
object, the title and hint, Back, Close (which keeps every answer and returns
to the intro), a progress bar and "Step N of M" with Continue. The review
step has a Change button on each row that jumps back to that step. Nothing
about what is uploaded, filed or reviewed changed.

**The gate (verified before a deal).** `submitListing`
(`lib/agent/listings-actions.ts`) refuses a lister whose identity is not on
file with `gate: "verification"` and a button to `/verification`
(`components/app/VerifyGateLink.tsx`). The rule
(`lib/identity/listing-verification-rule.ts`): verification tier 1 or more, or
an identity document that is pending or approved, passes; nothing on file or
only refused documents is refused; QA accounts are never asked; a failed read
refuses with a try-again sentence. The listing still publishes only on
approval. The wizard's last step shows "1 thing to fix" before Send when the
gate would refuse (`verifyFirst`, read in `app/agent/list/page.tsx`).

**The switch.** `feature_flags.listing_verification` set to false turns the
gate off with no deploy (flags fail open: no row means on).

## Grade 1, part 2 (7 November 2026): country, document, front and back

The ID part of the flow is now three screens instead of one:

1. **Which country issued your ID?** (`CountryPicker`): search, Popular
   (Nigeria, Ghana), every country with its flag. Stored as
   `agent_documents.issuing_country` (ISO alpha-2).
2. **Which document will you use?** (`OptionCards`): Nigeria offers NIN slip or
   card, international passport, driver's licence, permanent voter's card;
   every other country offers passport, national ID card (`national_id`, a new
   `document_subtype` value), driver's licence.
3. **Photograph your ID** (`IdCapture`, once per side): a live rear camera with
   a card guide and a rotate control, or Upload instead; then Check your
   capture (Zoom in, Retake, Use photo). The back is required for a driver's
   licence, a voter's card and a national ID card, optional for a NIN card,
   never asked for a passport. Stored as `agent_documents.back_storage_path`
   on the same row; the database refuses a back outside the uploader's folder.

The review shows each photo with a Captured badge and Retake, the document and
the country with Change, and a "Final step: nothing is sent yet" notice.

**Reviewers.** "Identity at a glance" shows the back beside the front and the
selfie, and the issuing country in the ID's caption. The back is streamed by
the same staff-only route (`/api/documents/<id>?side=back`) and every view is
written to the audit with `side: back`. The checklist names the back.

**Migration.** `20261107143359_grade1_verification_country_and_back_of_id`
(applied; additive and nullable).
