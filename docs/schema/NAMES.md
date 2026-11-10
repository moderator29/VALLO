# Schema names that mislead, and what they actually hold

Some schema names say something other than what the column or table holds. Renaming a live table or column breaks the deployed app and every migration that mentions it, so the names stay and this page states the truth. `lib/db/schema-names-doc.test.ts` checks every claim here against `supabase/migrations` and the generated `database.types.ts`, so this page cannot drift silently.

## Names that say the wrong thing

| Name | What it sounds like | What it is |
|---|---|---|
| `conversations.agent_id` | an `agents.id`, like every other `agent_id` in the schema | **an auth user id** (`auth.users.id`) of the host side of the thread: the lister's user, the host's user, or a business owner. The foreign key is `conversations_agent_id_fkey → auth.users(id)`. Look the agent row up by `agents.user_id`, never by `agents.id`. |
| `agents` (table) | licensed agents only | everyone who lists supply: `agents.role` is `agent` **or `owner`** (a landlord listing their own place). Whether the person is acting as agent or owner on one listing is `listings.listing_role`. |
| `listing_status` (enum) | the status of a listing | the lifecycle status of **five** tables: `listings`, `businesses`, `catalogue_entries`, `accommodations`, `room_types`. A value such as `PUBLISHED` means "live to guests" in each. It does not mean the row is a listing. |
| `booking_status` (enum) | the status of a stay booking | also the status of restaurant **`reservations`**, and the `from_status` / `to_status` of `booking_state_events`. |
| migration file names | an object name you can grep for | a sentence describing the change (for example `…_a_column_called_price_per_night_that_held_annual_rent.sql`). Grep the SQL inside the file for an object, not the file name. |

## The money tables: which one is authoritative for what

**Track A, 25 September 2026: Vallo never holds customer money.** There is no wallet, no balance, no escrow and no held payment. Every charge is split by Paystack at the moment of payment: the lister's share to their own subaccount, the Guarantee contribution to the reserve's subaccount, and Vallo's commission (zero today) to the main account. The tables below record those movements; none of them is a balance somebody holds with Vallo, except the Guarantee reserve, which is Vallo's own ring-fenced reserve.

The custody tables (`wallets`, `wallet_entries`, `wallet_pots`, `escrows`, `escrow_evidence`, `escrow_rulings`, `escrow_float_snapshots`) are retired. On live they are unreachable: every app role's grants on them and on their functions are revoked (`20260925130904_track_a_custody_unreachable_from_every_app_role.sql`), and the rent-to-wallet trigger is disabled (`20260925130806_…`). They were then moved into the `retired_custody` schema with no grants (`20260925163708_track_a1_vallo_never_holds_customer_money_custody_retired.sql`, applied, verified against live 6 October). They are not in `database.types.ts`, so no app code can name them.

