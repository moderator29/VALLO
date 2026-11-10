# PROTECTED PAYMENTS: THE TWO SPECIFICATIONS

The founder commissioned two specifications outside this repository and has
asked that the build session read them line by line. They are captured here in
full: the engineering migration spec, then the product and design spec.

**Read `PROTECTED_PAYMENTS_BUILD.md` FIRST.** It holds the gates, the founder's
rules and three corrections that OVERRIDE anything below. Where this file and
that one disagree, that one wins.

**The three overrides, repeated here so they cannot be missed:**

1. **The interface is Vallo's, with ONE small disclosed partner mark at the
   payment step.** Updated 9 November 2026: Vallo is taking the provider's
   middle presentation option, not full white label. So there is no
   provider-hosted checkout, no redirect out to pay, no provider-branded
   screens, and no "powered by" line scattered through the product. There IS a
   small, quiet "Secured by <provider>" mark beside the pay button, and the
   provider's supplied funds wording must appear UNALTERED at or before
   payment. The engineering spec below says the provider should "appear as the
   regulated payment infrastructure partner where appropriate", which is too
   loose: read section 3 of `PROTECTED_PAYMENTS_BUILD.md` for exactly where
   the provider and the custodian bank may and must appear, and build to that.
2. **BUILD IT NOW, but it does not go live until the gates are green.**
   Changed by the founder on 9 November 2026. Build the design, the adapter,
   the webhooks, the reconciliation and the screens. Keep the flags and kill
   switches OFF. No member sees a protected payment path until the agreement
   is signed and Vallo's categories are approved in writing.
3. **Design first, then build.** They are separate jobs in that order. One
   session doing both at once ships a payment screen that looks finished and
   is not.

**Also binding:** TWO SUBAGENTS plus the lead, three workers at once, never
more (the founder, 9 November 2026). Never two writers in the same files.
Re-audit after every piece of work. The founder is sending reference images: study every one before
designing or building a screen.

---

# SPEC ONE: THE ENGINEERING MIGRATION

## Role

Act as Vallo's principal fintech architect, senior full-stack engineer,
payment-integration specialist, security engineer and product designer, inside
the existing production-stage monorepo. Migrate the protected-payment
infrastructure from the unfinished the retired provider integration to the chosen provider's
official Business API.

This is an implementation and migration project, NOT a platform rebuild.
Inspect the actual repository, database schema, payment architecture, UI,
server actions, API routes, scheduled jobs, environment variables and tests
before changing anything. Do not invent existing functionality. Do not assume a
public marketing page is a complete API specification.

## Part 1: understand Vallo first

Vallo is an Africa-focused marketplace for discovering, understanding,
verifying, booking, renting, buying and operating physical spaces: residential
rentals, short lets, hotels, commercial space, event spaces, property and land
sales. Not simply a listing website.

The journey: Discover, Understand, Verify, Compare, Inspect, Negotiate, Agree,
Pay, Protect, Release, Occupy, Manage.

Money must connect to: a specific listing, a specific buyer, a specific seller,
a specific agreement or booking, inspection and handover evidence, a payment
record, a receipt, and a release, refund or dispute outcome.

**Inspect and preserve** (verify each against source): `lib/payments/provider.ts`,
`lib/payments/router.ts`, `lib/money/arrangement-states.ts`,
`provider_arrangements`, `ledger_entries`, `deal_agreements`, the webhook route,
`/agreements/[id]/fund`, `/agreements/[id]/held`, `FundControl`,
`ReleaseControl`, agreement approval and payment gates, inspection evidence,
dispute states, refund and reconciliation logic, scheduled reconciliation jobs,
payment safety switches. Capabilities: `split_at_charge`, `hold_in_escrow`,
`member_wallet`.

The old provider's HTTP client was never completed. Do not build around
fictional functionality.

## Part 2: the provider integration

Documented endpoints: `POST /v1/escrows`, `GET /v1/escrows/:id`,
`POST /v1/escrows/:id/release`, `POST /v1/escrows/:id/refund`. Conditional
settlement, bank-transfer funding, buyer and seller identity verification,
funding instructions, signed webhooks, lifecycle events, release and refund
instructions, a named custodian bank, third-party identity verification.

