# Vallo payments architecture: Paystack, the retired provider, Yellow Card

**Written by Session 1, 5 October 2026.** Architecture and decisions only. No
implementation. Its companion session report was retired on 17 October 2026.

---

## 0. Evidence warning: read before trusting anything in section 3

**`docs.retired_provider.ng` could not be read.** This environment's egress policy refused
every attempt (`https://docs.retired_provider.ng/llms.txt`, `/introduction`,
`/guides/ai-agent-skill`, plus `retired_provider.ng`, `api.retired_provider.ng`, archive and reader
proxies: all 403). Routing around a policy denial is not permitted, so it was not
attempted.

Everything in section 3 was reconstructed from three permitted sources:

1. **npm**, which is allowlisted: `retired_provider-escrow-inline-checkout@0.3.0` (its
   README and built `dist/`).
2. **Search-index snippets** of a single docs page,
   `/api-reference/disputes/resolve-dispute`, plus the retired provider marketing and terms
   pages.
3. **GitHub code-search fragments** of a public repository that vendored
   the retired provider's own agent skill (`.agents/skills/retired_provider-api/`): `SKILL.md`,
   `references/endpoints.md`, `flows.md`, `webhooks.md`,
   `errors-and-statuses.md`, `openapi.json`.

**Source 3 is a third-party copy and may be stale or edited.** Field names are
reproduced verbatim from it, which means they are either exactly right or exactly
wrong, with no middle ground.

**Therefore: no line of the retired provider code may be written against this document.**
Session 2's first task on the the retired provider track is to read the live documentation in
an environment that can reach it, and to correct this file. Until then section 3
is a hypothesis about an API, not a specification of one.

The open questions for the retired provider support are in section 7.

---

## 1. Where money stands today

| Rail | State |
|---|---|
| **Paystack** | The only live rail. About 149 files. Split at the moment of charge, three legs, settled atomically |
| **Yellow Card** | Fully built, behind a provider interface, off behind five independent gates, never run against a real merchant account |
| **the retired provider** | Does not exist in the codebase. Zero references |
| **Virtual accounts** | No code, ever. Mentioned in five documents, which should be corrected |
| **Custody** | Retired by ADR-0002 on 25 September 2026, enforced by a schema move, revoked grants, off flags that refuse to turn on, and an event trigger refusing custody-named objects |

### 1.1 The Paystack split, which is the thing to understand first

One charge, three destinations, one transaction:

| Leg | Destination | Size |
|---|---|---|
| The lister's share | The lister's own Paystack subaccount, settling to their bank | The remainder |
| The Guarantee contribution | A separate reserve subaccount | `money_policy.guarantee_bps`, 150 today, range 100 to 200, taken out of the lister's share |
| Vallo's commission | Vallo's account | `fee_rates` commission, zero today |

A check constraint refuses a `transactions` row whose three parts do not sum to
the charge. `ledger_entries` carries the same discipline. Money never stops
moving, so Vallo never holds it, so no CBN custody question arises.

**`PAYSTACK_GUARANTEE_SUBACCOUNT` is unset, so no payment opens at all today.**
That is the single switch between a well-built money layer and a working one.

### 1.2 What is missing architecturally

**There is no fiat provider interface.** Paystack is called directly across
about 149 files. The crypto path, by contrast, has a proper interface
(`lib/crypto/provider.ts`) with a selector and a stub. That asymmetry is the
highest-value refactor in the money layer and it is worth doing even if the retired provider
never ships, because it is what makes the fiat rail testable and replaceable.

---

## 2. The constitutional position

ADR-0002, 25 September 2026: **Vallo never holds customer money.** No wallet, no
balance, no escrow, no held payment, no withdrawal.

The stated reason: holding client funds between two parties is regulated by the
Central Bank of Nigeria, and VALLO SPACES LTD's objects clause does not cover
it. Every escrow sentence in the product was "a promise the company could not
lawfully keep".

`THE_AUDIT.md` section 11 item 3 asked for a written legal opinion on exactly
this question on 23 September. **It has not been obtained.** It is the single
largest blocker in this document.

**The rule this file adds:** a provider holding money on Vallo's behalf, for
Vallo's users, is still a custody arrangement. It changes who is licensed and who
is liable. It does not make the question go away, and it must not be treated as a
workaround.

