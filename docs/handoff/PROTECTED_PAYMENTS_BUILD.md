# VALLO: PROTECTED PAYMENTS, THE BUILD HANDOFF

Written 9 November 2026. This is the brief for the session that builds Vallo's
protected payment rail. Read `FOUNDER_BRIEF_VERBATIM.md` and
`PLATFORM_GRADE_1_READINESS.md` first: the founder's rules there apply here
without exception.

---

## 0. DO NOT START UNTIL THESE ARE TRUE

This build touches real money. Every gate below must be green before one line
of adapter code is written. If any is red, STOP and tell the founder.

1. **The provider has answered in writing**, and the answers are acceptable:
   - refunds return to the payer's ORIGINAL bank account, not a balance held
     with the provider;
   - transaction limits and hold durations cover annual rent (weeks, and
     amounts above 10 million naira);
   - a sandbox exists with credentials we hold;
   - our transaction categories are approved in writing.
2. **The signed business agreement exists** and the founder has read it.
3. **Sandbox credentials are in the environment**, never in the repository.
4. **The founder has said to start.**

A successful sandbox transaction is NOT approval. Approval is a written
statement from the provider naming our use case.

---

## 1. WHAT THIS IS, IN ONE PARAGRAPH

A buyer pays. The money goes to a designated account at a CBN-licensed bank,
held by a licensed provider, NOT by Vallo and NOT on the provider's own books.
Vallo holds no money at any point. Vallo holds the INSTRUCTION: when the
agreed condition is met (keys handed over, guest checked in), Vallo tells the
provider to release, and the provider pays the seller. If the condition fails,
Vallo instructs a refund. Every state change is confirmed by the provider
through a signed webhook, never by our own frontend.

---

## 2. THE RULE THAT GOVERNS EVERY LINE

**Vallo never holds customer money.** This is ADR 0002 and it has not changed.
What changes is that a licensed partner may now hold it (ADR 0003) and Vallo
may instruct the release (ADR 0004, two rails).

The copy rule that follows: never write a sentence that says or implies Vallo
holds, keeps, stores or banks a member's money. The repository enforces this
(`apps/web/scripts/check-valuation-words.mjs` and the custody-words tests).
The approved formulation:

> Your payment is held by a licensed bank until you confirm check-in. Vallo
> never holds your money.

---

## 3. WHITE LABEL: THE FOUNDER'S RULING, 9 NOVEMBER 2026

**The provider's name and logo do not appear in the Vallo interface.** Not on
the payment choice screen, not on the funding screen, not on the protected
transaction screen, not in a "powered by" line, and not as a link out. The
member's experience is Vallo's, start to finish. The provider operates in the
code, the webhooks and the contracts.

**The one exception, and it is not optional.** The institution that holds the
money MUST be named where the law and plain honesty require it:
- in the Terms, in the section about payments;
- on the receipt for a protected payment;
- in the help centre article explaining how protected payment works;
- wherever a member asks "who is holding my money", which they will.

Hiding the custodian entirely would be a consumer-protection problem and would
undermine the exact trust the feature exists to build. Brand the EXPERIENCE,
disclose the CUSTODIAN. Put the question to the solicitor with the other
custody questions.

---

## 4. WHAT ALREADY EXISTS (DO NOT REBUILD IT)

Verify each against the source before changing it.

| Piece | Where | State |
|---|---|---|
| Provider abstraction, typed capabilities | `lib/payments/provider.ts` | Built. `split_at_charge`, `hold_in_escrow`, `member_wallet` |
| Rail router (which rail per deal type) | `lib/payments/router.ts`, `private.rail_for_booking`, `private.rail_for_agreement` | Built |
| Payer's rail choice | `deal_agreements.payer_rail_choice`, `public.payment_rail_choose` | Built |
| Arrangement state machine | `lib/money/arrangement-states.ts` | Built, but mapped to PAYLUK's vocabulary. Remap. |
| Arrangements table | `provider_arrangements` | Built |
| Webhook route | `app/api/payluk/webhook/route.ts` | Built for Payluk. Replace. |
| Reconciliation cron | `/api/cron/arrangements-reconcile`, every 10 minutes | Built |
| Member screens | `app/(app)/agreements/[id]/fund`, `.../held` | Built, Payluk-shaped |
| Payment gate | `transactions_00_payment_gate`, `provider_arrangements_00_payable_gate` | Built |
| Ledger | `ledger_entries` | Built |
| Refund clock | `booking_refunds`, three forward-only stamps, 5 business days | Built |
| Kill switches | env `PAYMENTS_KILL_PAYLUK`, flag `payments_payluk_on`, `private.rentals_protected_pay_on` | Built |
| Safety rails | card charge refused while partner holds; both-ways funding alerts; unfunded arrangement cancels after 2h | Built |