**Never invent:** base URLs, authentication headers, API keys, webhook
signatures, webhook event identifiers, idempotency headers, response
structures, funding account instructions, release or refund payloads, sandbox
behaviour. Build the integration specification from the actual documents the
provider supplies. Where information is missing, write an explicit TODO and
report it. Do not fabricate a working integration.

## Part 3: retire the old provider

Search the whole repository for every reference: code, environment variables,
webhook routes, adapters, UI, components, customer instructions, scheduled
jobs, documentation, database assumptions, error messages, state mappings.

Classify each: (A) active functionality to replace, (B) shared payment
functionality to preserve, (C) historical records to leave untouched, (D) dead
code safe to remove, (E) compatibility code needed during migration.

Remove it as the default and from new routing. Replace its labels, webhook
handling and provider calls. Update configuration, flags, tests and docs.
Remove dead code only after confirming nothing depends on it.

**Never** delete historical payment records, drop or rename production tables
because they hold old data, or break transaction references and audit history.
Preserve a record of which provider handled each transaction. The migration
must be reversible through feature flags.

## Part 4: the adapter

`lib/payments/providers/<provider>/` with client, types, schemas, provider,
webhooks, normaliser, errors, config. Do not duplicate abstractions the
repository already has.

Operations: create, retrieve, release, refund, verify webhook authenticity,
normalise states, normalise errors, handle timeouts and network failures, safe
retries where permitted, idempotent processing on the official contract.

**The adapter must never report success because a request was submitted.**
Funded, released and refunded are true only on authoritative provider
confirmation. Never trust frontend-supplied provider states.

Strongly typed requests and responses from the real sandbox documentation.
Runtime validation of responses, webhook payloads, amounts, currency, provider
references, status values, buyer and seller details. Reject malformed
responses safely. **Never silently convert an unknown state into released.**

## Part 5: routing

Inspect the existing router and the ADRs before changing routing. Preserve
existing transaction-specific logic unless there is a documented reason.

Card payments remain separate. Protected settlement uses the provider only
where approved. Hotel-room card checkout stays a permitted route. A property
sale must never silently fall back to an unprotected direct payment. Rent and
short-let payers may choose a rail where policy allows. The chosen rail is
stored against the transaction. A protected transaction must never receive a
second independent payment.

The provider funds by bank transfer, not card. **Never present a protected
transaction as a card checkout.**

**Category eligibility layer**, configurable: `residential_rent`, `shortlet`,
`hotel_booking`, `commercial_rent`, `property_sale`, `land_sale`,
`event_space_booking`, `other`. Each is `approved`, `pending_approval`,
`not_supported` or `disabled`. **Default everything to disabled.** Never infer
approval from a successful sandbox transaction. A client must never bypass it.

## Part 6: lifecycle

Member selects an eligible protected option. Agreement approved. Vallo
validates parties, category and amount. Vallo creates the escrow and stores the
reference. Buyer receives official transfer instructions. Buyer transfers.
Provider confirms funding by authenticated webhook. Vallo marks it protected.
Handover or check-in happens. Evidence collected. Member confirms or review
begins. Vallo makes the authorised release or refund decision. Provider
executes. Vallo records the provider-confirmed outcome. Receipt and history
update.

Normalised states: `awaiting_payment`, `protected`, `disputed`,
`release_pending`, `released`, `refund_pending`, `refunded`, `failed`,
`cancelled`, `requires_review`. Map only states the official contract supports.

**Never** release because an owner marked a guest checked in. **Never** refund
because a member clicked a button. Every release and refund passes server-side
authorisation and validation.

**Split:** not publicly documented. Do not pretend it is supported, do not mark
a transaction split without provider confirmation, preserve historical split
records, add it only on an official contract and testing.

**Wallet:** do not build a fictional member wallet. Vallo may keep its own
ledger and show protected-payment history, but must never represent a ledger
balance as withdrawable cash held by Vallo.

## Part 7: backend and database

Inspect the schema first; reuse existing tables and columns.

Record: internal transaction id, agreement id, booking id, provider name,
provider escrow id, provider reference, amount, currency, buyer and seller
identity references, category, normalised state, provider's original state,
funding instructions, and timestamps for created, funded, release requested,
release confirmed, refund requested, refund confirmed, last provider
verification, last webhook, last reconciliation result, plus error and
investigation metadata.

Safe migrations, indexes, unique constraints. Store no unnecessary sensitive
identity data. Never expose API secrets or raw provider responses to the
browser.