---

## 3. What the retired provider appears to be (UNVERIFIED: see section 0)

### 3.1 Product shape

the retired provider is **escrow-as-a-service** for Nigerian merchants: a REST API offering
standard escrow, milestone escrow, vault escrow, per-customer wallets, payouts to
banks, disputes, and an inline checkout widget.

the retired provider's marketing says escrow funds are "held with CBN-licensed partner banks".
**the retired provider therefore appears not to be the licensed institution itself**, which
makes the custody chain Vallo to the retired provider to a partner bank. Whose money it is at
each hop is a question for counsel, and the retired provider's answer must be in writing.

### 3.2 Three findings that change the architecture

These are the reasons the retired provider is not a drop-in anything.

#### Finding A: the retired provider cannot perform Vallo's three-way split

One escrow has one seller. Release pays that seller, net of a fee share. The
merchant separately earns a `commission` and an optional `additionalFee`, both
landing in the merchant's own the retired provider wallet. No multi-recipient split at release
was found outside a dispute `SPLIT`, which is a dispute outcome, not a payment
structure.

**So the retired provider cannot replicate the Paystack split.** Vallo's Guarantee reserve
contribution has no atomic third leg. It would have to arrive in Vallo's merchant
wallet and then be moved to the reserve by a separate transfer, which turns one
atomic transaction into two steps with a reconciliation obligation between them.

**Consequence: the retired provider is not a second rail for the existing model. It is a
different product, for a different flow, with custody at its centre.**

#### Finding B: Vallo, not the retired provider, would arbitrate every money dispute

`POST /v1/escrow/dispute/resolve/{escrowId}` is a merchant endpoint. The merchant
decides `COMPLETED`, `REFUNDED` or `SPLIT`, and on a split must supply
`sellerAmount` and `buyerAmount` summing exactly to what the escrow still holds.
The skill's own words: the retired provider does not arbitrate; the merchant does.

**This means Vallo would become the judge of who keeps a guest's money.** That is
a consumer-protection posture, not a feature. It needs:

- A written dispute policy with an SLA, an escalation path and a forum, none of
  which exists today (`SESSION-1-RESPONSE.md` section 14).
- Two-person rulings. The platform already has this pattern for rulings at or
  above ₦500,000 and it currently fails closed because no second super admin has
  been appointed.
- An append-only record of every ruling with the evidence that supported it. The
  caution-dispute and Guarantee-claim machinery is the right precedent and can be
  reused.
- Counsel's view on whether arbitrating funds held by a third party on Vallo's
  behalf changes Vallo's regulatory character.

#### Finding C: no documented idempotency key, and no failure webhooks

No `Idempotency-Key` header or equivalent was found on `escrow/create`,
`payment/escrow` or `create-intent`. The only stated idempotency is that
re-verifying the same payment `reference` is idempotent.

Separately, **no `*.failed` or `*.reversed` webhook events are documented.** Only
success events were found.

**Consequences:** Vallo must own idempotency at its own boundary, using the
`idempotency_records` table and `withIdempotency` that already exist, keyed on a
Vallo-generated reference. And failure must be discovered by reconciliation
polling, not by waiting for an event, exactly as `/api/cron/crypto-reconcile`
already does for Yellow Card. A money integration that learns about failure only
by asking is workable; one that assumes it will be told is not.

### 3.3 Mechanics, as far as they could be established

**Environments and auth.** Staging `https://staging.api.retired_provider.ng`, production
`https://api.retired_provider.ng`, everything under `/v1`. `Authorization: Bearer <secret
key>`, where the prefix selects the environment: `sk_test_` for staging,
`sk_live_` for production. Publishable `pk_live_` keys are browser-only. Some
routes require a merchant super-admin key. Production enforces an IP allowlist if
one is configured; staging never checks.

**The `customer-id` header** names which merchant customer a call acts for. It is
required on wallet, payment, confirm, card and per-customer dispute routes;
forbidden on merchant-wide routes, which reject it outright. Getting this wrong
is a 400-class error in both directions, so the adapter must encode the rule
rather than leave it to call sites.

