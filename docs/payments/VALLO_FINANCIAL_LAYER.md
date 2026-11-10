# The Vallo financial layer: Vallo presents, the provider holds

**Founder brief, 6 October 2026, translated into this repository's reality.**
Session 1. Read with `docs/payments/retired-provider-source/` open, and with ADR-0002.

---

## 0. The sentence that makes all of this legal, and it is the founder's own

> **Vallo uses regulated financial infrastructure partners to process and protect
> eligible transactions. Vallo does not hold customer funds.**

This resolves a contradiction that has sat in this repository since 25 September
and which Session 1 got wrong as recently as this morning.

**ADR-0002 banned the wallet because *Vallo* holding client funds between two
parties is regulated by the CBN and the objects clause does not cover it.** It did
not, and could not, ban a licensed third party from holding them. Under the
Paystack-only world there was no holder at all, so "no balance anywhere" was the
right reading. **Under the the retired provider rail there is a holder, and it is the retired provider.**

So a balance surface is legitimate **when, and only when, every one of these is
true**:

1. The money is held by the licensed provider, in that member's own account at
   that provider, not by Vallo.
2. No Vallo sentence says or implies Vallo holds, keeps, owns or guarantees it.
3. ADR-0003 is **accepted**, not proposed, and the merchant account is live.
4. The member-facing words come from `lib/money/copy.ts`, per rail, so the Terms,
   the help centre, the emails and the screens cannot drift apart.

**Until all four hold, nothing ships.** D48 stands unchanged in the meantime: the
`wallet`, `escrow` and `withdrawal` strings in `experience-features.en.ts` come out
now, because they describe custody *by Vallo* on a rail that does not exist yet.
What replaces them later is different copy, written against a live rail, saying
who actually holds the money.

---

## 1. What the retired provider actually provides, endpoint by endpoint

Checked against `docs/payments/retired-provider-source/index.txt`. **Every surface the
founder's brief asks for has a real endpoint behind it.** This is not aspiration.

| Founder's section | the retired provider capability |
|---|---|
| §10 Money centre, §11 Available vs Protected | `GET /v1/wallet` returns a customer's **main balance** and **escrow balance**. Two numbers, exactly the distinction asked for |
| §12 Withdrawal | Create payment intent with `withdrawalDetails.bankCode`; `GET` bank list |
| §13 Bank accounts, account-name confirmation | **Verify account number** resolves the account name *before* the withdrawal is created, which is precisely the "show who they are about to pay" step |
| §14 Transfers, Send money | Wallet transfers, in payment history as a typed entry |
| §15 Receipts, §35 Activity centre | **Get payment history**: money in and out across deposits, withdrawals, transfers, wallet transfers and escrow payments, each with amount, fee, status, type and a type-specific detail object |
| §30 Protected payment | Standard escrow: create, fund, confirm, claim, dispute |
| §42 Milestones | Milestone escrows: fund in full, release per milestone on buyer confirmation |
| §17 Blockchain | cNGN as BEP-20 on BSC to a master wallet address. **Deposits only, and the founder has already ruled Vallo does not build a crypto wallet** |
| §24 KYC | Merchant-customer create carries `bvn` and phone with their own verification state |

**What the retired provider does not give you, and the brief must not assume:**

- **No three-way split.** Paystack splits lister, Guarantee and Vallo in one
  transaction. the retired provider does not. On the escrow rail the Guarantee contribution and
  Vallo's commission have to be arranged as separate, recorded movements, and
  §48's revenue separation is therefore not optional bookkeeping, it is the only
  thing keeping customer money and Vallo money apart on that rail.
- **No plain cancel-and-refund.** The only documented route from a funded escrow
  back to a buyer is a dispute the merchant resolves as `REFUNDED`. §29's dispute
  centre is therefore not a nice-to-have: **it is the cancellation path**, and the
  member-facing word cannot be "dispute" when two people simply agreed to stop.
- **Ten requests per minute, per key, across all routes.** §19's smart routing,
  §20's failover health checks, §37's transaction search and any reconciliation
  sweep are all bounded by this. A per-listing or per-render call is already broken.
- **2 percent of the escrow amount**, 2.5 percent in the retired provider's own app, with
  `whoPays` choosing buyer, seller or both. **This is new money leaving the
  transaction and §44's True Cost must show it.** The escrow rail costs 2 percent
  more than the direct rail, and the founder has not yet said who absorbs it.

---