**Webhooks:** verify the signature by the documented method, reject invalid
ones, validate structure, verify the reference against our database, verify
amount and currency, match the provider escrow id to the expected arrangement,
prevent replay and duplicates, process idempotently, persist the original event
for audit, apply changes in a safe database transaction, log anomalies, return
proper responses. **Never let an unauthenticated webhook fund, release or
refund.** Never invent a signature algorithm or header name. Never assume
delivery order; handle duplicate, delayed and out-of-order events.

**Reconciliation:** find pending arrangements, query the provider, compare
states, detect missed webhooks, amount mismatches and unexpected final states,
record results, escalate unresolved mismatches. **Never overwrite a terminal
state with an older event. Never release money as a side effect.** Rate limit
and back off; do not poll aggressively when the webhook contract is
authoritative.

## Part 8 to 14 in brief

Frontend replacement is specified in full in SPEC TWO below and in
`PROTECTED_PAYMENTS_BUILD.md` section 7.

**Identity verification:** determine which attributes we must submit, whether
an existing verified reference can be passed, whether a separate flow is
required, how results and failures are returned, how consent is collected, what
must and must not be retained. Never collect NIN or BVN in an ordinary frontend
field without a verified security and compliance design. Avoid duplicate
verification where an acceptable existing record can be reused. Never assume
Vallo's own verification satisfies the provider.

**Security, mandatory:** no frontend declares funded, released or refunded; no
duplicate funding, release or refund; no card payment silently funds an
arrangement the provider holds; no reconciliation triggers an unapproved
release; no provider outage is read as funds being safe; no failed request is
reported as success; no payment opens before agreement approval; no unapproved
category reaches the provider; no credential reaches the client; every
privileged operation is authorised; every financial transition is auditable.
Kill switches exist, and disabling the provider stops NEW arrangements without
ever abandoning a funded one.

**Environment:** `ESCROWPAY_API_BASE_URL`, `ESCROWPAY_API_KEY`,
`ESCROWPAY_WEBHOOK_SECRET`, `ESCROWPAY_ENVIRONMENT` (adapt to repository
conventions). No secrets in source. No sandbox credentials committed. Separate
development, sandbox and production configuration, and make it impossible to
use production credentials in a test environment by accident.

**Testing.** Unit: request and response validation, state and error
normalisation, amounts, currency, category eligibility, permissions, duplicate
events, idempotency, terminal-state protection. Integration against the
sandbox: create, funding instructions, fund, funding webhook, verify state,
release, confirm release, refund, confirm refund, invalid webhook, duplicate
webhook, delayed webhook, provider outage, mismatched amount, unknown status,
expired arrangement, reconciliation after a missed webhook. End to end: the
whole customer journey, plus refund and dispute paths. **No live money in
development tests.**

**Rollout phases:** (1) repository audit, no code changes; (2) adapter behind
the interface, disabled by default; (3) backend; (4) frontend; (5) sandbox;
(6) retire the old provider; (7) controlled production activation only after
written provider approval, custody review, signed agreement, passing sandbox
tests, security review, verified webhooks, working reconciliation, working
refund and release, and legal review. Start with a pilot on one category.

**Deliver:** repository audit, dependency inventory, architecture diagram,
migration plan and migrations, adapter, backend, webhooks, reconciliation,
updated router, state mapping, the frontend, funding experience, protection
dashboard, release and refund controls, dispute experience, tests, sandbox test
report, environment documentation, deployment instructions, retirement report,
and every outstanding legal, commercial and technical blocker. Include exact
file paths, migrations added, tests run and their results, and every feature
that remains incomplete. **Do not claim a feature is implemented unless it is
implemented and tested.**

---

# SPEC TWO: PRODUCT EXPERIENCE AND DESIGN DIRECTION

## The central design decision

Protected payments should feel like a transaction being securely placed into an
agreed process, not like someone making a bank transfer.

The buyer fears losing money. The seller fears losing a genuine customer or
waiting indefinitely. Both need to see the same transaction, the same
conditions and the same evidence, with different permissions.

**The language rule that governs everything:** Vallo must NEVER say money is
protected merely because an escrow record was created. The protected state
begins only after the partner confirms receipt and custody applies. Before
that, the interface says **awaiting transfer** or **transfer being confirmed**.

## The Vallo promise

