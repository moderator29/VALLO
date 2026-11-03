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
* Cancel and reschedule of a viewing: added in Phase 3 (below).

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
* "Frequently viewed": `listing_view_marks` stores a hashed viewer, so Phase 3 records the
  member's own opens separately, only with Saved preferences granted (below).
* Stay pages use an accommodation id; if it is not a catalogue listing id the "about"
  context is ignored (the question still works).
* Balance: reported by the licensed provider where the member has an account; otherwise
  the assistant says plainly there is none or it is not live. Vallo holds no customer money.
* Statement download: added in Phase 3 (`/api/statement`, below).
* New text is English only.
* Counsel should review the four legal pages.


---

## Phase 3: viewings, statement, opened places, security review (1 November 2026)

### Cancel and move a viewing

* Database: `reschedule_my_viewing(p_inspection, p_slot)` (applied, recorded
  `20261101161935_reschedule_my_viewing`). The requester only, an open viewing still ahead;
  the old one is withdrawn and the new time booked through `book_viewing_slot_mode` in ONE
  transaction, so a time that is no longer free leaves the current viewing standing. The
  lister hears both through the existing inspection triggers. Probe:
  `supabase/tests/probes/reschedule-my-viewing.sql` (answered `PROBE_OK`).
* Server actions (`lib/viewings/actions.ts`): `cancelMyViewing` (the existing withdrawal,
  `closeInspection`), `myViewingMoveOptions`, `rescheduleMyViewing`.
* The member's own viewing card (`InspectionSheet`) now has "Move to another time" beside
  Cancel (`MoveViewingSheet`), so it is not assistant-only.
* Assistant: `propose_cancel_viewing`, `get_move_options`, `propose_reschedule_viewing`
  (bookings and viewings); `list_my_viewings` now carries Cancel and Move buttons on each open,
  upcoming viewing. Confirm runs the actions above with the STORED payload.

### Statement download

`GET /api/statement`: the member's own payments as a CSV (date in Lagos, what, to whom by
role, amount, status, the receipt reference they already see), read with their own client
through `my_payments_history`, paced (10 an hour), never cached, formula cells defused.
"Download statement" on Payments and on the assistant's transactions summary (a download
button the screen draws only for that route).

### Places you opened

With the assistant on and Saved preferences granted, opening a listing records `seen:` keys
(area, kind, bedrooms, price band; never the listing, its words or its address) in the
member's own `ai_learned_preferences`, server-checked with `ai_assistant_can`, deduped for six
hours, capped at 20 keys and weight 5. Off or revoked: nothing is written. Picks use it lightly
(never above what the member said, and a stated dislike still wins) and say so ("you have been
opening places in Lekki"). Settings shows them as "From places you opened".

### Security review

| Finding | Fix | Regression test |
| --- | --- | --- |
| A prompt injected through a listing or message could make the model name private tools it was never offered; each was checked against the database and logged as "denied", and eight denials switch the assistant off, so an outsider could lock a member's assistant | `runTool` refuses a private tool the request did not offer BEFORE asking the database, logged as "refused" (not counted by the lockout); offered tools are still checked in the database (a revoke mid-request) | `assistant-private-tools.test.ts` (never offered: no `ai_assistant_can`, no "denied"), `access.test.ts` |
| A listing title (the lister's own words) was placed in the system prompt for "Ask about this place" | Reduced to plain one-line text of at most 80 characters with no markup, fence or brackets, and labelled as the lister's words and not an instruction | `activity.test.ts` (`plainTitle`, label) |
| Members write `ai_learned_preferences` directly under RLS; the value had no size bound | Database check `octet_length(value) <= 1000` (`20261101164058_ai_learned_preferences_value_small`) | probe `ai-learned-preferences-bounds.sql` (`PROBE_OK`; also owner-only writes) |
| Cancel/move with somebody else's viewing id | Every read is the caller's client AND filtered by `requester_id`, re-checked in code; the database function checks the requester too | `phase3-tools.test.ts`, `action-actions.test.ts`, `my-viewing.test.ts`, the reschedule probe |
| A download button from the stream could point anywhere | The screen draws a download only for `/api/statement` | code path in `AssistantBlocks.tsx` |

Reviewed and holding, no change needed: proposals are owner-only, hash-bound, single use,
ten minutes, epoch-bound (replay, tampering and stale tabs fail closed, `action-actions.test.ts`);
payment amount drift cancels the proposal before checkout; tool results reach the model fenced;
browser-sent assistant turns carrying tool output are dropped; the route and every action are
paced; tool errors carry fixed sentences, not database text; audit details drop password,
passcode, token, secret, card, cvv, pin and authorization keys; every private read uses the
member's own client, never the service role.
