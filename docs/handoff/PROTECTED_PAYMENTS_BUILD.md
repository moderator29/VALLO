# VALLO: PROTECTED PAYMENTS, THE BUILD HANDOFF

Written 9 November 2026. This is the brief for the session that builds Vallo's
protected payment rail. Read `FOUNDER_BRIEF_VERBATIM.md` and
`PLATFORM_GRADE_1_READINESS.md` first: the founder's rules there apply here
without exception.

---

## 0. THE BRANCH, AND THE FOUNDER'S RULES

**Every piece of this work goes on `platform-grade-1-readiness`, continuing
the branch the last two sessions worked on.** Do not cut a fresh branch from
`main`: that throws away 336 commits of existing work. The exact commands and
the reason are in rule 1 of `PLATFORM_GRADE_1_READINESS.md` section 1. Read
that whole section: its rules govern this build too, not just the UX work.
The short form, because these are the ones that get broken:

- **ONE branch**, `platform-grade-1-readiness`, continued not recreated.
  Commit and push to it often: Vercel is switched off for it, so it is free.
  Never push to `main` and never merge into `main` unless the founder's
  message literally contains "push to main".
- **TWO SUBAGENTS plus you the lead**, three workers at once, never more.
  Never two writers in the same files. Name the owned paths in every agent's
  brief. Read the diff of every agent's work yourself before committing it.
- **SQL goes into `supabase/migrations/pending/` with a note in its README,
  not into the chat.** Apply the safe, additive, reversible ones yourself
  through the Supabase tools and say that you did. Everything else waits, and
  at the end of a group of work the founder gets ONE message with ONE ordered
  SQL block to run in one go. On this build in particular: never run a
  destructive statement yourself, and nothing that touches a live money row
  or a ledger entry goes anywhere near an automatic apply.
- **NEVER deploy to Vercel**, never open a preview, never run the Vercel CLI.
  Previews already cost the founder about 96 USD for nothing.
- **GitHub Actions are back on and you SHOULD use them** (the founder, 9
  November 2026). CI is the only place the database probes can run, so push
  and read the result rather than guessing. Run the fast gates locally first.
  The iOS and Android workflows cost about ten times as much: ask first.
- **No em dashes anywhere**: code, copy, docs, commits, chat.
- **English only** for new copy unless a translation is verified.
- **Never print, paste or commit credentials.** Sandbox and live keys go into
  Vercel or Supabase by the founder himself, never into the repository, never
  into chat, never into a test fixture.
- **No model identifiers** in commits, PR text, code comments or docs.
- **Re-audit after every piece of work**: re-read the diff adversarially, run
  the gates, look at every money screen at 390x844 and 360x800 in light and
  dark, then fix what you find.
- **Never claim something works unless you ran it.** Say "built, not tested on
  a device" when that is the truth. On a payment screen this matters more than
  anywhere else in the product.
- **Company payments need all three founders' approval.** Never add a paid
  service, plan or dependency with a running cost without asking.
- **Talk to the founder in plain language**, the answer first, no jargon. He
  is not an engineer. After each group of work, tell him in numbered steps
  exactly what he needs to do on his phone or in a dashboard.
- **Work autonomously.** Everything in these documents is approved. Ask only
  when money would be spent, something is irreversible or public, or two
  honest readings of his words would build different things, and then ask once
  with your recommendation attached.

---

## 0. DO NOT GO LIVE UNTIL THESE ARE TRUE

**Build now, switch on later.** The founder ruled on 9 November 2026 that the
rail is to be built immediately, flagged OFF, while the commercial terms are
being settled. So the gates below are GO-LIVE gates, not build gates: build
the design, the adapter, the webhooks, the reconciliation, the screens and the
tests, and leave every flag and kill switch off until each gate is green. If
you are ever tempted to switch one on yourself, do not: report the rail as
ready and let the founder decide.

This build touches real money. Every gate below must be green before a single
member can reach a protected payment path. If any is red, the flags stay off
and you tell the founder.

1. **The provider has answered in writing**, and the answers are acceptable:
   - refunds return to the payer's ORIGINAL bank account, not a balance held
     with the provider;
   - transaction limits and hold durations cover annual rent (weeks, and
     amounts above 10 million naira);
   - a sandbox exists with credentials we hold;
   - our transaction categories are approved in writing.
2. **The signed business agreement exists** and the founder has read it.
3. **Sandbox credentials are in the environment**, never in the repository.
4. **The founder has said to switch it on.**

A successful sandbox transaction is NOT approval. Approval is a written
statement from the provider naming our use case.