> Your money. Your agreement. Your moment.
>
> Your payment is held by a licensed bank until you confirm check-in. Vallo
> never holds your money.

Held by the designated bank. Released under your agreement. A clear process if
something goes wrong.

Use this only after custody, licensing and category have been verified. The
bank's name belongs in the legal disclosure, not hidden behind vague
reassurance.

## The buyer journey

Choose how to pay (protected transfer and card where both are permitted, with
real conditions, fees and the release milestone). Review the protection
agreement (property, seller, amount, duration, check-in or handover condition,
dispute process, refund conditions). Create the protected transaction (the
screen says plainly that the transfer has NOT been received). Transfer funds
(designated account, exact amount, unique reference, expiry). Payment
confirmation (the app stays in the waiting state until the partner confirms).
Protected (money confirmed held, release condition and full timeline visible).
Check-in or handover (confirm the milestone, or raise an issue). Release or
dispute. Completion (provider confirms, Vallo issues a permanent receipt and
updates history).

## The seller journey

Receive the booking or agreement. Awaiting funding: they see the buyer has
instructions, NOT that money arrived. Funds protected: partner-confirmed
funding, protected amount, release milestone. Prepare handover. Await buyer
confirmation, with a clear explanation of why funds remain held. Released:
confirmed payout status and receipt. Dispute: status, response deadline,
submitted evidence, permitted next steps, without exposing private buyer
information unnecessarily.

**The seller must never see a fake spendable balance.** Call it "Protected
transaction amount", never "wallet balance" or "available funds".

## Design system

Light mode: near-white, navy text, subtle blue-grey borders. Dark mode: deep
navy, restrained blue accents, legible secondary text.

Tokens: primary `#005FE8`, navy `#0B1426`, surface `#F8FAFD`, attention
`#FF6B3D`. Blue for primary actions and active progress. Orange sparingly for
warnings and time-sensitive attention, never decoration.

Typography: the existing Vallo font system. Strong short headings, readable
body, **tabular numerals for money, account numbers and countdowns**.

Components: main cards 24 to 28px radius; bottom sheets 28px top radius;
primary CTA a full-width pill about 56px high; hairline borders, not heavy
outlines; one thin-line icon family; minimal glass on floating elements.

**Never communicate a financial state by colour alone. Every status needs a
written label and an icon.**

Mobile: design at 390x844 and 360x800. Main action above the safe-area inset,
scrolling allowed, transfer details easy to copy on small Android devices.

## The screens

### 1. Choose how to pay

Explain the difference honestly before the member commits. Eyebrow "COMPLETE
YOUR BOOKING", title "Choose how you want to pay".

Protected bank transfer, recommended: the amount, the promise sentence, payment
method, protection fee, total to transfer, and "The exact fee and any other
charges are shown before you continue."

Pay by card: the amount, "Standard card checkout", and "Card payments follow
the standard payment terms and may not include the protected holding
arrangement."

Then: "The payment and release conditions are set out in your agreement."
CTA: **Continue with protected transfer**.

**Copy rules:** never say "free protection" if a fee exists; never label card
checkout "unsafe", explain the real difference; show the total including every
fee before proceeding; if a category is not approved, do not show the option.

States: loading methods, no protected option available, fee calculation failed,
payment service unavailable, agreement no longer valid.

### 2. Review the protection agreement

A SEPARATE confirmation step, not hidden in the payment choice card. Property
summary, both names, amount, dates, release condition, dispute process,
cancellation and refund terms, fee breakdown, checkbox, CTA.

> Before you protect this payment
> You are paying [amount] for [property].
> The funds will be held by the designated licensed bank after your transfer is
> confirmed. They will remain held until you confirm that the agreed handover
> has taken place, or an authorised outcome is reached through the dispute
> process.
> If there is a problem, you can submit evidence through Vallo. The funds remain
> held while the dispute is reviewed, subject to the agreement and applicable
> rules.

Checkbox: "I have reviewed the agreement, payment conditions and refund
process." CTA: **Agree and continue**. A link opens the full agreement.
**Store the exact agreement version the buyer accepted.**

### 3. Funding instructions

Status: **Awaiting transfer**. Hierarchy: amount first, account details second,
expiry and instructions third.

The amount, then bank, account name, account number, transfer reference,
"Transfer expires in [countdown]", and the warning: "Use the exact account
details and reference. A transfer to another account may not be matched to this
booking."