## 2. Provider abstraction: the rule, and the line it must not cross

The founder's principle is right and this repository should adopt it in full:
**Vallo is the product, the provider is infrastructure.** The frontend consumes
Vallo concepts (`Payment`, `Protected`, `Withdrawal`, `Receipt`), never
`retired_providerEscrow` or `PaystackCheckout`, and provider vocabulary stays inside the
adapter.

**And the founder drew the line himself, which is why this is sound rather than
cosmetic:** *"Do not conceal legally required disclosures ... clean abstraction,
not deceptive concealment."* That line is binding. Where a provider name is
required by a card-network rule, a banking rule, a provider agreement, a receipt,
a KYC flow, the Terms or a transaction disclosure, **it is shown**. The
abstraction governs the product surface, not the legal surface.

Three places this repository already gets right and must keep:

- `lib/money/copy.ts` is the single source for every money sentence. **Per-rail
  variants go there**, not into components.
- A hosted checkout that cannot be embedded is an **infrastructure boundary, not a
  deception**: prepare in Vallo, explain the step, hand off, verify server-side,
  return to a Vallo confirmation. Never dress the provider's page as Vallo's.
- **Never fabricate.** No invented blockchain hash on a fiat transaction, no
  provider reference relabelled as a transaction hash, no "Payment successful"
  before the provider has confirmed it. The repository already bans fabricated
  figures; §21 and §17 are the same rule applied to money status.

---

## 3. What is new work, and who owns it

The brief's 63 sections are not 63 features. Sorted by what this repository
already has.

**Already built, keep and surface better (Session 3):** receipts as a component
(no route yet), payment history reads, the admin Money desk, bank-account
management under `/agent`, transaction references, the document sheet.

**Built but unwired (Session 2):** the rail router and the provider seam. §6 and
§19 are *exactly* what they were built for and neither has a call site. Wiring
them is the single highest-leverage backend task after D40.

**Genuinely new, Session 2:** the Vallo status normalisation layer (§8), error
abstraction (§25), the ledger with revenue separation (§48), payment requests and
links (§40, §41), payment schedules (§43), the financial audit view (§28), the
support transaction view (§26), provider health and failover (§20), multi-currency
modelling (§49).

**Genuinely new, Session 3:** the Vallo checkout that understands space,
agreement, conditions and release (§4, §5), the transaction timeline in human
language (§9), the money centre (§10), the protected-payment experience (§30), the
dispute centre as a *member* surface (§29), the receipt vault (§57), the activity
centre (§35), the financial security centre (§36), payment health for landlords
(§56), the transaction passport (§54).

**Founder-only, and nothing above ships without it:** the the retired provider merchant account,
through sign-up, KYC, business upgrade and approval; counsel on ADR-0003; and the
decision on who absorbs the retired provider's 2 percent.

---

## 4. The eleven things the ChatGPT asset and design prompts never covered

Recorded because the founder asked specifically what was missed.

1. **A status vocabulary.** Eleven Vallo statuses with a provider mapping table,
   and the rule that a raw provider status never reaches a member.
2. **The transaction timeline as a designed object**, in sentences, not state
   names.
3. **Available versus Protected as a visual idea.** Two numbers that mean
   different things, where the wrong read costs somebody money.
4. **The receipt as a system**, not a component: numbering, vault, search,
   re-issue, share with a privacy-safe view.
5. **The reference system.** Transaction, receipt, agreement, space, provider
   reference and chain hash are six different things that must never be confused
   on screen.
6. **The dispute surface as a member experience**, when it is also the
   cancellation path.
7. **The support view**, which no design document has ever specified and which
   decides how long a member waits when something breaks.
8. **The financial audit view**: what the customer asked, what Vallo created, what
   the provider received and returned, what the webhook said, what Vallo recorded.
9. **Payment requests and links**, which turn every agent, hotel and landlord into
   a distribution channel.
10. **Multi-currency and the diaspora view**, where a sender in London sees a
    Nigerian price honestly converted with a real, timestamped rate.
11. **Provider failover that cannot double-charge.** The one place where a retry
    is a financial incident rather than a convenience.

## 5. Protected rental payments (D73 Part B, phases 11 and 12): built, off

The founder's ruling D73: rentals and other negotiated deals pay through escrow, held by the retired provider; fixed-price bookings pay by card directly (see `docs/ROOM_CHECKOUT.md`).