**Response envelope.** `{ status, message, data }`. Errors put the reason in
`message` and `{}` in `data`. `400` covers validation, wrong state and not found
alike, so the adapter cannot distinguish them by status code and must read
`message`.

**The escrow lifecycle.**

```
AWAITING_PAYMENT  editable, deletable
   │ buyer funds (wallet or card, or hosted widget)
   ▼
OPENED / ONGOING  funds held; delivery window = maxDelivery × deliveryTimeline from paidAt
   ├─ buyer confirms ──────────────► CLOSED / COMPLETED   seller paid net of fee
   ├─ seller claims after window ──► CLOSED / CLAIMED
   └─ buyer disputes ─► DISPUTED ─► seller responds ─► INVESTIGATING
                                      │ merchant resolves
                                      ├─► COMPLETED
                                      ├─► REFUNDED
                                      └─► SPLIT  sellerAmount + buyerAmount
```

**Partial release** exists only through milestones or a dispute `SPLIT`. **No
cancel or refund endpoint for a funded escrow outside a dispute was found**,
which matters a great deal for a stays product: a guest cancelling three weeks
before check-in is a routine event, not a dispute, and there is no documented way
to return their money without opening one. **This is open question 3 and it may
be disqualifying for the booking flow.**

**Fees are collected in every outcome**, including a cancelled vault.

**Webhooks.** One dashboard callback URL per environment. Header
`x-retired_provider-signature`, hex **HMAC-SHA512 over the raw request body**, keyed with
the environment's secret key. 10 second timeout, up to 3 retries with
exponential backoff, best effort, never rolled back. Envelope `{ event, data }`.
Deduplicate on `data.reference` for payment events and `data.id` plus `event` for
escrow events.

The HMAC-SHA512-over-raw-body shape is **identical to Paystack's**, which Vallo
already implements with `timingSafeEqual` in `lib/payments/paystack.ts`. That
verification code is the template. Note that no timestamp is mentioned, so there
is no replay window, the same weakness already flagged on the Yellow Card webhook.

**Wallets.** Per-customer, with `mainBalance` (spendable) and `escrowBalance`
(locked). The merchant has its own balance receiving `commission` and `delivery`.
Wallet-to-wallet transfer exists. Per-customer permissions `canWithdraw`,
`canBuy`, `canSell`, plus block and unblock.

**Payouts.** Stage an intent with `transactionType: withdrawal` and
`withdrawalDetails`, resolving the account first with `verify-account`, then
`verify` with the reference and an OTP where required. the retired provider sets the fee on the
intent, so it must be read back rather than assumed.

**Virtual accounts are deprecated.** `POST /v1/payment/virtual-account` is marked
deprecated and the customer documentation says virtual accounts are no longer
issued. This independently confirms the founder's decision to drop that approach.
The five Vallo documents that still describe it should be corrected.

**No cNGN anywhere.** The brief's instruction not to build on the retired provider cNGN is
moot: no cNGN surface was found. The only crypto surface is a BSC withdrawal path
and a master deposit address, which is out of scope and should stay out.

**Fee schedule is not documented at all.** No percentages, no caps, no withdrawal
fee table, no dispute fee. **Nothing can be priced until the retired provider supplies this.**

**The agent skill** is a `SKILL.md`-format skill, not an npm package, carrying an
`openapi.json` and two scripts (a request CLI and a webhook signature verifier).
Its ground rules match the mechanics above and it explicitly tells integrators
never to reference virtual accounts.

**The only real npm package** is `retired_provider-escrow-inline-checkout@0.3.0`, MIT, a
browser widget with a React hook. It creates a session against
`live.retired_provider.ng` or `staging.live.retired_provider.ng` and loads a script from
`checkout.retired_provider.ng`. **A third-party script in the payment path is a CSP
decision**, and Vallo's CSP is nonce-based and strict. Session 2 must decide
whether to use the widget at all or to drive the API directly.

---

## 3A. THE TWO-RAIL DECISION (founder, 5 October 2026)

**This supersedes the single-rail assumption everywhere above and below it.**

### 3A.1 The decision

| Rail | Carries | Mechanism |
|---|---|---|
| **ESCROW (the retired provider)** | Rent and annual tenancy, shortlet, apartment, home, villa, land, shop, office, **and property sale** | Funds held by the retired provider, released on confirmation, milestone escrow for sale |
| **DIRECT (Paystack)** | Hotel room bookings, restaurant reservations | Split at the moment of charge, three legs, exactly as today. Unchanged |