Action: **I've made the transfer**, with the line beneath it: "This does not
confirm payment. We'll verify the transfer with the bank." **That action only
refreshes status. It must never mark the transaction funded.**

Expiry: show a live countdown ONLY if the provider returns a genuine expiry. If
it passes, preserve the old reference, explain the next step, and **never
silently reuse an expired account instruction.**

Copy feedback: "Account number copied", "Reference copied". Haptics only if
supported and enabled.

### 4. Waiting for transfer

Status: **Transfer being confirmed**. A restrained animated circular progress
indicator, never an infinite spinner that implies breakage.

> We're checking for your transfer
> Your payment instructions are ready. We're waiting for confirmation from the
> bank.
> You can safely close Vallo. We'll keep checking and update this transaction
> when we receive confirmation.

Show amount, reference, destination, last-checked timestamp, "Refresh status",
"I need help". If nothing arrives, **do not blame the buyer**: "Still waiting
for confirmation", with a clear support path.

### 5. PROTECTED, the hero

Only after confirmed funding. Eyebrow "PAYMENT CONFIRMED", a large restrained
shield and check, then:

> Your payment is protected.
> Your payment is held by a licensed bank until you confirm check-in. Vallo
> never holds your money.

Then the property and amount card, and "What happens next": transfer received,
funds protected, confirm check-in, funds released under your agreement.

Release condition card:
> When will the host be paid?
> Once you confirm check-in and the agreed handover is complete, Vallo will
> instruct the release of funds under your agreement.

Custody disclosure:
> Where is your money?
> Your payment is held by [verified custodian legal name], a licensed bank.
> Vallo does not hold your funds.

A "How protection works" link. Primary action: **View transaction details**.

**Do not write "Your money is safe" as an absolute guarantee.** "Your payment
is protected" is a defined transaction state backed by verified receipt and
custody. The interface must not imply immunity from bank failure, fraud or
every possible dispute outcome.

### 6. The milestone

**Specific to the category. Never one generic button for every transaction.**

Guest: "Have you checked in? Please confirm that you received access to the
accommodation described in your agreement." Actions: "Yes, I've checked in" and
"Something is wrong". Before confirming, show property name, check-in date,
agreed access details and inspection evidence.

Tenant: "Have you received the keys? Confirm only when you've received access
to the property and the agreed handover is complete."

Confirmation sheet:
> Confirm handover?
> By continuing, you're confirming that the agreed handover has taken place.
> Vallo will submit the release instruction. Once the bank confirms the outcome,
> we'll update your receipt.

CTA "Confirm handover", secondary "I need to report a problem".

For long-term rent, define the handover condition and inspection window in
advance. **Do not introduce an unexpected automatic release countdown after the
member has paid.**

### 7. Release processing, then released

Processing: "Your confirmation has been received. Vallo has submitted the
release instruction. We're waiting for the bank to confirm the outcome. You
don't need to pay again." Show instruction timestamp and reference.

Released: "Payment released. The bank has confirmed that the funds have been
released according to your agreement." Show the payout destination only so far
as appropriate, and the confirmation time. Action: **View receipt**.

**No celebration animation implying the seller received funds when the provider
has only confirmed a release instruction.** Wording must match the confirmed
state exactly.

### 8. Dispute

Entry: "Something isn't right? Tell us what happened. Your transaction will be
reviewed under the agreement, and the funds will remain held where the
provider's arrangement permits."

Reasons: the property is not as described; I could not access the property; the
keys or access were not provided; the property is unsafe or unusable; the host
or agent is unresponsive; something else.

Then describe, attach photos and video, choose when it happened, submit.

Evidence guidance: "Add clear photos or documents that help explain what
happened. Avoid including passwords, card details or unrelated personal
information."

After submission: "Your report has been submitted. We have received your
evidence. The transaction is now under review. We'll notify you when the other
party responds or when there is an update."

Shared timeline with separate labelled statements: buyer statement and
evidence, seller response and evidence, Vallo review activity, requested
additional information, final decision and reason.

**Never let either party silently edit a submitted statement.** New evidence
becomes a new timestamped entry.

### 9. Refund processing, then refunded

Processing: "Your refund is being processed. The refund instruction has been
submitted. We're waiting for confirmation from the bank." Show original payment
reference, refund amount, destination masked to the last four digits if
verified, and timestamp.

