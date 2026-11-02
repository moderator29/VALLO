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