**Known state, 9 November 2026.** The provider has answered the first round of
questions and has set out its three presentation options; the founder has
chosen the middle one (section 3). Still outstanding: the signed API Services
Agreement, sandbox credentials, written approval of Vallo's categories,
settlement timing after release, dispute handling, whether cards are coming,
and any per-transaction or per-day limits. So gate 1 is PARTLY green, gates 2
and 3 are red, gate 4 is red. Build on. Switch nothing on.

---

## 0A. THE TWO SPECIFICATIONS, READ THEM LINE BY LINE

`docs/handoff/PROTECTED_PAYMENTS_SPECS.md` holds the founder's two
commissioned specifications in full: the engineering migration spec and the
product and design spec. **Read both line by line before writing anything.**
The design spec in particular is the screen-by-screen bible: every state,
every piece of copy, every motion timing, every screen nobody thinks to ask
for. Do not paraphrase it from memory. Open it.

**This document overrides it** wherever they differ. The three corrections in
section 0B are the known differences.

**TWO SUBAGENTS, plus you the lead: three workers at once, never more** (the
founder, 9 November 2026: "two agents with the session itself"). Launch both at
the start of each batch and keep them busy. The rule that never bends: never
two writers in the same files. Split every batch by file ownership before you
launch it, and say in each agent's brief exactly which paths it owns. Also
**study every reference image the founder sends** before you design or build a
screen.

---

## 0B. THREE CORRECTIONS THE FOUNDER HAS RULED ON (9 NOVEMBER 2026)

An earlier draft of this work, written outside the repository, got three
things wrong. The founder has agreed all three corrections. They are binding.

1. **The interface is Vallo's, with ONE small disclosed partner mark at the
   payment step.** Superseded and corrected on 9 November 2026: the founder
   has chosen the provider's middle presentation option, not full white label.
   So there is no provider-hosted checkout, no redirect out to pay, no
   provider-branded screens, and no "powered by" line scattered through the
   product. There IS a small, quiet secured-by mark beside the pay button, and
   the provider's supplied funds wording must appear UNALTERED at or before
   payment. **Section 3 is the rule. Read it before you design a payment
   screen.** The full white label option was declined because it costs a fixed
   monthly fee and removes only that one mark: the provider is named in the
   Terms, privacy policy, help centre and on receipts under every option.

2. **BUILD IT NOW. Switching it on is still gated.** Changed on 9 November
   2026 by the founder: "we already have what it takes for it to be built,
   build it now while we and the provider tackle the rest." So start. Do the
   design pass, write the adapter, the webhooks, the reconciliation, the
   screens, the tests. What you must NOT do is turn it on: the kill switches
   in section 4 stay OFF, the feature flag stays false, and no member sees a
   protected payment path until the gates in section 0 are green, which
   includes a signed agreement and written approval of Vallo's categories.
   Build to ready, stop at the switch, and tell the founder it is ready.
   Shipping a dark, tested, flagged-off rail is exactly right. Shipping a live
   one before the paperwork is the expensive mistake.

3. **Design and build are separate jobs, done in that order.** The design pass
   (flow, screens, copy, motion) is a product designer's work and comes first.
   The build (adapter, webhooks, reconciliation, state machine) is an
   engineer's work and comes after, against a finished design. One session
   doing both at once produces a payment screen that looks finished and is
   not, which is the worst outcome in this entire document.

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

## 3. HOW THE PROVIDER APPEARS: THE RULING, 9 NOVEMBER 2026

**This section was rewritten on 9 November 2026 and replaces an earlier
"white label, provider invisible" rule. Build to what is below, not to
anything you may find quoted elsewhere in these documents.**

The provider offers three presentation options. Vallo is taking the middle
one: **own checkout and pay button, with a small "Secured by <provider>" mark
at the payment step, at standard fees.** The expensive full white label option
was declined for launch because it costs a fixed monthly fee, is changeable
later on 30 days notice, and removes only that one mark: under every option
the provider is still named in the Terms, the privacy policy, the help centre
and on receipts.

**So: the interface is Vallo's, with one disclosed partner mark.**

What this means for what you build:

1. **The flow, the layout, the copy, the states, the receipts, the help are
   all Vallo's.** No provider-hosted checkout page. No redirect out to the
   provider to pay. No provider-branded screens. The member funds, tracks and
   releases a protected payment inside Vallo.

2. **At the payment step, a small partner mark appears.** One line, quiet,
   secondary weight, near the pay button. It is a trust signal, not a brand
   takeover. Do not stretch it, do not centre it in the hero, do not make it
   compete with the amount or the pay button.

3. **The funds wording the provider supplies must appear unaltered at or
   before payment.** Two lengths are allowed, a full one and a short one. Use
   the short one at the payment step and the full one on the confirmation and
   on the receipt. **Do not paraphrase it, do not soften it, do not translate
   it, do not split it.** The exact approved strings live in
   `PROTECTED_PAYMENTS_SPECS.md`. Put them in one constants module, import
   them everywhere, and add a test that fails if any screen renders a
   near-miss variant.