Refunded: "Your refund has been confirmed. The bank has confirmed the refund.
Check your originating bank account for the credit. Your bank may take
additional time to display it."

**Do not promise an arrival time unless the partner has contractually given
one.**

### 10. The seller's protected transaction view

Must not feel like a penalty or a locked wallet. Header "Protected
transaction", the amount, status "Funds protected".

> The buyer's payment has been confirmed and is being held under the transaction
> agreement. You do not need to collect payment separately.

Next milestone: "Waiting for buyer check-in confirmation."

Show permitted buyer details, property and booking details, agreed release
conditions, expected handover date, a handover checklist, evidence upload,
dispute status, release status, reference and downloadable receipt.

Reassurance: "Your transaction is recorded. The amount, agreement and payment
status are documented in Vallo. We'll update you when the next step is
confirmed."

**Never say "Your earnings are available" until payout is confirmed.** Never
show the seller an editable release control when the buyer's confirmation or an
authorised dispute outcome is required.

### 11. The persistent timeline

| Event | What the member sees |
|---|---|
| Agreement approved | Agreement confirmed |
| Escrow created | Transfer instructions issued |
| Transfer confirmed | Payment received |
| Provider confirms custody | Funds protected |
| Handover starts | Awaiting confirmation |
| Buyer confirms | Release requested |
| Provider confirms | Funds released |
| Dispute opens | Under review |
| Refund requested | Refund processing |
| Provider confirms refund | Refunded |

Every event: timestamp, actor, reference, source. **Distinguish member actions
from system events and provider-confirmed events.**

## Every state has its own identity

Use the same labels across buyer screens, seller screens, notifications,
receipts and history.

| State | Treatment | Meaning |
|---|---|---|
| Awaiting transfer | Amber, clock | Instructions issued, no confirmed payment |
| Transfer received | Blue, check | Payment reported received, custody not yet confirmed |
| Protected | Blue, shield | Provider confirms funds are held |
| Handover pending | Neutral blue, key | Held, milestone not confirmed |
| Under review | Amber, file-search | Dispute or investigation open |
| Release processing | Blue, arrow | Instruction submitted, not confirmed |
| Released | Green, check-circle | Provider confirms release |
| Refund processing | Blue, rotate | Instruction submitted, not confirmed |
| Refunded | Green, check-circle | Provider confirms refund |
| Action required | Orange, alert-circle | The member must act |
| Failed | Red, alert-circle | Operation failed, funds must not be assumed protected |

**"Transfer received" and "Protected" are NOT interchangeable.** If the provider
reports a transfer but has not confirmed custody under the arrangement, show the
former.

State copy: awaiting transfer, "Your transfer hasn't been confirmed yet";
transfer received, "We received confirmation of your transfer. We're verifying
the protected arrangement"; protected, "Your payment is held under your
agreement"; handover pending, "Your payment remains held while you complete
handover"; under review, "This transaction is under review. No release decision
has been made"; release processing, "Your release instruction has been
submitted"; released, "The bank has confirmed the release"; refund processing,
"Your refund instruction has been submitted"; refunded, "The bank has confirmed
the refund"; action required, "We need something from you before this
transaction can continue"; failed, "We couldn't complete this step. Your payment
status needs to be checked."

**Never use green for a pending action. Never use a lock icon alone to imply
money is held.**

## The screens nobody asks for, and all of them are essential

**A. Wrong amount received.** Transfers can be short, duplicated or wrong.
"We received a different amount. The amount received doesn't match your
agreement. Your transaction needs review before it can continue." Show agreed
amount, amount received, difference, reference, next steps. **Do not
automatically top up, release or refund.** Provide a reconciliation path. Any
additional payment is separately authorised and linked to the original.

**B. Late transfer and expired instructions.** "These payment instructions have
expired. We can no longer guarantee that a transfer to these details will be
matched to your booking. Contact Vallo before sending money." Money arriving
late puts the transaction into review. **Do not create a second active escrow
for the same agreement until the first is reconciled.**

**C. App closed or connection lost.** Recoverable from history. "Your
transaction is still here. We'll show the latest confirmed payment status when
we reconnect." Keep the last known state visible with its last-updated time.
**Never display stale cached status as live confirmation.**

