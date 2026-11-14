# EscrowPay integration: where it stands (14 November 2026)

Written the day the provider's documentation was first read. It replaces the
"unknown" list in `PAYMENTS_MIGRATION_AUDIT.md` section 10.2: every item
there is now either answered below from the provider's own documents, or
named as still waiting on the sandbox.

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
4. **Transfer details are issued** for that one transaction
   (`POST /transactions/{id}/payment-accounts`): bank, account name, account
   number, expiry. These are what screen 3 draws.
5. **The bank reports it funded** (webhook `transaction.funded`). Vallo
   records `protected`.
6. **The payer confirms the handover**; Vallo instructs the release of the
   whole amount (`POST /transactions/{id}/releases`). The provider reports
   `release.completed`; Vallo records `released`. The payout to the lister's
   bank follows by itself.
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
| `ESCROWPAY_API_KEY` | the secret key from the dashboard, Developers, API keys |
| `ESCROWPAY_WEBHOOK_SECRET` | the `whsec_...` signing secret, shown once when the endpoint is created |
| `ESCROWPAY_ENVIRONMENT` | `sandbox` with a test key, `production` with a live key |

In the provider's dashboard, Developers, Webhooks, Add endpoint:

- URL: `https://www.vallospaces.com/api/escrowpay/webhook`
- Events: tick every one. Vallo acts on the funding, release and refund
  events and records the rest untouched.

A test key in Production is safe: it records webhooks and never opens a
payment. Nothing is offered to a member until all of section 5 is done.

## 3. What is built

| Piece | File | State |
|---|---|---|
| Configuration, key and marker rules | `lib/payments/providers/escrowpay/config.ts` | Tested |
| HTTP client, auth and idempotency headers | `.../client.ts` | Tested with a stand-in fetch |
| Every request body | `.../requests.ts` | From the OpenAPI schemas, tested |
| Webhook signature and envelope | `.../webhooks.ts` | From the guide, tested with real HMACs |
| Event names onto Vallo's states | `.../normaliser.ts` | From the guide's closed set |
| Readers for the provider's answers | `.../read.ts` | Written, NOT yet checked against the sandbox |
| Parties and payout account | `lib/money/protected-provider.ts` | Written, tested with stand-in answers |
| Open, transfer details, read-back, release, refund, new details, webhook, reconcile | `lib/money/protected-rail.ts` | Tested with stand-in answers |
| Identity and start actions | `lib/money/protected-actions.ts` | Tested |
| Start screen (review, identity, open) on the funding page | `components/money/protected-rail/ProtectedStart.tsx`, `IdentityCheck.tsx` | Seen in a browser at phone width through `/preview/protected?screen=identity` |
| Lister readiness card on Settings, Payments | `ProtectedSetup.tsx` | Seen in a browser through `/preview/protected?screen=setup` |
| Webhook route | `app/api/escrowpay/webhook/route.ts` | On the real signature |

The live database needed nothing new: the arrangement table, its lifecycle
functions and the webhook event store were applied on 10 November.

## 4. What is NOT done, plainly

1. **No call has been made to the sandbox.** The test key could not be handed
   to the build session safely on the day. Until a sandbox run, `DOCUMENTED`
   in `client.ts` is false and nothing is sent on any deployment. The run
   must confirm: the field names in `read.ts`; the transaction status words
   (for the read-back that catches a missed webhook); the bank codes the
   provider uses against the ones on Vallo's bank accounts; how a test
   transfer is simulated; what a release and a refund report.
2. **Staff buttons.** `instructProtectedRefund` and `instructDisputeRelease`
   exist and are tested on the server; the arrangements desk has no button
   for them yet.
3. **The pay choice screen** (`ChooseHowToPay`) is not mounted on a member
   page; the funding page goes straight to the review.
4. **A named payer who is not the viewer** is told nothing: the tenant sees
   the review, and the open is refused until that payer has done the check.

## 5. Decisions that are the founder's

1. **Who bears the money-in fee.** The provider's fee setting offers the
   payer or the business (Vallo). Vallo's ruling of 9 November is that the
   lister pays. That needs either the fee charged to Vallo and taken back
   from the lister through the provider's marketplace commission, or a
   change of ruling. Nothing is configured either way.
2. **The identity check.** Every payer and every lister gives a NIN or BVN
   and a date of birth before a first protected payment. Vallo passes it on
   and keeps none of it, and the member consents on the screen. Counsel
   should see the screen's wording and the privacy policy line before go-live
   (SPECS Part 8: "never collect NIN or BVN without a verified security and
   compliance design").
3. **The identity fee** (₦80 per successful live check) is charged to the
   business by default.
4. **Two switches, both off today:** `payments_protected_pay_on` (whether the
   protected rail is offered at all) and `payments_escrowpay_on` (whether
   this provider may be asked). Both must be on, and a category approved in
   `protected_payment_categories`, before a member sees anything.

## 6. Order to go live

1. Sandbox run with the test key; correct `read.ts`, fill the status words,
   set `DOCUMENTED` true, record the run here.
2. Push; set the four names in Vercel with the TEST key; create the webhook
   endpoint; make one test transaction from the dashboard or the sandbox
   script and confirm a row with `signature_valid` in
   `provider_webhook_events`.
3. The founder's decisions in section 5; counsel's review.
4. KYB approved; swap to the live key and `production`; approve one category;
   turn on the two switches for a pilot.
