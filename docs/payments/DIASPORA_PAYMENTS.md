# Nigerians abroad: what works today, what Payluk does not cover, and the plan

Written 2 November 2026, from Payluk's own documentation saved in `docs/payments/payluk-source/` and the live findings in `PAYLUK_LIVE_DOCS_FINDINGS.md`. No live Payluk call was made for this note.

## What Payluk's documentation says
- **Customers** (`api-reference_merchant-customers_create-merchant-customer.txt`): `phone` is digits only; `countryId` is optional and defaults to the merchant account's country (Nigeria); "the country decides which phone format is accepted". On the live API a two-letter code is refused ("Cast to ObjectId failed"), so a country must be sent as Payluk's internal id from Get countries. Which countries exist there is not documented.
- **Card payments are for Nigerian customers only** (`api-reference_payments_pay-escrow-buy.txt`, `api-reference_payments_create-payment-intent.txt`: "card payments are only available to Nigerian customers").
- **Funding without a saved card** goes through Payluk's hosted Checkout (card, bank transfer, cNGN). Whether a foreign card works there is not documented.
- **Withdrawals** go to Nigerian bank accounts (the bank list is Nigerian).
- **Foreign customers, KYC tiers and limits** are OPEN in `PAYLUK_LIVE_DOCS_FINDINGS.md` section 10.

## What this means for a member with a UK number
- **Works now:** signing up, confirming the UK number by code (Twilio), browsing, saving, messaging, booking requests, and every contact field (all accept any country since 2 November 2026).
- **Uncertain:** opening a Payluk wallet on a UK number. The code only does it when `PAYLUK_COUNTRY_IDS` names that country's Payluk id; otherwise the wallet says it needs a Nigerian number, and nothing is sent to Payluk.
- **Not available through Payluk:** paying with a saved foreign card.

## The plan
1. **Ask Payluk in writing (partners@payluk.ng):**
   - Which countries does Get countries return, and their ids?
   - Can a customer be created with a UK, US or EU phone number?
   - Can a foreign Visa or Mastercard fund an escrow through the hosted Checkout, and in what currency?
   - What KYC and limits apply to a customer outside Nigeria?
   When they answer, set `PAYLUK_COUNTRY_IDS` (for example `GB:<id>,US:<id>`) and the wallet opens on those numbers with no code change.
2. **Now, with no Payluk change:** a member abroad can put a Nigerian number on their profile for payments (many keep a Nigerian SIM) while their confirmed contact number stays foreign.
3. **Card payments from abroad on the direct rail:** Paystack accepts international Visa and Mastercard for Nigerian merchants once "international payments" is switched on in the Paystack dashboard (charged in naira, converted by the card issuer). That covers bookings and deposits paid by card from the UK. Confirm the setting with Paystack.
4. **Later, if the diaspora becomes a large share:** a second collection partner that settles foreign-currency cards into naira (for example Flutterwave), behind the same provider interface. That is a business and legal decision, not a code change, and it needs counsel's view.
