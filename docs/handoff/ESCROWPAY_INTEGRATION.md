# EscrowPay integration: where it stands (14 November 2026)

Written the day the provider's documentation was first read and its sandbox
first run with Vallo's own test key. It replaces the "unknown" list in
`PAYMENTS_MIGRATION_AUDIT.md` section 10.2: every item there is now answered
below from the provider's own documents or from the sandbox itself.

## 1. How one protected payment runs at the provider

Source: the Merchant API's public OpenAPI document (66 operations) and the
guides at docs.escrowpay.app.

1. **Both people are parties.** The payer and the lister are each made a
   party once (`POST /parties/onboard`), by an identity check against their
   NIN or BVN and date of birth. Vallo gives the provider the member's Vallo
   id as `external_reference` and finds them again with
   `GET /parties?external_reference=`. Vallo stores nothing of the number.
2. **The lister has a payout account.** Made from the bank account already on
   their Vallo account (`POST /payout-accounts`); the provider runs its own
   name check.
3. **A transaction is made as a draft** (`POST /transactions`, exact amount,
   manual release, manual refund, automatic payout to the lister's account,
   Vallo's reference as `external_reference`), then **activated**.
4. **Transfer details are issued** for that one transaction: a payment
   account good for the whole 48 hour window
   (`POST /transactions/{id}/payment-accounts`), then a checkout session
   (`POST /transactions/{id}/checkout-sessions`) whose `payment_instructions`
   name that account, its account name and **the exact total to transfer:
   the amount plus the provider's fee, because the payer bears the fee by
   default**. These are what screen 3 draws. Vallo never sends a member to
   the provider's hosted page.
5. **The bank reports it funded** (webhook `transaction.funded`). Vallo
   records `protected`.
6. **The payer confirms the handover**; Vallo instructs the release of the
   whole amount (`POST /transactions/{id}/releases`). The provider reports
   `release.completed`; Vallo records `released`. The payout to the lister's
   bank follows by itself where automatic payout is on (section 6,
   decision 1).
7. **Or staff instruct a refund** of the whole amount from the bank's hold
   (`POST /transactions/{id}/refunds`, source `escrow_held`). The provider
   reports `refund.completed`; Vallo records `refunded`.

Every call that creates or changes money carries an `Idempotency-Key` built
from Vallo's stored reference and the step, so a step asked twice is one
request.

## 2. What the founder sets

In Vercel, for Production (server only, never `NEXT_PUBLIC_`):

| Name | Value |
|---|---|
| `ESCROWPAY_API_BASE_URL` | `https://production-business-api.escrowpay.app` |
| `ESCROWPAY_API_KEY` | the secret key from the dashboard, Developers, API keys (`sk_test_...` now, `sk_live_...` after KYB) |
| `ESCROWPAY_WEBHOOK_SECRET` | the `whsec_...` signing secret, shown once when the endpoint is created |
| `ESCROWPAY_ENVIRONMENT` | `sandbox` with a test key, `production` with a live key |

In the provider's dashboard, Developers, Webhooks, Add endpoint:

- URL: `https://www.vallospaces.com/api/escrowpay/webhook`
- Events: tick every one. Vallo acts on the funding, release and refund
  events and records the rest untouched.

A test key in Production is safe: it records webhooks and never opens a
payment. Nothing is offered to a member until section 6 is settled.

## 3. The sandbox run (14 November 2026)

Run twice: by hand, call by call, to see every answer; then by Vallo's own
rail code, unchanged, in `sandbox.e2e.test.ts`
(`ESCROWPAY_SANDBOX_KEY=sk_test_... npx vitest run src/lib/payments/providers/escrowpay/sandbox.e2e.test.ts`).
The test passes five of five, twice in a row, with `ESCROWPAY_SANDBOX_PAYOUT=manual`.

| Step | What the sandbox answered |
|---|---|
| Credential | `environment: test`, scopes `*` |
| Identity check, right details | 201, a party `PAR_...`, status `active`, the masked number and the verified name |
| Identity check, wrong date of birth or number | 422 `identity_verification_failed`, no party |
| Identity check needing a person | 422 `identity_requires_review`, no party |
| The same number a second time | 409 `identity_already_exists` |
| Find a member by Vallo's id | `GET /parties?external_reference=`, `data.items` |
| Bank list | `data.banks`, six-digit interbank codes (`000013` for GTBank). A three-digit code is refused: `Unknown bank_code` |
| Payout account | 201, `PAC_...`, status `verified`, the name the provider's enquiry found |
| The same bank account for a second party | 409 `payout_account_exists` |
| Transaction | 201, `TXN_...`, status `draft`, `version` 1, the fee estimate |
| Activate | status `pending_funding`, `version` 2 |
| Checkout session | `payment_instructions` with the account, `account_name` and `amount_minor` of 182,850.00 for a 180,000.00 payment (the fee of 2,850.00 on top) |
| Simulated transfer (the test checkout's own door) | status `funded`, `funded_minor` the full amount |
| Release | 201, release `completed`; the transaction reads `released` |
| Refund from the hold | 201, refund `completed`, destination the original payment source; the transaction reads `refunded` |
| Cancel an unfunded one | status `cancelled` |
| The same idempotency key again | the same record back; with a changed body, 409 `idempotency_conflict` |

Four things the sandbox showed that no document said, each now handled:

1. **The secret key begins `sk_test_`** (the guide writes `ep_test_sk_`). Both
   spellings are read; a key whose book does not match
   `ESCROWPAY_ENVIRONMENT` is still refused.
2. **The payer is asked for the amount plus the fee.** The review screen and
   the funding screen now show the provider's own total, from the provider's
   own estimate (`POST /fees/estimates`), never a figure worked out by Vallo.
   The provider's bands are progressive: 7,025.00 on 500,000.00, where
   `lib/money/protected-fees.ts` would say 6,400.00.
3. **Automatic payout is switched off on Vallo's account.** A transaction
   that asks for it is refused: `policy_violation`, `automatic_payout_disabled`.
   With the provider's other mode a release lands in Vallo's own balance at
   the provider, and a payout to the lister is a second step. See the first
   decision in section 6.
4. **A payout carries its own fee** (40.00 or 70.00), charged to the business
   on top of the amount: a payout of the full released amount is refused for
   want of balance.

After that run a re-audit changed two things in the read-back, both held
by tests on stand-in answers and not yet re-run against the sandbox (the
test key was discarded): while a release or refund is in flight, or a
payment is disputed or with a person, the provider saying "still held"
changes nothing; and the provider's state recorded at the open is its word
after activation, not the draft before it.

Not reached on the sandbox: a real webhook delivery (no endpoint is
registered yet; the signature check is tested against the documented scheme
with real HMACs), the `expired` state, and the automatic payout itself.

## 3b. The payout to the lister (automatic, 15 November 2026)

After the bank releases a payment, the provider sends it to the lister's
bank by itself. Vallo records that step from the provider's own word, on its
own columns (pending SQL `protected_payout_to_lister_2026-11-15.sql`), never
as the payment's state:

- the provider's `payout.created`, `payout.processing`, `payout.completed`,
  `payout.failed` and `payout.reversed` webhooks, matched to the payment by
  the transaction they settle (`lib/money/protected-payout.ts`);
- a read-back in the reconcile job for a release whose payout is not yet
  known to have completed: by the payout's id when a webhook named it,
  otherwise from the payouts made since the release (the provider's list has
  no transaction filter, so Vallo matches it);
- a step only forward (paid is left only for reversed; a failed transfer
  may be retried), never over a write somebody else made in between;
- the lister's screen says "on its way to your bank account" until the
  provider says paid, then the date it reached them; a failed or returned
  transfer is said plainly, staff are alerted, and the database tells the
  lister once.

Not yet seen on the sandbox: automatic payout is switched off on Vallo's
account there. The shape of a payout (`POT_...`, `completed`, the
transaction, amount, fee, `completed_at`) was seen on the sandbox from a
payout made by hand on 14 November.

## 4. What is built

| Piece | File | State |
|---|---|---|
| Configuration, key and marker rules, payout preference | `lib/payments/providers/escrowpay/config.ts` | Tested |
| HTTP client, auth and idempotency headers | `.../client.ts` | Run against the sandbox |
| Every request body | `.../requests.ts` | Run against the sandbox |
| Readers for the provider's answers | `.../read.ts` | Field names taken from the sandbox |
| Status words and event names onto Vallo's states | `.../normaliser.ts` | Status words seen on the sandbox; events from the guide |
| Webhook signature and envelope | `.../webhooks.ts` | From the guide, tested with real HMACs; no real delivery seen yet |
| Parties, payout account, the two bank code books, the fee | `lib/money/protected-provider.ts` | Run against the sandbox |
| Open, transfer details, read-back, release, refund, dispute, new details, webhook, reconcile | `lib/money/protected-rail.ts` | Open, read-back, release, dispute and refund run against the sandbox; new details and the webhook on stand-in answers |
| Identity and start actions | `lib/money/protected-actions.ts` | Tested |
| Start screen (review, identity, open) on the funding page | `components/money/protected-rail/ProtectedStart.tsx`, `IdentityCheck.tsx` | Seen in a browser at phone width through `/preview/protected?screen=identity` |
| Lister readiness card on Settings, Payments | `ProtectedSetup.tsx` | Seen in a browser through `/preview/protected?screen=setup` |
| The payout to the lister: webhooks, read-back, the lister's screen, the staff desk | `lib/money/protected-payout.ts`, `ListerProtectedView.tsx`, `app/admin/arrangements` | Tested; the SQL tested on a local Postgres (`supabase/tests/protected_payout`); the lister's screen seen in a browser through `/preview/protected?screen=lister-paying`, `lister-paid`, `lister-payout-failed` |
| Webhook route | `app/api/escrowpay/webhook/route.ts` | On the real signature; 18 tests post signed deliveries through the handler itself |
| The dispute desk: one payment's record, its trail with both statements, and the two decisions (refund the payer, release to the lister) | `app/admin/arrangements/[id]`, `ArrangementRecord.tsx`, `lib/admin/arrangement-actions.ts` | Tested; seen and driven in a browser through `/preview/protected/staff`. Finance door, a reason of 20 characters, the audit line written before the instruction |
| The choice between the protected transfer and card | `components/money/pay-choice/PayChoiceCard.tsx` on the agreement page (already live in its switched-off form) | Leads to the funding page, which now starts the payment |

The live database needed nothing new: the arrangement table, its lifecycle
functions and the webhook event store were applied on 10 November.

## 5. What is NOT done, plainly

1. **No member has used it and no page on the live site shows it.** The
   screens were driven in a browser only through the preview page; the whole
   journey on a real agreement needs the switches of section 6 on, on a
   deployment with a key that may start a payment.
2. **No real webhook has been received.** The first one after the endpoint is
   created should be checked in `provider_webhook_events` (signature valid,
   the event's fields as `webhooks.ts` reads them). Until then a missed or
   misread event is caught by the read-back, which runs on the status words
   above.
3. **An expired set of transfer details** has not been lived through on
   the sandbox (it needs the 48 hour window to pass). Asking for new details
   extends the deadline and issues a second account under a new request; the
   extend call and the second account are on stand-in answers only.
4. **A named payer who is not the viewer** is told nothing: the tenant sees
   the review, and the open is refused until that payer has done the check.
5. **The bank code table** (`INTERBANK_CODE`) covers the banks most accounts
   are held at. Six of its codes were checked against the sandbox's bank
   list; the rest are the published interbank codes and should be checked
   against the provider's live list before go-live. It is never trusted alone (the code must be on the provider's
   list, and on a live account the holder's name must match Vallo's own
   enquiry), but a lister at a bank outside it is told the bank is not
   supported until it is added.

## 6. Decisions that are the founder's

1. **How a lister is paid after a release: DECIDED, automatic** (the
   founder, 15 November 2026). A release goes straight on to the lister's own
   bank account, and Vallo's balance at the provider never carries a member's
   money. There is no setting for anything else. The provider has automatic
   payout switched off on Vallo's account today, so it refuses every
   transaction and nothing can open: the founder asks the provider to switch
   it on (test and live) and to say how the payout fee is charged. The
   sandbox test then runs without `ESCROWPAY_SANDBOX_PAYOUT=manual` and checks
   the payout reaches the lister.
2. **Who bears the money-in fee.** The provider charges the payer, on top of
   the amount, unless the account is set to "business". Vallo's ruling of 9
   November is that the lister pays. Until that is settled the screens tell
   the payer the truth as the provider has it: the total includes the fee.
3. **The identity check.** Every payer and every lister gives a NIN or BVN
   and a date of birth before a first protected payment. Vallo passes it on
   and keeps none of it, and the member consents on the screen. Counsel
   should see the screen's wording and the privacy policy line before go-live
   (SPECS Part 8: "never collect NIN or BVN without a verified security and
   compliance design").
4. **The identity fee** (₦80 per successful live check) and **the payout
   fee** are charged to the business by default.
5. **Who may decide a dispute.** One member of staff holding the finance
   scope can instruct a refund or a release, with a written reason and an
   audit line. If a second person should approve, that is not built.
6. **Two switches, both off today:** `payments_protected_pay_on` (whether the
   protected rail is offered at all) and `payments_escrowpay_on` (whether
   this provider may be asked). Both must be on, and a category approved in
   `protected_payment_categories`, before a member sees anything.

## 7. Order to go live

1. Push; set the four names in Vercel with the TEST key; create the webhook
   endpoint; make one test transaction and confirm a row with
   `signature_valid` in `provider_webhook_events`.
2. The founder's decisions in section 6; counsel's review.
3. KYB approved; swap to the live key and `production`; approve one category;
   turn on the two switches for a pilot.

## 8. The test key

The key used for the sandbox run was pasted into the build conversation. It
is a test key and moves no money, but it should be replaced with a new one
in the provider's dashboard (Developers, API keys) before it goes into
Vercel. A live key goes into Vercel only, never into a conversation.