4. **The custodian bank is named in that wording.** This is a feature, not a
   leak. A named CBN licensed bank holding the money is the strongest trust
   line Vallo has on a rail with no track record. Treat it as copy to feature,
   not copy to bury.

5. **The provider and the custodian are named in full** in the Terms payments
   section, the privacy policy, the help centre article on protected payment,
   on every protected payment receipt, and anywhere a member asks who is
   holding their money. The custodian may only be named with the wording the
   provider has agreed.

6. **Vallo must never be presented as building, operating, holding or
   licensing the escrow.** The existing valuation and custody word gates
   (`apps/web/scripts/check-valuation-words.mjs`, the custody-words tests)
   already police the worst of this. Extend them rather than work around them.

7. **Members must be told that identity verification and the holding of funds
   are carried out by third parties.** This belongs in the flow, not only in
   the Terms: one plain line the member actually sees, before they pay.

**If the founder later moves to full white label**, the only change is that
the payment-step mark comes out. Everything in points 3 to 7 stays. Build the
mark as a single component behind one flag so that switch is a one-line
change, not a sweep.

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

## 6. WHO IS ALLOWED TO PAY FOR WHAT, AND FROM WHERE

**The founder's ruling, 9 November 2026.** Protected payment is funded by
naira bank transfer from a Nigerian bank account. That has a consequence the
interface must state plainly and early:

| Deal | Can be paid from abroad? | How |
|---|---|---|
| Shortlet | **Yes** | Card, any country |
| Hotel room | **Yes** | Card, any country |
| Restaurant table | **Yes** | Card, any country |
| **Annual rent / apartment** | **No** | Naira transfer from a Nigerian bank |
| Sale, land | No | Solicitor, off platform |

**Renting a home on Vallo requires paying from Nigeria.** This is not a bug to
apologise for, it is how large Nigerian payments move, and card limits make
rent by card impossible anyway. But a member in London who finds a flat,
books an inspection and only discovers this at the payment screen will feel
cheated. So:

1. **Say it on the listing, not at checkout.** A rental listing viewed from
   outside Nigeria shows a calm line near the price: "Renting a home is paid
   by bank transfer in naira, from a Nigerian account."
2. **Say it again before they invest effort**, at the point they request an
   inspection or open an agreement.
3. **Offer the real way out**, because this is how it actually happens: a
   family member or friend in Nigeria can be named as the payer on the
   agreement, and they pay. Build that: a named payer who is not the tenant,
   recorded on the agreement, with both consenting.
4. **Never dead-end anyone.** No screen may say only "not available in your
   country". It says what they CAN do and offers to tell them when card
   funding for rent exists.
5. **Detect, do not assume.** Base the notice on where they are paying from,
   not on a guess about nationality. A Nigerian in Nigeria with a foreign
   card still has a path; a diaspora member with a Nigerian account can pay
   normally.

Browsing, searching, saving, messaging, inspections and agreements are open to
everyone, everywhere. Only the rent payment step is restricted.

---

## 7. THE FRONTEND, IN FULL

Design comes from the founder's ChatGPT design pass plus
`PLATFORM_GRADE_1_READINESS.md` section 4B. Build with the shared components
(`PageFrame`, `Sheet`, `StepFrame`, `FeedbackBanner`). Nothing below is
optional: a half-built money screen is worse than none.

### 7.1 Before money moves

- **Payment choice.** Protected transfer or card, where policy allows both.
  Honest fees, side by side, with what protection actually means in one
  sentence each. Never offer protection on an unapproved category.
- **What you pay.** A full breakdown before anything is committed: the price,
  every extra charge by name, the total, and who receives what. No surprises
  at the end.
- **Who you are paying.** The counterparty, their verified badge, how long on
  Vallo, their response record. People feel safe when the other person is
  real. Show it at the moment of payment, not only on the profile.
- **Eligibility notice** (section 6) where it applies.
- **The promise, in one line**, with a link to the full explainer.

### 7.2 The protected rail, screen by screen

- **Funding instructions.** Account name, number, bank, the reference, the
  exact amount, the expiry. Every field copyable with one tap and a confirming
  toast. A large, obvious "we are watching for your transfer" state. Never
  hardcoded, never editable by the member.
- **Waiting.** Honest about timing (transfers can take minutes), a refresh
  that asks OUR backend, and what to do if it has been too long.
- **PROTECTED.** The hero. The money is safe, here is where it is, here is
  exactly what releases it and when. This screen carries the entire product
  promise. It should feel like a vault closing: calm, certain, premium.