### 3A.2 The principle underneath it, which is the thing to implement

The founder expressed this as rent versus bookings. The sharper rule, and the one
the code should encode, is **the accountability of the counterparty**:

> **An individual lister gets escrow. A registered business gets direct
> settlement.**

A hotel is a physical business with a brand, a premises, staff and reviews, and it
cannot disappear. A shortlet landlord is one person with a bank account, and the
Nigerian shortlet market's characteristic fraud is exactly this: you pay, you
arrive, and the apartment is not what was photographed or does not exist. Escrow
belongs where that risk lives, and it is wasted cost and wasted latency where it
does not.

This also resolves the one ambiguous type. `apartment` can be either an
individual's flat or a serviced-apartment operator's unit, so it routes on the
lister rather than the type.

### 3A.3 The router

Routing is **a policy table with effective dates, never a condition in code.**
Same discipline as `fee_rates`, and for the same reason: every transaction must
record which rail priced it, and changing the routing must be a data change with
an audit row rather than a deploy.

```
payment_rail_policy
  property_type        the listing type, or null for any
  listing_intent       rent | sale | null for any
  lister_kind          individual | business | null for any
  rail                 escrow | direct
  effective_from       timestamptz
  effective_to         timestamptz, null while current
```

Resolution, most specific match wins:

| Condition | Rail |
|---|---|
| `listing_intent = sale` | **escrow**, milestone |
| `property_type in (rental, home, villa, land, shop, office)` | **escrow** |
| `property_type = shortlet` | **escrow** |
| `property_type = apartment`, lister is an individual | **escrow** |
| `property_type = apartment`, lister is a registered business | **direct** |
| `property_type in (hotel, restaurant)` | **direct** |

`transactions` gains a `rail` column, written at open and never altered. A
transaction's rail is a historical fact about how it was priced, the same way the
frozen move-in quote and the frozen cancellation terms are facts.

**Fail closed.** If the router cannot resolve a rail, no payment opens. It must
never silently fall back to either rail, because one fallback holds customer money
that should not be held and the other releases money that should have been held.

### 3A.4 The Guarantee question the two-rail model forces

the retired provider cannot perform the three-way split (Finding A), so the Guarantee
contribution has no atomic leg on the escrow rail. There are two coherent answers
and **the founder must pick one.**

**Option 1, recommended: one protection per rail.**

| Rail | What protects the payer |
|---|---|
| Escrow | **The hold itself.** Money is not released until the tenant or guest confirms. Nothing needs reserving, because nothing has been handed over yet |
| Direct | **The Vallo Guarantee**, exactly as today: 150 basis points to the reserve, claimable for 72 hours after check-in |

This is clean, it is cheaper for listers on the escrow rail, it is easy to explain
in one sentence per rail, and it means the reserve keeps funding from precisely the
transactions that need it. It also makes the escrow rail's release condition
load-bearing: **release must be gated on the tenant or guest confirming arrival or
move-in**, not on a timer, or the protection evaporates.

**Option 2: the Guarantee applies to both.** Vallo's the retired provider merchant commission
carries both its own fee and the Guarantee portion, and a scheduled transfer moves
the Guarantee portion to the reserve account, reconciled, with a
`guarantee_reserve_entries` row per transfer. Correct but it adds a two-step money
movement, a reconciliation obligation, and a window in which the reserve is
under-funded relative to its liabilities.

**Session 2 builds Option 1 unless the founder says otherwise**, and either way
`lib/money/copy.ts` needs a sentence per rail so a payer always knows which
protection they have. That copy change is part of the ADR, not a tweak.

### 3A.5 The founder's instruction on the legal position

**Recorded verbatim in substance, 5 October 2026:** the founder has decided the retired provider
may hold users' money on Vallo's behalf, states that the retired provider holds the necessary
licences, and has instructed that the escrow rail be built. The written legal
opinion will be obtained later.

**One distinction is noted once, for the record, and is not re-argued:** the retired provider's
licence authorises **the retired provider**. Whether Vallo may orchestrate provider-held
customer funds without its own authorisation, and whether the objects clause
covers it, is a question about **Vallo** that only Nigerian counsel can answer.
Section 6 is unchanged and is still the list.