**One key, one switch (D77).** The escrow rail is ready when a the retired provider key is set and `payments_protected_pay_on` is on, nothing else. The key is ONE environment variable: `PROVIDER_TEST_SECRET_KEY` (an `sk_test_` key, the retired provider staging) or `PROVIDER_SECRET_KEY` (an `sk_live_` key, production); the host is chosen from the key's own prefix. `retired_provider_ESCROW_FLOWS_BUILT` is now true (the flows are tested end to end against fixtures written from the documented contract, `lib/payments/providers/retired_provider-fixtures.ts` and `lib/money/provider-arrangements-lifecycle.test.ts`); it stays as the code's own stop should a staging check fail. The database's `private.rentals_protected_pay_on()` reads `payments_protected_pay_on` (d77, which seeds the flag off); `rentals_protected_pay` is superseded and read by nothing. `PAYMENTS_KILL_PROTECTED_PAY=1` remains the outage stop. With the switch off, `escrow.*` webhooks are stored and parked as `escrow_flows_not_built`, exactly as before.

**Screens (D77).** The renter pays at `/agreements/[id]/fund` (the agreement page links there for an approved rental on the escrow rail): the agreed rent, the Vallo balance it comes from and how much of the rent it covers, and one money swipe that opens the escrow at the retired provider if needed and funds it (`lib/money/fund-actions.ts`), handing off to `/agreements/[id]/held`. Recorded states at `/preview/fund`.

**Untested until the `sk_test_` key arrives** (nothing here has met the retired provider itself): the real staging answers to every call above; that create-escrow accepts our multipart body and echoes `description`; the escrow list's page and limit parameter names; the fee rounding for `whoPays: both` (not used: the lister pays); the OTP-required error shape on funding; the webhook signature with the retired provider's real secret and the real `environment` values. The first staging run is the lifecycle test's sequence against the live sandbox, correcting `retired_provider-fixtures.ts` first wherever a field differs.

**The record.** `provider_arrangements` (one live per approved rent agreement), `provider_arrangement_milestones`, and the append only `provider_arrangement_events`. Vallo's state and the provider's `state`/`status` are stored apart (founder section 54). Only `provider_arrangement_observe` (service role) moves the state, forward only; it refuses a provider id or an amount that contradicts the record and raises a critical alert.

**The flow** (`lib/money/provider-arrangements.ts`, client `lib/payments/providers/retired_provider-arrangements.ts`, routes from `retired-provider-source/concepts_how-it-works.txt`):

| Step | the retired provider | Vallo state |
|---|---|---|
| Open | `POST /v1/escrow/create` (standard, multipart) or `POST /v1/escrow/milestone/create` (JSON), as the lister | `preparing`, then `awaiting_payment`, or `unknown` when unanswered |
| Pay | `POST /v1/payment/escrow`, `gateway: wallet`, as the renter, reference `<arrangement reference>-pay` | `payment_processing`; `escrow.ongoing` makes it `protected` |
| Release | `POST /v1/escrow/confirm-payment/{id}` (standard) or `/v1/escrow/milestone/confirm/{id}/{milestoneId}`, as the renter, on the renter's own confirmation | `release_requested`; `escrow.completed` makes it `released` |
| Otherwise | `escrow.claimed`, `escrow.disputed`/`investigating`, `escrow.refunded`, `escrow.split` | `released`, `disputed`, `refunded`, `split` |

the retired provider's 2 percent fee is borne by the lister (`whoPays: seller`, `VALLO_PRICING.md` section 6), so the renter pays exactly the agreed amount; the database holds every arrangement to it. Amounts are naira at the boundary and kobo everywhere else. The delivery window the retired provider is told is the days to move-in plus the 3 day claim window, because one day after it the lister may claim the money without the renter.

**No reference on create.** the retired provider's create-escrow takes no reference of ours, so Vallo writes `Vallo reference <reference>` into the escrow's `description`. An unanswered create is `unknown` and is found again by listing the lister's escrows (`GET /v1/escrow/transactions?type=sales`) and matching the reference and amount; it is never created a second time.

**Not built here:** the conditions engine and inspection evidence before release (phase 13), disputes and refunds (phase 14: the retired provider refunds only through a dispute), milestone funding from the screen (it opens standard escrow only), marking the agreement paid or opening tenancy records from a protected payment.

**Unverified against live docs** (each marked in the code): whether create-escrow echoes `description`; the page and limit parameter names on the escrow list; how half of an odd-kobo fee is rounded when `whoPays` is `both` (Vallo refuses rather than guess).
