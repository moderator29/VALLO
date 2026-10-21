# How money moves on Vallo

Founder directive, 25 September 2026 (Track A). This page is the current truth. It supersedes every wallet, escrow and held-payment document written before it; those were deleted on 17 October 2026 and live only in git history.

> **Status, 13 October 2026 (docs track, read against the live database).**
> - **Vallo still never takes custody**, but since ADR 0003 (7 October) a
>   licensed partner may hold a payment in escrow; "no escrow" below means no
>   escrow held by Vallo. The founder's rules of 13 October: every payment for
>   a deal happens inside Vallo; for rent and shortlets the payer picks Escrow
>   (the default) or Pay by card; a sale is always escrow; a hotel room is paid
>   by card at once; the commission comes from the host's or lister's share.
>   Whether escrow is open is now read on the server, never a constant:
>   `protectedRailLive()` (`lib/money/rail-live.ts`) is true only when the
>   partner key for this deployment is set, `PAYMENTS_KILL_PAYLUK` is not on
>   and `payments_payluk_on` is on (the one switch the database also reads,
>   through `private.rentals_protected_pay_on`, since D77). While it reads false the payer is offered
>   card where the rules allow it, a sale says escrow is paused, and nothing is
>   taken. Release steps: `docs/payments/RELEASE_RUNBOOK.md`.
> - **The Guarantee is retired**: `money_policy.guarantee_bps` is 0 live, so
>   the reserve leg in the table below carries nothing on a new payment.
> - **Commission**: `fee_rates` commission is 0 basis points live. The hotel
>   commission of 10 percent (founder, 13 October) is a dated row in
>   `public.scoped_commission_rates` (scope `hotel_room`, 1,000 basis points,
>   applied `20261013171019_pov06_hotel_room_commission.sql`). Restaurants: 1,000 naira per seated table
>   (`restaurant_money_settings.seated_fee_minor` = 100000), and 200 basis
>   points on a bill paid through Vallo, which stays off behind the fail-closed
>   switch `restaurant_bill_pay` (`lib/reservations/bill-pay.ts`).
> - **Switches live**: `stays_instant_pay` and `room_bookings` are ON;
>   `restaurant_deposits`, `wallet`, `held_payments_payouts`,
>   `rentals_protected_pay`, `crypto_payments` and `agreement_staff_review`
>   are off; `payments_payluk_on` is on but no escrow adapter is registered.
> - **Applied**: `d68d_the_rail_decides_the_gate` (`20261007154216`) and
>   `d77_founder_rulings_on_the_gate` (`20261007154344`), with
>   `d77x_risk_settings_read_by_staff` (`20261007164415`).

## The rule

**Vallo never holds customer money.** Vallo has:

- no wallet;
- no balance;
- no escrow;
- no held payment;
- no withdrawal.

When somebody pays, Paystack splits the charge in the same transaction:

| Share | Where it goes | How big |
|---|---|---|
| The lister's share | The owner's or agent's own Paystack subaccount, which settles to their bank account | The rest of the charge |
| The Vallo Guarantee contribution | A separate Paystack subaccount for the reserve | `money_policy.guarantee_bps`: 0 since the Guarantee was retired (D51), so this leg carries nothing on a new payment |
| Vallo's commission | Vallo's main account | `fee_rates` commission: zero today |

> **13 October 2026.** The founder confirmed: Vallo charges only on a completed
> deal, no monthly subscription is required of anyone, and a Pro plan is
> optional. Vallo's commission is data (`fee_rates`), zero until set; the table
> above is the mechanism, not a rate. Public copy names no payment provider
> except where the law requires it. See [DECISIONS_2026-10-13.md](DECISIONS_2026-10-13.md).

The three parts always add up exactly to the charge. The `transactions` check refuses a row where they do not. The Guarantee contribution comes out of the lister's share and is never added to the price the renter or guest sees.

Every sentence a person reads about money comes from `apps/web/src/lib/money/copy.ts`: the Terms, the Privacy policy, the Disclaimer, the help centre, the assistant's prompts, the emails and the screens.

## The gate before payment