**D. Transaction history.** Each row: property thumbnail, listing and location,
amount, role (buyer or seller), status, date, reference. Filters: All,
Awaiting, Protected, Completed, Under review. **A transaction stays accessible
after completion and must not disappear when a booking ends.**

**E. The permanent receipt**, useful to a member, an accountant, a bank or a
lawyer months later: Vallo legal entity and contact details, unique receipt
number, transaction id and provider reference, agreement id and version,
property identity, address and listing reference, buyer and seller names as
appropriate, category, amount, currency and itemised fees, funding date and
time, the custodian bank's verified legal name, the custody confirmation,
release or refund date and time, destination appropriately masked, dispute
history and outcome, verification status, audit events and timestamps, and a
way to verify the receipt through Vallo.

**Do not call it a bank statement or claim it is a legal certificate.** It is a
Vallo transaction record with evidence and provider references. Legal
admissibility and retention go to counsel.

**F. Notification centre.** Notifications correspond to REAL state changes, not
button presses. "Your payment has been released. The bank has confirmed the
release for your [property] transaction. View your receipt." "Your payment is
protected. Your transfer has been confirmed and your funds are now held under
your agreement." "Your transaction is under review. A report has been
submitted. Your transaction timeline has been updated." Quiet, factual
language. **No exaggerated "Congratulations, your money is safe forever".**

**G. Seller response deadline.** Show what was reported, what evidence was
submitted, what they can respond to, their deadline if contractually defined,
how to add evidence, and what happens if they do not respond. **Do not invent
deadlines.** With no defined deadline, show "Awaiting response", not a
countdown.

**H. Support and escalation.** One transaction-specific entry: "Need help with
this payment? Contact Vallo support and include this transaction reference.
We'll be able to see the payment timeline and help you understand the next
step." **Never ask members to send BVN, passwords, full card details or bank
logins through chat.**

**I. Custody explanation**, from the protected screen, the receipt and the help
centre: "Who holds the money? Your payment is held by [verified legal name of
the designated bank] under the applicable arrangement. Vallo provides the
marketplace, agreement and transaction experience. Vallo does not hold your
funds. The bank's role, the conditions for release and the dispute process are
described in your agreement and Terms." **This is where the custodian is named.
Do not obscure it, and do not call it the provider if that is not its legal
role.**

**J. Long-term rent and multi-stage transactions.** One "confirm check-in" is
not sufficient for every category. Annual rent releases on handover and
possession, not a hotel-style check-in. A sale may need documentation, title
verification, inspection and completion conditions. Hotels have booking dates
and cancellation rules. **Each category needs its own agreement template,
release milestone, dispute window and permitted refund outcome. Do not reuse
the short-let flow as a universal template.**

## Motion

Motion communicates certainty, not excitement.

| Interaction | Motion | Meaning |
|---|---|---|
| Payment choice | 160 to 200ms fade and slide | Selection made |
| Agreement confirmation | 180ms sheet rise | The member is committing |
| Funding instructions loaded | 220ms gentle reveal | Instructions ready |
| Waiting | Slow 1.8 to 2.4s progress cycle | System checking |
| Protected confirmation | 300ms shield outline draw, then check | Partner-confirmed |
| Timeline update | 180ms vertical reveal | New recorded event |
| Dispute submitted | 220ms confirmation sheet | Evidence received |
| Release or refund pending | Subtle pulse, no looping celebration | Waiting for partner |
| Released or refunded | Single check transition | Confirmed final state |

No continuous full-screen animations. Respect reduced motion. Keep transitions
light for low-end Android and slow connections.

Haptics: a light confirmation on successful copy, a modest success haptic only
when the server returns a confirmed state. **Never vibrate repeatedly while
waiting.**

Offline: show cached information, disable actions needing server validation,
make the stale timestamp prominent. **Queue no release or refund instruction
for later silent submission.**

## Weak network and accessibility

Cache the transaction summary, agreement reference, last confirmed status and
relevant instructions securely. Always show "Last updated at [time]" on cached
information. Do not cache sensitive account instructions indefinitely.
Skeletons for initial loading, never a blank screen. Explicit retry actions.
Thumbnails rather than large photos on transaction screens. Compressed evidence
uploads with retry. **Never lose a drafted dispute statement when the app
closes.** Never use colour as the only indicator. Support screen readers and
large text. Make account numbers and references easy to copy, select and read.
Keep the primary action reachable at 360px wide.

## The product decisions that are non-negotiable

