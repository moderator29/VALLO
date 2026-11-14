# The protected payment adapter (EscrowPay)

Server-only. Reached only by the rail's server modules
(`lib/money/protected-rail.ts`, `protected-provider.ts`, `protected-read.ts`,
`protected-actions.ts`) and the webhook route; the test in this folder fails
on any other importer.

## Where each fact comes from

Everything here is the provider's own, from two public sources read on
14 November 2026:

- the Merchant API's OpenAPI document ("EscrowPay Merchant API" 0.1.0, 66
  operations), which the API Explorer at docs.escrowpay.app loads;
- the Explorer's guides: "Getting started", "Webhooks: inbound deliveries",
  "Checkout button".

| File | What it holds | Source |
|---|---|---|
| `config.ts` | Env names, one host for both books, the key prefix per book | Getting started |
| `client.ts` | `X-API-Key`, `Idempotency-Key`, the `/api/v1` paths, the envelope | OpenAPI |
| `requests.ts` | Every request body Vallo sends | OpenAPI schemas, named on each builder |
| `webhooks.ts` | `EscrowPay-Signature` (`t=`, `v1=`), HMAC-SHA256 of `<t>.` and the raw body, 300 seconds, the envelope, the event names | Webhooks guide |
| `normaliser.ts` | Event name onto Vallo's state; status word onto Vallo's state | Webhooks guide; the sandbox |
| `read.ts` | The fields Vallo reads from each answer | NOT in the OpenAPI (every 2xx is untyped): the sandbox |
| `errors.ts` | HTTP status and the provider's `detail.code` onto Vallo's failure kinds | Seen on the API itself |

## What still waits on the sandbox

The OpenAPI types no response body, so two things cannot be taken from
documentation and must be seen on the sandbox with a test key:

1. the field names `read.ts` takes from a transaction, a party, a payout
   account, a payment account and the bank list;
2. the transaction status words for `ESCROWPAY_STATUS_WORDS` (empty today, so
   a read-back moves nothing; webhooks already move on the documented events).

`DOCUMENTED` in `client.ts` stays false until both are checked, and while it
is false `escrowPayRequest` answers `not_configured` before any network call.
Flip it in the same change that fills the status words and corrects
`read.ts`, with the sandbox run recorded in
`docs/handoff/ESCROWPAY_INTEGRATION.md`.

## What stops money, in order

1. `DOCUMENTED` false: nothing is sent.
2. No configuration, a key whose prefix does not match
   `ESCROWPAY_ENVIRONMENT`, or a production marker outside production: not
   configured.
3. A test key on the production deployment: webhooks are recorded and
   read-backs run; no payment is opened, released or refunded.
4. `payments_escrowpay_on` off (the founder's flag, fail closed), or
   `PAYMENTS_KILL_ESCROWPAY=1`: no payment is opened or released. Recording
   and refunds are never stopped by the switch.
5. The category switchboard (`protected_payment_categories`): a category that
   is not approved never reaches the provider.

Run the tests with `npx vitest run src/lib/payments/providers/escrowpay src/lib/money/protected-rail.test.ts src/lib/money/protected-actions.test.ts`.