Payment opens only after an agreement is approved. The database enforces this with the `transactions_00_payment_gate` trigger and `rent_payments_00_needs_approved_agreement`.

1. **Rental.** The renter inspects and submits the inspection report: eight items, each with photographs. The minimum number of photos is `money_policy.min_inspection_photos`. `agreement_open_rent_as` then draws up the agreement from the listing's own figures and the report, including the move-in date and the handover date.
2. **Stay.** The host accepts the booking. A trigger on bookings going from PENDING to CONFIRMED draws up the agreement.
   **Instant booking (D73; `stays_instant_pay` is ON live, 13 October 2026):** a hotel room or nightly stay at the published price is accepted when the guest books, and its agreement is recorded approved by the system (`decided_by` empty, an event and an audit row saying "fixed price, instant booking"), so steps 3 and 4 do not apply and payment opens at once through the unchanged gate. See [ROOM_CHECKOUT.md](ROOM_CHECKOUT.md).
   A hotel room is a stay too (ROOM BOOKINGS 1; `room_bookings` is ON live, 13 October 2026): the agreement names the accommodation, the owner is the hotel's business owner, and a host who is not an agent is paid through their default bank account's Paystack subaccount. See [ROOM_CHECKOUT.md](ROOM_CHECKOUT.md).
3. **Both parties confirm the same version** with `agreement_confirm_as`. An agent confirming for an owner must hold a live mandate for the listing. Any amendment (`agreement_amend_as`) moves the version, and both confirmations lapse.
   **The rail decides the gate (D68d, applied live as `20261007154216_d68d_the_rail_decides_the_gate`).** When both have confirmed, `private.agreement_review_required` resolves from the rail plus risk signals. Escrow: approved by the system at once, and Vallo watches the hold with the power to pause a release. Direct: approved by the system unless a signal fires (no paid deal yet, amount over `agreement_risk_settings.amount_threshold_minor`, price or facts changed in the last few days, payout name mismatch, fraud radar), in which case it goes to `in_review` for step 4. The payment gate asks `private.agreement_payable` instead of demanding `approved` unconditionally, and the kill switch `agreement_review_all` (off) makes every deal need a person. The admin desk opens with a watch list over live deals, riskiest first.
   **The founder's rulings (D77, applied live as `20261007154344_d77_founder_rulings_on_the_gate`, after d68d).** First deal is a signal only when the business behind the deal is not verified (`businesses.verified` with a `cac_number`) or the amount is over the threshold. The threshold is 500,000 naira (`agreement_risk_settings.amount_threshold_minor = 50000000`), still configuration. A sale never routes to direct: `private.rail_for_booking`, `private.rail_for_agreement` and the app router (`saleNeverDirect`) answer no rail rather than direct for a sale, and a nightly sale listing never takes the stay rule. Staff change the threshold, the change window, each signal and the incident switch at `/admin/agreements/settings` (`admin_update_risk_settings`, `admin_set_review_kill_switch`: `agreements` scope, validated, audited). Opening and funding a protected payment now ask the same gate (trigger `provider_arrangements_00_payable_gate`), so the incident switch stops escrow too; what Payluk reports afterwards is always recorded.
4. **An admin, or staff holding the `agreements` scope, approves or rejects** with `admin_decide_agreement`. A rejection needs a reason. Nobody decides an agreement they are a party to. The decision is written to `deal_agreement_events` (append-only) and to `audit_log`. Both parties are told in the app and by email: `agreement.approved` and `agreement.rejected`.
5. **Payment opens.** `payment_split_for_booking` returns the split, and the app opens a split attempt (`lib/payments/split-attempt.ts`). Without `PAYSTACK_GUARANTEE_SUBACCOUNT`, or without a lister subaccount, nothing opens.
6. **Settlement.** `settle_booking_charge` records:
   - the transaction;
   - a `ledger_entries` row;
   - a `guarantee_reserve_entries` contribution;
   - the agreement as paid.

   Nothing is credited to any balance. A charge that cannot be applied is refunded to the card, with outcome `refund-due`.