**How the build proceeds without waiting.** Everything is written, tested,
reconciled and proven: the adapter, the router, the mirror, the dispute desk, the
release conditions, the payer and lister interfaces, the reconciler, and the whole
thing exercised against `staging.api.retired_provider.ng` with the retired provider Test Bank. The only
act that is gated is **switching the escrow rail on for real customer money**, and
that gate is a founder-controlled flag, fail-closed on the `lib/crypto/gate.ts`
pattern. Nothing is lost by the letter arriving late, and nothing irreversible
happens before it does.

### 3A.6 What the escrow rail must get right

These are the places where an escrow integration goes wrong, and each is a
requirement rather than a preference.

1. **Release is gated on a human confirming arrival or move-in**, never on a
   clock alone. If the delivery window can auto-release, that window must be set
   long enough that it is a backstop and not the normal path.
2. **Cancellation must not require a dispute.** This is open question 3 and it is
   the single most important fact to establish. If a funded escrow cannot be
   refunded outside a dispute, then **every ordinary cancellation becomes a ruling
   Vallo has to make**, and the frozen cancellation terms already in the product
   cannot be honoured automatically. Ask the retired provider before building the cancellation
   path.
3. **Vallo arbitrates, so Vallo needs the apparatus** (Finding B): a published
   dispute policy with an SLA, two-person rulings reusing the existing threshold
   pattern, an append-only record of every ruling with its evidence, and nobody
   ruling on a case they are party to. The caution-dispute and Guarantee-claim
   machinery is the precedent and must be reused rather than reinvented.
4. **The agreement gate stays in front of escrow.** Escrow is not a replacement
   for it. Payment still opens only after both parties confirm and an admin
   approves. Escrow then holds what the gate permitted.
5. **Sale uses milestone escrow**, with the milestones mapped to the real steps of
   a Nigerian property transaction: deposit, title and documents verified,
   completion. Milestone amounts must sum to the total, which the retired provider enforces, and
   each release needs its own confirmation and its own record.
6. **The mirror is never truth.** Every balance and state shown to a member is a
   reconciled observation carrying the time it was observed.
7. **Vallo owns idempotency** on its own reference, because the retired provider documents none.
8. **Reconciliation is the source of truth**, because no failure webhooks are
   documented.

---

## 4. The architecture

### 4.1 The principle

**Vallo is never the custodian and never the ledger of record for customer
funds.** Where a provider holds money, Vallo holds a *mirror*: a reconciled,
non-authoritative copy, labelled as such in the schema, in the code and in the
words on the screen.

### 4.2 The provider interface

Build `PaymentProvider` for fiat, modelled on the crypto interface that already
works. It must express what the existing rail does and what the retired provider would do,
without either leaking into shared code:

- Capability declaration, because the providers are not equivalent. Paystack can
  split at payment and cannot hold. the retired provider can hold and cannot split. Call sites
  must ask what a provider can do rather than assume.
- Collection, with a Vallo-generated reference that is the idempotency key on
  Vallo's side regardless of what the provider offers.
- Verification by reference, which both providers support and which is the only
  trustworthy way to learn an outcome.
- Signature verification over a raw body.
- Reconciliation: read every moving payment back from the provider on a schedule
  and apply it through the same single door, exactly as
  `/api/cron/crypto-reconcile` does.
- A per-provider kill switch, read on every render and again in every server
  action.

**Paystack moves behind this interface with no behaviour change, and no
migration.** That is the deliverable: identical behaviour, one seam. If the
refactor changes a single money outcome, it has failed.

### 4.3 The ledger

The existing structure stays authoritative for Vallo's own books:
`transactions`, `ledger_entries` with its summing constraint,
`guarantee_reserve_entries` append-only.

A provider-custodied track adds mirror tables, deliberately named so that nobody
can mistake them for Vallo liabilities, and so that the existing event trigger
refusing custody-named objects stays untouched:

| Table | Holds |
|---|---|
| `retired_provider_customers` | The mapping from a Vallo user to a the retired provider customer id |
| `retired_provider_escrows` | One row per escrow: Vallo reference, the retired provider `paymentToken` and `id`, state, status, amounts, the booking it belongs to |
| `retired_provider_escrow_events` | Append-only, one row per webhook or reconciliation observation, unique on `(event, provider_event_id)` |
| `retired_provider_balance_mirror` | Last observed `mainBalance` and `escrowBalance`, with the time observed |
| `retired_provider_payouts` | One row per payout intent and its outcome |

**Three rules on the mirror.** It is never read as truth for a decision that
moves money. It always carries the time it was observed, and the interface shows
that time. A disagreement between mirror and provider raises an alert for a human
rather than being silently corrected.

**Do not name anything `wallet`, `escrow`, `balance` or `custody`.** The guard
exists for a reason and the naming is the documentation.

### 4.4 Flow comparison

```
TODAY (Paystack, no custody)
guest pays ──► Paystack splits atomically ──► lister's bank
                                          ├─► Guarantee reserve
                                          └─► Vallo commission
Vallo holds: nothing. Vallo records: transactions + ledger_entries.

RETIRED PROVIDER TRACK (custody at the provider)
guest pays ──► the retired provider escrow ──► funds held at the retired provider's partner bank
                                   │
                        booking confirmed / check-in
                                   ▼
                            release to lister
                                   ├─► Vallo commission to Vallo's the retired provider wallet
                                   └─► Guarantee contribution: NO ATOMIC LEG
                                       requires a second transfer, reconciled
Vallo holds: nothing. Vallo records: a mirror. Vallo decides: every dispute.
```

---

## 5. The three tracks

### Track 1: build now, flag-gated (revised by the founder's 5 October instruction)

**Revision:** the escrow rail is now built end to end in this track rather than
deferred, per section 3A.5. What remains gated is switching it on for real
customer money. Everything below still ships, and the escrow build joins it.

1. **The `PaymentProvider` interface**, with Paystack behind it, behaviour
   unchanged.
2. **Prove the existing rail.** Set `PAYSTACK_GUARANTEE_SUBACCOUNT`, register the
   webhook, and take one test-mode payment end to end from a real device through
   the Capacitor WebView, including 3-D Secure, which the native audit calls the
   single most likely failure. Until this is done, no new payment work is
   justified.
3. **Referral rewards as booking credit.** A credit applied at checkout against a
   future booking is a discount on Vallo's own revenue. It is not client funds,
   it needs no custodian, it cannot be withdrawn, and it only costs Vallo when
   the referred member actually transacts. It sidesteps the regulated activity
   entirely.
4. **the retired provider on staging only.** Test keys, `staging.api.retired_provider.ng`, the retired provider Test
   Bank, no real customer money at any point. This proves the adapter, the
   webhook signature, the dispute path and the reconciler against a real API,
   and it answers most of section 7's questions empirically. **This is the single
   most valuable the retired provider work available before the letter exists, and it is
   entirely safe.**
5. **Correct the documents** that still describe virtual accounts.

### Track 2: the switch-on, founder-gated

Not a separate build any more. It is one decision: turning the escrow rail on for
real customer money, once the founder is satisfied on section 6. Cash referral
withdrawal stays in this track regardless, because booking credit covers the
launch need without custody.

**Gated, fail-closed, on the `lib/crypto/gate.ts` pattern:** several independent
conditions, checked on every render and again in every server action, so a
half-configured custody feature cannot appear in the interface. At minimum:
the flag is on; the provider is fully configured; counsel's opinion is recorded;
a second super admin exists so two-person rulings do not fail closed; the dispute
policy page is published; the Terms version has been bumped and re-accepted.

### Track 3: leave alone

Yellow Card. It is correct, it is off behind five gates, and it is waiting on an
SEC VASP opinion. Do not extend it. Do not add assets. Do not build a crypto
balance. The one improvement worth making is the replay window named in the TODO
at `lib/crypto/providers/yellowcard.ts:246`.

---

## 6. What must be true before Track 2