| Decision | The rule |
|---|---|
| When does protection begin? | Only on verified provider confirmation that funds are held |
| Who controls release? | The authorised process defined by the agreement |
| Can the seller release funds? | Not unilaterally |
| Can the buyer claim an instant refund? | No, the process must be followed |
| What happens during a dispute? | Pause release where the arrangement permits, preserve evidence |
| What happens after expiry? | Reconcile before creating another funding instruction |
| What if the app closes? | The transaction stays accessible and recovers its verified status |
| What is the source of truth? | Provider-confirmed financial events in Vallo's auditable ledger |
| Who holds the money? | The named, verified custodian under the actual legal arrangement |

**The caveat:** "held by a licensed bank" must be backed by the real custody
contract and the applicable transaction arrangement. **The design cannot turn a
partner's marketing claim into a legal guarantee.** Release conditions must be
agreed per transaction type.

## The final recommendation

Do not make the protected payment screen look like a traditional bank app.
**Make it look like a Vallo transaction room.** Both parties should feel the
transaction is documented, visible and moving through a fair process. Every
important event traceable. Every amount reconciling. Every promise matching what
the payment partner has actually confirmed.

That is how Vallo builds trust beyond the payment itself.

---

# APPENDIX: THE PROVIDER'S COMMERCIAL AND PRESENTATION TERMS

Added 9 November 2026, from the provider's own document "How EscrowPay appears
on your platform", sent in reply to the founder's questions. These are the
provider's stated terms, not Vallo's invention. Verify them against the signed
agreement before relying on a number.

## The option Vallo is taking

The provider offers three presentation options, chosen by ticking clause 5.1
of their API Services Agreement, changeable later on 30 days written notice:

| Option | What it is | Fee |
|---|---|---|
| 1 | Their "Pay with" button at your checkout | Standard fees |
| 2 | **Your own checkout and pay button, with a small "Secured by" mark at the payment step** | **Standard fees** |
| 3 | Full white label, your brand only in app and website | Standard fees plus ₦250,000 per month from go live, on request only |

**Vallo is taking Option 2.** Build to Option 2. Section 3 of
`PROTECTED_PAYMENTS_BUILD.md` says exactly what that means on screen.

Option 3 was declined for launch: the provider is named in the Terms, privacy
policy, help centre and on receipts under EVERY option, so the monthly fee
buys only the removal of the payment-step mark, and a named CBN licensed
custodian at the payment step is a trust signal Vallo cannot yet generate on
its own. Note also that Option 3 carries non-circumvention for the agreement
term plus 12 months.

## Standard fees, all options

Money in:
- up to ₦250,000: 1.5% plus ₦150, capped at ₦3,000
- ₦250,001 to ₦50,000,000: 1.25% plus ₦150, uncapped
- above ₦50,000,000: agreed in advance. This is a pricing band, NOT a
  transaction limit.

Money out:
- ₦40 up to ₦50,000
- ₦70 above ₦50,000

Identity verification: ₦80 per user, once, charged only on a successful lookup.

Do not hardcode these in display copy. Fees shown to a member must come from
one configuration module so a repricing is one edit.

## True under every option

- Funds are held by the custodian bank and move only on Vallo's instruction.
- The provider never holds members' money.
- Every member verifies identity once.
- **Vallo must tell members that identity verification and the holding of
  funds are carried out by third parties.** This belongs in the flow, not only
  in the Terms.
- Vallo runs its own dispute process.

## The funds wording, to appear unaltered at or before payment

Two approved lengths. Put both in one constants module, import them, and add a
test that fails on any near-miss variant rendered anywhere in the product.

Full, for the confirmation screen and the receipt:

> Your payment is held by Rubies Microfinance Bank, licensed by the Central
> Bank of Nigeria, and released to the seller once you confirm delivery.

Short, for the payment step:

> Held by Rubies MFB, a CBN licensed bank, until you confirm delivery.

Do not paraphrase, soften, translate, split or reorder either one. The
custodian bank may only be named with wording the provider has agreed, and the
two strings above are that wording.

## Funding methods

Bank transfer only at the time of writing. No cards. This is why the launch
plan keeps the existing card rail for shortlets, hotels and restaurants and
sends rent down the protected rail: see section 6 of
`PROTECTED_PAYMENTS_BUILD.md` on paying from outside Nigeria.