- **The milestone.** Check-in or key handover, with the confirm action, what
  confirming means, and the alternative if something is wrong.
- **Release in progress**, then **released**, with the receipt.
- **Dispute**: open, reason, photo evidence, both statements, review status,
  decision history.
- **Refund in progress**, then **refunded**, to the original account.

### 7.3 The card rail, treated with equal care

The card rail carries the launch and must not feel like the poor relation:

- Checkout handoff and return, with the app state preserved if they leave.
- Processing, paid, failed with a real reason and a retry that resumes the
  same attempt rather than opening a second one.
- Refund states with the five-business-day clock already built, shown
  honestly: asked, started at the processor, back on your card.
- **Chargeback rights explained** where card is the protection, because on
  shortlets it genuinely is.

### 7.4 Receipts, and the help inside them

A receipt is the artefact a member keeps, forwards to a landlord, shows an
accountant, or takes to court. Treat it as a product, not a footer.

Every receipt carries: the Vallo reference, date and time, what was paid for
with the property named, the full amount breakdown line by line, who paid, who
was paid, the rail used, the current status, **the custodian bank named** for
a protected payment, and the release or refund history with timestamps.

It must be **shareable and savable as a PDF**, readable months later, and
correct in both themes.

**Help lives inside the receipt**, not in a distant help centre:
- "Something wrong with this payment?" opens the dispute or support path with
  the transaction already attached, so nobody re-types a reference.
- "Where is my money?" explains the current state in that member's own words.
- "Who is holding this?" names the bank and links to the explainer.

### 7.5 Transactions and history

- **A payments home**: everything in one place, both rails, newest first.
- Filter by status, deal type, property, date range. Search by reference or
  property name.
- Each row: what, who, how much, status, when. Unmistakable at a glance.
- **Export** a date range to CSV or PDF for a landlord, an accountant or a
  visa application.
- **A timeline on every transaction**: every state change with a timestamp and
  a plain sentence. "You paid", "Your money was protected", "You confirmed
  check-in", "The host was paid". This is also the audit trail.
- Open items surface first: anything needing action, anything stuck.

### 7.6 The seller's side, designed with equal weight

A host watching money they cannot touch yet is as anxious as the buyer. Build
for them:
- "Paid and protected. You will be paid when your guest checks in."
- Exactly when release happens, and the automatic release if the guest never
  confirms.
- Their own receipt, their own history, their own export.
- What to do if the guest does not show.
- Payout account state, and a warning long before a payout could fail.

### 7.7 Trust surfaces

- **"How your money is protected"**: a proper explainer page with the real
  flow, the custodian named, what happens if something goes wrong, and what
  Vallo does and does not do. Written to be read by a nervous person.
- **Verified badges** on the counterparty at the payment moment.
- **A human, one tap away** from every money screen. Fear needs a person.
- **Honest limits**: say what protection does NOT cover, before they pay.

### 7.8 Every failure state, designed

Offline mid-payment. App closed and reopened mid-flow. Transfer of the wrong
amount. Transfer after expiry. Duplicate transfer. Provider outage. Payout
account rejected. Dispute while a release is already processing. Each gets a
designed screen with a plain sentence and a way forward. None gets a spinner
or a raw error.

### 7.9 Notifications and email

Every money event reaches the member twice, in app and by email, in the warm
voice already built (`lib/notify/voice.ts`): protected, released, refunded,
dispute opened, dispute decided, action needed, payout failed. Each one says
what happened, what it means, and what to do next. Lock-screen copy must be
readable in forty characters.

### 7.10 Motion and polish

Money screens earn more motion than anywhere else, because motion here means
reassurance. The money landing in protection, the vault closing, the release
completing, the receipt being issued: each deserves a moment. Fast, never
blocking, always respecting reduced motion. One accent colour carrying
meaning. Nothing that makes a nervous person feel the screen is unstable.

### 7.11 Admin

An operations view of every arrangement with its provider state beside ours, a
reconciliation report with mismatches first, the dispute desk with evidence
from both sides, and the refund clock already built. Staff need to answer
"where is my money" in under thirty seconds.

---

## 8. SAFETY, NON-NEGOTIABLE

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

## 9. CATEGORY ELIGIBILITY

Build a configuration layer: `residential_rent`, `shortlet`, `hotel_booking`,
`commercial_rent`, `property_sale`, `land_sale`, `event_space`, `other`. Each
is `approved`, `pending_approval`, `not_supported` or `disabled`. **Default
everything to disabled.** A category becomes approved only on the provider's
written approval, recorded with a date and the founder's sign-off. A member
must never be able to bypass this from the client.

---

## 10. THE LAUNCH POSITION (9 NOVEMBER 2026)

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