**What does not exist: the HTTP client.** There is no provider API call
anywhere in the codebase. That is the gap. Everything else is scaffolding
waiting for it.

---

## 5. THE BUILD, IN ORDER

**Phase 1: audit, no code.** Inventory every reference to the old provider.
Classify each: active code to replace, shared code to preserve, historical
records to leave alone, dead code to remove, compatibility code to keep during
migration. Write it to `docs/handoff/PAYMENTS_MIGRATION_AUDIT.md`. Show the
founder before writing code.

**Phase 2: the adapter, disabled by default.**
`lib/payments/providers/<provider>/` with client, types, schemas, provider,
webhooks, normaliser, errors, config. Implement only operations the official
sandbox documentation confirms. Never invent a base URL, a header, a signature
algorithm, an event name or a response shape. Where documentation is missing,
write an explicit TODO and report it. Do not fabricate a working integration.

**Phase 3: backend.** State mapping, webhook verification, persistence,
reconciliation. Rules that cannot be bent:
- A transaction is funded ONLY on authoritative provider confirmation.
- A transaction is released ONLY on authoritative provider confirmation.
- An unknown provider state NEVER becomes `released`.
- Webhooks are idempotent, replay-proof, and tolerate out-of-order delivery.
- Reconciliation never releases money as a side effect.
- Reconciliation never overwrites a terminal state with an older event.

**Phase 4: frontend.** Section 6.

**Phase 5: sandbox.** Every state transition including every failure path:
invalid webhook, duplicate webhook, delayed webhook, provider outage,
mismatched amount, unknown status, expired arrangement, missed webhook
recovered by reconciliation.

**Phase 6: retire the old provider** from active paths only. Never delete
historical payment records. Never drop or rename a production table because it
holds old data. Keep a clear record of which provider handled each
transaction.

**Phase 7: controlled pilot.** One category, low value, written approval,
agreed limits. Not everything at once.

---

## 6. THE FRONTEND

Design comes from the ChatGPT design pass the founder is running, plus
`PLATFORM_GRADE_1_READINESS.md` section 4B (the Grade 1 design language).
Build it with the shared components: `PageFrame`, `Sheet`, `StepFrame`,
`FeedbackBanner`.

**The screens:**
1. **Payment choice.** Protected (bank transfer) or card, where policy allows.
   Accurate fees. Never advertise protection on an unapproved category.
2. **Funding instructions.** Vallo reference, property, amount, the bank
   details the provider returned, expiry, copy buttons, live status, a refresh
   that asks OUR backend. Account details are never hardcoded and never
   editable by the member.
3. **Protected.** The hero screen. The money is safe, here is what happens
   next, here is when it releases.
4. **Release and refund controls.** Role-aware, server-validated, confirmation
   before anything irreversible. Never say released or refunded before the
   provider confirms.
5. **Dispute.** Open, reason, evidence, both statements, admin review,
   decision history.
6. **Timeline and receipt** on every transaction.

**States that must each look different and be unmistakable:** awaiting
transfer, transfer received, protected, handover pending, under review,
release processing, released, refund processing, refunded, action required,
failed.

**Never:** a screen that looks functional but is not wired; a member marking
their own payment as made; a screenshot accepted as proof; the words
"released" or "refunded" before provider confirmation.

---

## 7. SAFETY, NON-NEGOTIABLE

1. No frontend declares funded, released or refunded.
2. No duplicate funding, release or refund.
3. No card charge funds an arrangement the partner already holds.
4. No reconciliation triggers a release.
5. No provider outage is read as "funds are safe".
6. No failed request is reported as success.
7. No payment opens before agreement approval.
8. No unapproved category reaches the provider.
9. No provider credential reaches the browser.
10. Every financial transition is audited.
11. Kill switches exist and work: disabling the provider stops NEW
    arrangements and never abandons a funded one.

---

## 8. CATEGORY ELIGIBILITY

Build a configuration layer: `residential_rent`, `shortlet`, `hotel_booking`,
`commercial_rent`, `property_sale`, `land_sale`, `event_space`, `other`. Each
is `approved`, `pending_approval`, `not_supported` or `disabled`. **Default
everything to disabled.** A category becomes approved only on the provider's
written approval, recorded with a date and the founder's sign-off. A member
must never be able to bypass this from the client.

---

## 9. THE LAUNCH POSITION (9 NOVEMBER 2026)

The founder launches in days, and this build is NOT on that path:

- **Shortlets, hotels, restaurants: card, today.** Paystack split at charge,
  already live and legal. Diaspora can pay. Chargeback is the protection.
- **Rent: everything except the payment step.** Listings, search, inspections,
  agreements all live. Protected payment opens when this build is done and
  approved.
- **Sale: solicitor.** Vallo takes a reservation fee at most, and commission
  on completion.

Nothing here blocks the launch, and nothing in the launch should promise what
this build has not yet delivered. Audit the money copy before launch day.