**Pay on Vallo (founder rulings of 13 October 2026; drafts `pending/pov01` to `pov08`, not yet applied).** Every payment for a deal happens inside Vallo, and Vallo never holds it.
- **The payer picks the rail.** On a rent or a shortlet the payer chooses at the payment step between Escrow (preselected, recommended: a licensed partner holds the money until the deal is confirmed) and Pay by card (split by the processor straight to the lister's account). A sale is escrow only. A hotel room is card only. Restaurant bills stay card only and off. The choice is stored on `deal_agreements.payer_rail_choice` by `public.payment_rail_choose` (the payer only, only while nothing is paid or moving), the rent rows of `payment_rail_policy` carry `payer_may_choose`, and `private.rail_for_booking` and `private.rail_for_agreement` apply it, so the gate (`agreement_payable`), the card trigger (`transactions_01_rail_at_open`) and the escrow trigger read the same rail. A nightly shortlet no longer takes the hotel row. The app reads the same answer (`payment_rail_for_booking`, `lib/payments/rail-choice.ts`, the card `components/money/pay-choice/PayChoiceCard.tsx`).
- **Escrow for a shortlet stay.** `provider_arrangement_open` takes a stay at a listing; money the partner holds counts as paid for the trip details (`private.booking_is_paid`), and no sweep or plain cancel can drop a stay whose money the partner holds or is still moving (`bookings_00_partner_hold_keeps_the_stay`): the hold sweep marks itself (`vallo.hold_sweep`, set only by `private.release_stale_booking_holds` and `public.expire_booking_holds`), staff refunds unwind explicitly (`public.refund_and_cancel_booking`, `public.partner_hold_unwind_cancel` once the partner reports the money refunded), and an unfunded arrangement is cancelled with its stay after a two hour grace. A card charge that lands while the partner holds the deal is refunded, never applied (`settle_booking_charge` reason `partner_holds_payment`), and a deal funded both ways raises a high alert. The partner's state is recorded only from the partner (signed webhook, or the ten-minute `arrangements-reconcile` cron that verifies each open arrangement).
- **Hotel rooms: 10 percent.** `public.scoped_commission_rates` (`hotel_room`, 1,000 bps, dated, append-only) feeds `private.b3_commission_for_booking` for a room booking, so `payment_split_for_booking` takes Vallo's share from the hotel's; the guest's price is unchanged and the three parts still add up exactly. Every other commission is as it was.
- **Workspace acceptance.** Every owner, agent and firm registration, the professional application and the host setup record the Terms, the Privacy Policy and "Every payment for a deal I make on Vallo happens inside Vallo." in `consents.agreements` (`lib/legal/workspace-acceptance.ts`); the server actions refuse without them, and `pov08` refuses in the database (apply it after the app is live).

**Payment attempts.** One payer and one charge have one open attempt: a retry resumes the live attempt's Paystack checkout (`lib/payments/attempts.ts`) instead of opening another. An attempt Paystack says was never completed becomes `ABANDONED`, at once when the payer closes the window (the server asks Paystack first) or, through the hourly hold sweep, 45 minutes after it was last opened. A payment counts as in flight, and so blocks cancelling the agreement or releasing the hold, only while it is `PENDING` and either opened in the last 45 minutes or reported by Paystack as still moving (`private.payment_attempt_in_flight`). A charge that completes on an abandoned attempt is still settled, or refunded, by the one settlement path.

**Vallo charges no inspection fee.** The inspection screen, the request sheet, the Terms and the Disclaimer all say so.

## Refunds

A refund goes back to the card or account that paid, through Paystack `/refund` (`lib/payments/refund.ts`). The processor's status is recorded on `booking_refunds.processor_status`.

A refund whose outcome is unknown (a timeout, a 5xx or an unreadable answer) is never recorded as failed. It stays pending, and a critical `refund.outcome_unknown` alert asks a person to check Paystack before trying again.

**The refund clock (V-24, `20260929001248`).** Three stamps on each `booking_refunds` row, which can only move forward: decided (`created_at`), initiated at Paystack (`processor_submitted_at`, written by `record_processor_refund`), and processed (`processor_settled_at`, from Paystack's `refund.processed` webhook through `record_processor_refund_outcome`; see `lib/payments/refund-events.ts`). The promise to the guest is five Nigerian business days (holidays in `ng_public_holidays`) from asking to *initiation*. The guest reads "Paystack started the refund on …", and then "Refunded to your card on …". `admin_refund_clock()` lists every leg that is due within 24 hours or overdue:
- `request`: asked, not decided;
- `unsent`: decided, not sent to Paystack;
- `processor`: sent, not processed;
- `share_unsent` and `share_processor`: the same two legs for a flatmate's share refund;
- `rent_owed`: a rent refund the lister owes.

The function checks the caller's own role, so the app calls it with the operator's session.

## Before payment: the quote and the terms are frozen

- **The move-in quote (V-13, `20260929000327`).** When the lister says yes to an inspection, the move-in figures are copied into `move_in_quotes`. The rent charge is opened from that quote, so a listing edited later cannot change what the tenant was quoted.
- **Cancellation terms (V-20, `20260929000803`).** The policy that prices a refund is copied into `booking_cancellation_terms`, first when the booking is accepted and again when it is paid. A refund is priced from the frozen copy, never from the listing's current policy.

## Tenancy money that never passes through Vallo

**The caution register (V-36/V-47, `20260929002615`).** The caution is paid to the lister as part of the move-in total. Vallo keeps only a record of the debt: `caution_obligations` for what is owed and when it is due, plus deductions, returns and rulings.
- The lister proposes deductions against their own move-out photographs. The tenant accepts or disputes each one. A disputed line is ruled by staff with the `guarantee` scope (`admin_rule_caution_dispute`), who allow from zero up to the proposed amount.
- Either party records a return paid outside Vallo (`record_caution_return`, which is idempotent by key). The other party can contest it (`contest_caution_return`). While contested it counts as *in doubt*, until staff find it received or not received (`admin_rule_caution_return`).
- `private.caution_position` gives the figures: returned, in doubt, deducted, proposed, disputed, guaranteed, outstanding and claimable.
- After the due date, the tenant can escalate what is claimable to the Vallo Guarantee (`escalate_caution_to_guarantee`). That files a normal Guarantee claim with `guarantee_claims.caution_obligation_id`. An approved claim is paid from the reserve, never by Vallo on the lister's behalf.
- Operators rule on the Money desk's Cautions panel (`admin_caution_desk`).

**Flatmates pay their own shares (V-86, `20260929004131`).**
- The lead invites flatmates (`rent_payment_contributors`) to naira shares. The lead's own share is whatever is left.
- Each share is its own card charge against the one booking, opened with the split from `payment_split_for_rent_share` (`lib/tenancy/share-checkout.ts`). It carries `transactions.share_payer_id` and uses the ordinary `rm-book-` reference, so the webhook and the attempt sweep settle it with no extra code.
- `settle_booking_charge` answers `share-settled` until the shares reach the total, and `settled` for the payment that completes it. Uniqueness is one successful whole charge per booking, or one successful share per payer.
- The first paid share locks the split.
- Before the total is complete, the lead can cancel (`rent_split_cancel_as`), or the daily `sweep_rent_splits` job does it on the move-in day. Every paid share then gets a `rent_share_refunds` row and is refunded to the card that paid it. `lib/tenancy/share-refunds.ts` sends these, and the hourly `/api/cron/rent-share-refunds` retries them. `refund.processed` closes each one.
- Each share refund is claimed before it is sent (`claim_rent_share_refund`), so it is sent at most once. If Paystack gives no answer, the row is recorded as `unknown`, which is never re-sent automatically; a person checks Paystack first. A failed refund is retried at most three times (`attempts`). A Paystack refund event closes only its own row: it is matched by refund id, or by the charge reference only when the row has no refund id yet, and the amount must match (migration `20260929013455`).

**Other V-items, with no money movement.**
- Move-in and move-out reports (V-54).
- Receipts anyone can verify, which count as paid in full only when the shares or the whole charge cover the total (V-55).
- Price checks from paid tenancies (V-39).
- The renewal clock and the flat's lineage (V-93/V-38).
- Report withdrawal, saved views and report signals (V-89).

**V-81, the phone lock.** A step-up now guards only where money lands: adding, defaulting or removing a bank or payout account, and removing the lock itself (`lib/security/money-intent.ts`). With no wallet there is nothing to send or withdraw.

**V-56 and V-92 (held agency fee, held stay caution): not built, by decision.** Both would have Vallo hold a customer's money until something is released. The Vallo Guarantee covers the same risks instead.

## Restaurant table deposits (D75, OFF live since `20261013084935_restaurant_deposits_off`: booking a table is free)

The OpenTable no-show pattern, on the direct rail. Migration `supabase/migrations/pending/d75a_restaurant_deposits.sql`, probe `d75a-restaurant-deposits.sql`.

- **The rule is the restaurant's.** `restaurant_deposit_rules`: an amount per guest or per table, for one service window or all, from a party size up, with a refund window in hours. The owner writes them under RLS; guests read the active ones.
- **What is owed is the database's.** `private.reservation_deposit_quote` picks the matching rule and computes the split with the same parts a stay uses: the venue owner's own subaccount (`private.payee_subaccount`) and Vallo's commission (`private.current_fee_bps('commission')`, 200 basis points live). A venue that cannot be paid asks for nothing.
- **The charge.** A deposit has its own record (`reservation_deposits`, reference `rm-dep-<uuid>`), not a `transactions` row, because `transactions.booking_id` is a required booking and the gate and settlement are keyed on a booking and its agreement; a reservation has neither. It follows the promotion precedent and reuses the patterns: a BEFORE INSERT gate refusing any row the database did not compute, `reservation_deposit_settle` (idempotent on the reference, refund-due with a high alert when it cannot be applied), the one card refund claim (`lib/payments/refund.ts`), and the Vallo revenue ledger for the commission. The Paystack webhook routes `rm-dep-` to it (`lib/reservations/deposit-settlement.ts`).
- **The outcome follows the reservation:** dined (COMPLETED) applies it to the bill; a guest who cancels inside the window gets it all back, later it is the venue's; a no-show is the venue's; a venue cancellation is refunded. A venue cannot confirm a table whose deposit is due and unpaid. Refunds the rule decides go out hourly (`/api/cron/reservation-deposit-refunds`), and that job also closes checkouts nobody paid within two hours.
- **No live function changes**: two new triggers on `reservations`.
- **Founder ruling, 13 October 2026: deposits ON** (track/restaurant-deposits). A table stays free unless the restaurant sets a deposit. `20261013084935_restaurant_deposits_off` changed only the switch row; nothing else blocks deposits, so flipping `feature_flags.restaurant_deposits` is the only switch. The desk card (`/host/reservations`) edits the venue's rules as the owner under RLS; the reservation form shows the matched rule before the request and the database's quote after it; payment is card only on the direct split (no escrow); `/pay/deposit/[reservationId]` is the return page, the notice target and the receipt. The hourly refund job now runs whatever the switch says, so a refund owed is never stranded. Pending draft `rd01_restaurant_deposit_notices` adds the refunded and kept notices.

## The Vallo Guarantee

- **The reserve.** Contributions flow in from every settled charge. The reserve is an append-only ledger (`guarantee_reserve_entries`), and its balance is their sum.
- **Scope.** At launch it covers rentals and stays paid through Vallo, not purchases.
- **Claims.** A claim is filed from the agreement (`guarantee_claim_file_as`) with evidence, in the private `guarantee-evidence` bucket. It must be filed within `money_policy.claim_window_hours` (72) of move-in or check-in.
- **Decisions.** An admin, or staff holding the `guarantee` scope, decides each claim (`admin_decide_guarantee_claim`). The approved amount is capped by what was paid and by the reserve balance, under an advisory lock.
- **Payout.** An approved claim is paid to the claimant's bank account and recorded with `admin_mark_guarantee_claim_paid`.

## Crypto

Crypto is **another way to pay an existing charge** (a stay, a rent charge, an agreement payment), never a place to keep money. It is **off**: hidden everywhere unless all of these hold, checked on every page render and again in every server action (`lib/crypto/gate.ts`):

1. `feature_flags.crypto_payments` is on (fail-closed; created off by `20260929001617`);
2. the provider is configured (key, secret, https base, webhook secret);
3. `YELLOWCARD_DIRECT_SETTLEMENT=confirmed`, `YELLOWCARD_PROVIDER_ACCOUNTS_ARE_BANK_PAYOUTS=confirmed`, Vallo's settlement account id and the reserve's bank account are all set;
4. at least one asset is enabled (`CRYPTO_ENABLED_ASSETS`);
5. the payer has a matched identity check (`identity_verifications.outcome = 'matched'`). Without it the payment screen says so and links to verification; it never shows a button the server would refuse.

**How the money moves.** Paying in crypto is one more attempt on the same charge: a `transactions` row with provider `yellowcard` and reference `rm-yc-<uuid>`, opened by `crypto_open_attempt` through the same `transactions_00_payment_gate` and the same split from `payment_split_for_booking`. The provider (Yellow Card, behind the interface in `lib/crypto/provider.ts`, so another licensed provider can be swapped in) issues **its own** deposit address for this one payment, converts under its own licence, and settles **naira** directly to the three legs the card split pays:

| Leg | Destination |
|---|---|
| The lister's share | The lister's verified payout account (the `payout_accounts` row behind their Paystack subaccount) |
| The Guarantee contribution | A bank payout to the reserve's own bank account (`YELLOWCARD_RESERVE_BANK_CODE`, `_ACCOUNT_NUMBER`, `_ACCOUNT_NAME`), never a balance at the provider |
| Vallo's commission | Vallo's settlement account at the provider (`YELLOWCARD_VALLO_SETTLEMENT_ACCOUNT_ID`), which the founder has confirmed pays out to Vallo's own bank (`YELLOWCARD_PROVIDER_ACCOUNTS_ARE_BANK_PAYOUTS=confirmed`) |

The destinations each payment was sent to are recorded on its `awaiting_payment` event (`crypto_payment_events.facts.settlement_destinations`: the reserve's bank account in full, the lister's by bank code and last four digits, Vallo's by provider account id).

Vallo never receives, holds or forwards crypto, a key, an address of its own, or anybody's naira. An overpayment's difference, and an underpayment not topped up before the quote expires, go back to the payer's refund address, by the provider.

**One payment of a charge at a time.** `crypto_open_attempt` refuses with `in_flight` while another crypto payment of the same charge is moving (awaiting payment, confirming, underpaid, overpaid, converting) or a card attempt on it is in flight (`private.booking_payment_in_flight`), so two payments cannot both land (`20260929012438`). A duplicate or repeated report about an unfinished payment refreshes its attempt's in-flight clock, so an agreement is not cancelled under a payment the provider is still reporting on.

**Only an explicit settled amount settles.** The provider's report must state the naira it settled (`settledAmount`), and it must equal the charge in kobo; the quoted amount is never read as a settlement, and a settled report without the figure is refused as `amount-mismatch` with a critical alert.

**Figures.** Naira is integer kobo. Crypto amounts are exact decimals at the asset's precision (`numeric` in the database, decimal strings in the app, bigint atomic units for maths in `lib/crypto/decimal.ts`). A provider quote is refused if its crypto amount disagrees with its own rate by more than 1% (a unit slip).

**States** (`lib/crypto/state-machine.ts`, twinned with `private.crypto_transition_allowed`): quoted, awaiting payment, confirming (with a confirmations count), underpaid, overpaid, converting, settled, expired, refunded, failed. A report of money moving outranks a clock: late funds on an expired quote still move forward.

**Only the provider's signed report settles a charge.** `/api/yellowcard/webhook` verifies the HMAC over the raw body and hands the report to `public.crypto_payment_apply` (service role only), which in one transaction: records the event once per `(provider, provider_event_id)` (idempotency); refuses an out-of-order transition; refuses a settlement that is not exactly the charge in kobo (and raises an alert); and on settlement calls `private.settle_booking_charge` and writes the AML record. A settled charge that cannot be applied (paid twice, cancelled) raises a critical `crypto.return_needed` alert: the naira is with the lister, so a person arranges its return with the provider. The browser only polls its own row; nothing it sends can mark a charge paid. `/api/cron/crypto-reconcile` (every 15 minutes) reads every moving payment back from the provider and applies it through the same door, and expires quotes nobody accepted. The payer is told in the app and by email at each state, and the settled email is the receipt; `/pay/crypto/[reference]` shows the live status and the receipt.

**For SCUML/AML: `public.crypto_aml_records`.** One append-only, staff-only row per settled crypto payment, written in the settling transaction: the payer (`payer_id`, `payer_legal_name`, `payer_kyc_verification_id`, `payer_kyc_method` from KYC), the payee, `amount_minor` (naira), `asset`, `network`, `crypto_amount`, `crypto_received`, `rate_ngn`, `tx_hash`, the provider's deposit address, the refund address, `provider` and `provider_reference`, and `settled_at`. No foreign keys, so an account deletion never erases it. The threshold and STR observers should read this table (and `crypto_payment_events` for the full history). The crypto attempt is also an ordinary `transactions` row, so any observer on settled transactions sees it with `provider = 'yellowcard'`.

**Founder action items before the flag goes on.**

1. **SEC VASP question.** Under the Investments and Securities Act 2025 and the SEC's rules on digital assets, virtual asset service providers must be registered with the SEC Nigeria. Take legal advice, in writing, on whether Vallo offering this option (with a registered provider doing the conversion and settlement) needs its own SEC registration or falls under the provider's; do not switch crypto on until that is answered.
2. Get Yellow Card's written confirmation that it settles naira directly to each leg, then set `YELLOWCARD_DIRECT_SETTLEMENT=confirmed`.
3. Open Vallo's settlement account at Yellow Card, get written confirmation that it pays out to Vallo's bank account (then set `YELLOWCARD_PROVIDER_ACCOUNTS_ARE_BANK_PAYOUTS=confirmed`), and set the Guarantee reserve's bank account details.
4. Receive the API key, secret and webhook secret; register the webhook URL; check every `CONFIRM ON ONBOARDING` line (including whether the webhook signature carries a timestamp, so replays older than a few minutes can be refused) in `lib/crypto/providers/yellowcard.ts` against the live docs; scan a deposit QR with a phone.
5. Set `CRYPTO_ENABLED_ASSETS`, then `update public.feature_flags set enabled = true where key = 'crypto_payments';`.

## What is retired, and how it is kept retired

| Retired thing | How it is kept retired |
|---|---|
| Custody tables: wallets, wallet_entries, wallet_pots, escrows, escrow_evidence, escrow_rulings, escrow_float_snapshots | Unreachable from every app role on live (`20260925130904`). They were then moved into the `retired_custody` schema with no grants, applied on live as `20260925163708_track_a1_vallo_never_holds_customer_money_custody_retired.sql` (verified against the live catalogue 6 October). |
| Every custody function | Execute revoked from anon, authenticated and service_role. |
| The rent-to-wallet trigger | Disabled (`20260925130806`). |
| The `wallet`, `held_payments` and `held_payments_payouts` flags | Off (`20260925114741`). The pending migration also makes the flag guard refuse to turn them on, and adds an event trigger that refuses any new custody-named object. |
| The app code | Removed. The tables are not in `database.types.ts`, so no code can name them. The old routes `/wallet`, `/escrow` and `/admin/escrow` redirect to `/agreements` or `/admin/agreements`. |

## Where to look

| Question | Where |
|---|---|
| Can this booking be paid? | `deal_agreements.status = 'approved'` |
| How one charge split | `transactions` and `ledger_entries` |
| The reserve balance | `admin_guarantee_reserve()`, or the Money desk |
| A refund's state | `booking_refunds.processor_status` |
| A refund's clock | `admin_refund_clock()`, or the refund clock on the Money desk |
| How a hotel room is booked and paid | [ROOM_CHECKOUT.md](ROOM_CHECKOUT.md) |
| A caution's position | `private.caution_position(obligation)`; staff rule on it on the Money desk (Cautions) |
| A flatmate's share and its refund | `transactions.share_payer_id`, `rent_share_refunds`, `my_rent_share(contributor)` |
| A crypto payment's state and history | `crypto_payments`, `crypto_payment_events` |
| What SCUML needs about a crypto payment | `crypto_aml_records` |
