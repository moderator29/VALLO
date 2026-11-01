# VALLO AI Assistant

Phase 1 (1 November 2026): the enforcement layer, the settings, the consent
flow and the four public documents. Phase 2 (private tools, interactive
cards, viewing and payment proposals) builds on it.

## Status you need to know

- **The database migrations are applied and recorded** (`20261101105206_ai_assistant_enforcement`,
  `20261101105455_ai_assistant_proposals`). Revoking is a soft state (`revoked_at`) and
  clearing preferences scrubs them in place, because the connector asks a human to approve
  any SQL that deletes and nobody can see that prompt. Probes: `supabase/tests/probes/ai-assistant-*.sql`.
- **Counsel should review the four documents** in `lib/legal/ai-assistant.tsx`
  before they are relied on. They describe product behaviour; they are not a
  substitute for legal review.

## Shape

- Off by default. `ai_assistant_activate` needs both acceptances and the current
  versions (`2026-11-01`); the sensitive permissions (transactions, wallet
  balance, payment help) are never granted at activation.
- Every grant, revoke and audit write is a SECURITY DEFINER function reading
  `auth.uid()` itself; the tables are read-only to members under RLS.
- `lib/assistant/access.ts` is the server layer; tools declare `requires` and
  are hidden by `toolsFor` and checked again by `runTool` against the database.
- Granting a sensitive permission also needs an unlocked Vallo session
  (`passcodeMoneyRefusal`).
- Eight refused requests in ten minutes switch the assistant off for that
  member and raise a medium risk alert.
- Settings: `/settings/ai-assistant`, `/settings/ai-assistant/consent`.
  Public documents: `/ai/terms`, `/ai/privacy`, `/ai/permissions`, `/ai/security`.

---

## Phase 2: tools, proposals, interactive answers (1 November 2026)

### The rule

**Tools read or propose. They never write.** Anything consequential (a viewing, a
save, a payment) is a PROPOSAL the member approves with a button. The button calls a
server action that re-checks the person, the assistant being on, the permission and
the proposal, and only then runs the code the app already had for that job.

### Database (applied, recorded: `20261101105455_ai_assistant_proposals`)

`ai_proposal_create(kind, payload)`, `ai_proposal_decide(id, decision, hash)`,
`ai_proposal_result(id, result)`, `ai_proposal_retry(id)`, all SECURITY DEFINER, owner
only. A proposal is bound to a sha256 of its payload (computed in the database),
expires in ten minutes, is decided once, remembers the `grant_epoch` it was made under,
and fails closed if the permission was taken back or the assistant switched off since.
Twenty open proposals per member at most; older ones are cancelled, never removed. No
migration here contains a delete, drop or truncate (the connector asks a human to
approve those, and nobody can see the prompt). Probe: `supabase/tests/probes/ai-assistant-proposals.sql`
(self rolling back; run through the connector, it answered `PROBE_OK`).

### Tools (`lib/assistant/tools/`)

Public (no permission): `get_listing_photos`, `get_listing_details`.
Private, each with `requires`, hidden from the model until granted and refused by
`runTool` against the database, paced (40 calls per ten minutes per member), audited
(`tool_run`, no payload): `picked_for_you`, `remember_preference`, `list_saved_listings`,
`propose_save_listing` (saved_prefs); `get_viewing_options`, `propose_viewing`,
`list_my_viewings`, `list_my_bookings` (bookings_viewings); `list_my_transactions`,
`spend_summary`, `get_refund_status` (transactions); `get_wallet_balance`
(wallet_balance); `get_account_summary` (account_info); `propose_payment`
(payment_assist). Every read uses the caller's own client and RLS, never the service
role, and returns the minimum.

### Interactive events

The server builds `cards`, `actions`, `slots`, `summary`, `payment_review` and `photos`
events from the tool's own result, so the model cannot write a button, an amount or a
proposal id. The screen (`components/app/assistant/AssistantBlocks.tsx`) draws them and
keeps them in memory only (they are stripped before local storage).

### Server actions (`lib/assistant/action-actions.ts`)

`assistantListingPhotos`, `assistantViewingSlots`, `assistantProposeViewing`,
`assistantSave`, `assistantDecide`, `assistantPaymentStatus`, `assistantRetry`.

* Viewing: a tapped time is re-checked against `viewing_slots`; Confirm runs the existing
  `bookViewingSlot` (which writes a CONFIRMED viewing or refuses). "Booked" is said only
  when it answers.
* Save: the Save tap is the approval; a proposal is made and confirmed in one call and
  runs `toggleSave`.
* Payment: pre-checks WITHOUT using the proposal up (money lock via `passcodeMoneyRefusal`;
  the booking is still pending and the amount still equals what was shown). Then the
  proposal is decided and the existing `startCardCheckout` opens the provider's hosted
  page with the proposal id as its idempotency key. The assistant never sees card data and
  never says "paid": the member pays on the provider's page and the chat reads the real
  state back from the booking and its transaction (`assistantPaymentStatus`).
* Retry creates a NEW proposal; nothing is ever replayed.
* Cancel and reschedule of a viewing: no existing member action does this, so the
  proposal kinds exist in the database but are not offered. The assistant says so and
  points to human support.

### Where it appears

Settings, VALLO AI Assistant (Phase 1) now uses the founder's glyph pack; the assistant's
empty state and the Property home show "Picked for you by VALLO AI" (only for a member
who turned it on and granted discovery and saved preferences) with a "Why this?" line per
card; a quiet "Private access is on" line shows while more than discovery is granted;
listing and stay pages carry "Ask Vallo AI about this place", which opens
`/assistant?about=<id>`. The server validates the id against the catalogue and reads the
title itself.

### Honest limits

* No browser or real-model end to end run: the model call and the provider's hosted page
  cannot be driven from here. What was run: the live-database probes (Phase 1 and 2), unit
  tests of every tool and action with the database, the model and the provider stood in,
  route tests of what the model is shown OFF and ON, and Chromium DOM tests of every block.
* "Frequently viewed" cannot be attributed to a member: `listing_view_marks` stores a
  hashed viewer, not a user. Picks use saved places and what the member told the assistant.
* Stay pages use an accommodation id; if it is not a catalogue listing id the "about"
  context is ignored (the question still works).
* Balance: reported by the licensed provider where the member has an account; otherwise
  the assistant says plainly there is none or it is not live. Vallo holds no customer money.
* A statement download is not offered (no export exists); receipts are in Settings.
* New text is English only.
* Counsel should review the four legal pages.