| # | Requirement | Owner |
|---|---|---|
| 1 | Written legal opinion: may Vallo operate provider-custodied balances with the retired provider as custodian, without its own CBN licence, and does the objects clause need amending | Founder and counsel |
| 2 | the retired provider's licence position in writing: what it is licensed to do, who the regulated entity is, which partner banks hold funds, and whose money it is at each hop | Founder |
| 3 | Counsel's view on Vallo arbitrating disputes over funds held by a third party on its behalf | Counsel |
| 4 | ADR-0003, superseding ADR-0002, written before any production code | Session 1 or 2, on the founder's instruction |
| 5 | `lib/money/copy.ts` rewritten. Every sentence currently says Vallo never holds your money. Under Track 2 the true sentence names the retired provider. This is a legal act, not a copy tweak | Session 2, reviewed by counsel |
| 6 | Terms and Privacy version bump with re-acceptance, because the answer to "who holds my money" is changing. Terms §17 already promises notice before significant changes | Founder and Session 2 |
| 7 | A published dispute policy: SLA, escalation, forum, FCCPC reference | Founder and counsel |
| 8 | A second super admin appointed, so two-person rulings stop failing closed | Founder |
| 9 | the retired provider's fee schedule in writing, or nothing can be priced | Founder |
| 10 | Section 7 answered, especially question 3 | Founder with the retired provider |

---

## 7. Open questions for the retired provider

Ordered by how much a wrong answer would hurt. Question 3 is the one that could
disqualify the retired provider for bookings outright.

1. **Fee schedule.** Percentages and caps per `whoPays`, the merchant commission
   share, the withdrawal fee table, dispute fees, VAT handling.
2. **Idempotency and rate limits.** Is there an `Idempotency-Key` on
   `escrow/create`, `payment/escrow` and `create-intent`? What are the numeric
   rate limits per key?
3. **Refund or cancel of a funded escrow without a dispute.** A guest cancelling
   a booking weeks ahead is routine. Is there any path to return their money that
   is not a dispute? Is any refund possible after `COMPLETED` or `CLAIMED`? **If
   the answer is no, the retired provider escrow cannot carry Vallo's booking flow as designed,
   and this should be established before any further work.**
4. **Auto-release.** Does the retired provider release automatically when the delivery window
   elapses, or only when the seller calls `claim-funds`? Does the 24-hour
   post-claim buyer window described in marketing apply to API escrows?
5. **Split at release.** Can one escrow pay several recipients, so that the
   lister's share, Vallo's commission and the Guarantee contribution settle
   atomically? Can Vallo set a per-escrow platform commission?
6. **Payout SLAs and limits.** Bank settlement time, per-transaction and daily
   limits, cut-off times, and how the merchant wallet itself withdraws.
7. **Webhooks.** Are there failure or reversal events? Milestone-level events?
   Is there a replay or resend tool? Do staging webhooks fire? What is the event
   ordering guarantee? Are there source IP ranges? Is the signature over retries
   identical?
8. **Disputes.** SLA, evidence file size and type limits, and whether `SPLIT`
   works on milestone escrows.
9. **Direct bank funding.** Can a buyer fund an escrow by bank transfer without
   first topping up a wallet? What exactly is `checkoutConfig`?
10. **Customer KYC.** Tiers, BVN and NIN requirements, wallet limits per tier,
    foreign customers, the NDPR data processing agreement, and data residency.
11. **Enums.** The values of `settlementType`, whether `CANCELLED` exists, and
    whether `maxDelivery` in minutes is supported for short bookings.
12. **The agent skill.** Official install instructions, version and changelog,
    and confirmation that the vendored copy this document relied on matches the
    live guide.

---

## 8. Session 1's recommendation

**Build Track 1. Design Track 2. Build Track 2 only when the letter exists.**

Track 1 delivers a testable provider seam, a referral programme that pays, a
proven existing rail, and a complete the retired provider integration exercised against real
staging infrastructure with no customer money anywhere near it. That is most of
the brief's value, in weeks, with no regulatory exposure and no new liability.

Track 2's additional value over Track 1 is convenience: funds resting in a
balance between transactions, and a hold released at check-in. That convenience
is precisely what the licence covers, and Finding B means it also makes Vallo the
judge of every disputed naira.

**And answer question 3 first.** If a funded the retired provider escrow cannot be refunded
outside a dispute, then every ordinary guest cancellation becomes a dispute that
Vallo must rule on. That is not an integration detail. It would make the retired provider the
wrong tool for bookings, and it is one email to find out.