| Table | Authoritative for | Written by |
|---|---|---|
| `transactions` | **each payment attempt against a booking**, with its split: `lister_share_minor + guarantee_minor + commission_minor = amount_minor`, and the subaccounts it paid to. The gate trigger refuses a row with no split or no approved agreement. | the app inserts an attempt as PENDING with its split (`lib/payments/split-attempt.ts`) and marks it FAILED (`lib/bookings/settlement.ts`); `settle_booking_charge` records success |
| `ledger_entries` | **the split of each settled charge**: platform, agent, processor and Guarantee shares. | `settle_booking_charge`, `refund_booking_payment`, `refund_and_cancel_booking` |
| `booking_refunds` | refunds against a booking, and where the processor refund stands (`processor_status`). | `refund_booking_payment`, `refund_and_cancel_booking`, `record_processor_refund` |
| `rent_payments` | a move-in charge and its parts (rent, caution, fees). | `open_rent_charge` |
| `rent_refunds_owed` | what a lister owes back on a refunded rent charge, since their share settled to them at payment. | `refund_booking_payment`, `refund_and_cancel_booking`, `rent_refund_shortfall` |
| `deal_agreements` | **what both parties committed to, and whether payment may open**: the terms version, both confirmations, Vallo's decision and reason, and `paid` once settled. | `agreement_open_rent_as`, `agreement_amend_as`, `agreement_confirm_as`, `agreement_cancel_as`, `admin_decide_agreement`, `settle_booking_charge`, `expire_booking_holds` |
| `guarantee_reserve_entries` | **the Vallo Guarantee reserve**, append-only: contributions in from each settled charge, approved claims out. Its sum is the reserve balance. | `settle_booking_charge`, `admin_decide_guarantee_claim` |
| `guarantee_claims` | each claim on the Guarantee, capped by what was paid and by the reserve. | `guarantee_claim_file_as`, `admin_decide_guarantee_claim`, `admin_mark_guarantee_claim_paid` |
| `rent_payment_contributors` | each person sharing a rent charge and the share they owe. | `add_rent_contributor`, `remove_rent_contributor` |
| `rent_share_refunds` | a refund owed to a contributor whose share was paid but not used, and where it stands. | `record_rent_share_refund`, `claim_rent_share_refund`, `record_processor_refund_outcome`, `rent_split_cancel` |
| `caution_obligations` | the caution a lister holds for a tenancy and when it is due back. | `open_tenancy_records` |
| `caution_deductions` | each deduction a lister proposes from the caution, and the renter's answer. | `propose_caution_deduction` |
| `caution_returns` | what the lister says they paid back of the caution. | `record_caution_return` |
| `caution_dispute_rulings` | Vallo's ruling on a contested caution deduction or return. | `admin_rule_caution_dispute` |
| `crypto_payments` | each crypto payment attempt against a booking and its status. | `crypto_open_attempt`, `crypto_payment_apply` |
| `crypto_aml_records` | the anti-money-laundering record kept for each settled crypto payment. | `crypto_payment_apply` |
| `aml_ledger_observations` | each money movement as the AML monitor saw it, append-only. | `aml_observe` |
| `threshold_events` | each movement, or linked set, that crossed a SCUML reporting threshold. | `aml_observe` |
| `edd_reviews` | enhanced due diligence opened on a person, with the amount that set it off. | `edd_gate`, `risk_open_edd`, `flag_pep` |
| `agreement_risk_settings` | **one row of staff-set thresholds for when an agreement is held for review**: `amount_threshold_minor` (a rent charge at or above it is held), the `check_*` switches (amount, first deal, fraud radar, payout name, recent change) and `recent_change_days`. It is a setting, not a movement of money. | `admin_update_risk_settings` |
| `booking_refund_parts` | one refund taken back across every card that paid for a booking: the amount for each charge, the processor reference and where the processor refund stands. | `plan_booking_refund`, `record_refund_part`, `record_processor_refund_outcome` |
| `chargebacks` | each chargeback a card issuer raises against a payment: its state, the amount, and how much has been recovered. | `chargeback_open`, `chargeback_move` |
| `chargeback_events` | the append-only history of one chargeback, including the amount recovered at each step. | `chargeback_open` |
| `funds_movements` | each deposit, withdrawal or transfer a member asked for or the provider reported, with the fees and VAT. Vallo's record of what the provider said, never a balance Vallo holds. Only the provider can complete a row. | `funds_movement_observe` |
| `member_funds_reported` | the last balance the **provider** reported for a member, and when Vallo observed it. A cache, never computed by Vallo and never a balance Vallo owes. | the member money rail (balance read-back) |
| `ledger_customer_funds` | pot 1 of 3: customer money at the provider, never Vallo's. Append-only; a correction is a new entry. | the money rail (append-only) |
| `ledger_vallo_revenue` | pot 2 of 3: Vallo's own revenue (commission, withdrawal fees, promotion). Never VAT, never customer money. Append-only. | the money rail (append-only) |
| `ledger_marketing_float` | pot 3 of 3: Vallo's marketing float that funds referral payouts. Append-only. | the money rail (append-only) |
| `retired_provider_commission_sweeps` | each run that reads the the retired provider balances and, when there is commission to move, withdraws it to the main account, with the outcome and the amounts. | the commission sweep job |
| `provider_arrangements` | an arrangement between a member and a service provider, with the amount and the provider's fee, paid through the provider rail. | `provider_arrangement_open`, `provider_arrangement_observe`, `admin_pause_release`, `admin_resume_release` |
| `provider_arrangement_milestones` | the staged amounts inside one provider arrangement and where each stands. | `provider_arrangement_open`, `provider_arrangement_observe` |
| `reservation_deposits` | the deposit charged to hold a restaurant reservation: the amount, Vallo's commission and the restaurant's share. | `reservation_deposit_open`, `reservation_deposit_settle`, `reservation_deposit_close`, `reservation_deposit_refunded` |
| `rewards_ledger` | the Rewards Balance, append-only: balance = sum of `amount_minor`. A reversal is a new negative entry. Not a wallet: Vallo owes this money, it does not hold the member's money. | `referral_reverse`, `referral_release_due`, `rewards_payout_open` |
| `rewards_payouts` | each Rewards Balance payout, paid by a Paystack transfer from Vallo's marketing float. Paid only on provider confirmation; a timeout is unknown, never failed. | `rewards_payout_open`, `rewards_payout_settle`, `rewards_payout_claim_send`, `admin_rewards_payout_decide` |
| `rewards_transfer_events` | what the provider told Vallo about a payout transfer, by webhook. Append-only; the same webhook twice is one row. | `rewards_payout_webhook` |
| `referrals` | one row per referred member and the reward they earned, through its lifecycle from attributed to paid or reversed. | `referral_attribute`, `referral_try_qualify`, `referral_move`, `rewards_payout_open` |
| `referral_budget_releases` | budget handed back by a reward that was reversed or rejected before payment; the only thing that may lower a committed total. Append-only. | `referral_release_budget` |
| `member_subscriptions` | a member's trial or paid subscription to a plan, and the amount charged. | the `subscription_*` functions |
| `subscription_events` | every subscription event received from Paystack and every move Vallo made. Unique per provider, mode and event key, so a redelivery is a no-op. | `subscription_log` |
| `platform_revenue` | commission booked by the retired escrow flow. Historical only; nothing writes it now. | nothing since Track A |

How a rent payment settles now:
1. The renter submits the inspection report; `agreement_open_rent_as` draws up the agreement from the listing and the report.
2. Both parties confirm (`agreement_confirm_as`, an agent under a mandate), and an admin approves it (`admin_decide_agreement`). `rent_payments` cannot be opened before approval.
3. `open_rent_charge` opens a one-night booking for the move-in total; the app opens a split attempt in `transactions`.
4. Paystack splits the charge; `settle_booking_charge` records `transactions` success, a `ledger_entries` row, a `guarantee_reserve_entries` contribution and marks the agreement paid. Nothing is credited to a Vallo balance. The old trigger `ledger_entries_settle_rent_to_lister`, which did that, is disabled.

Which table to read:
- What one charge came to and how it split: `transactions` and `ledger_entries`.
- Whether a payment may open: `deal_agreements.status = 'approved'`.
- What is in the Guarantee reserve: the sum of `guarantee_reserve_entries` (`admin_guarantee_reserve`).
- What Vallo earned: `commission_minor` on `transactions`, zero today.
- What Vallo is holding for others: nothing, by design.

(Checked against the migrations on 25 September 2026 by `lib/db/schema-names-doc.test.ts`.)
