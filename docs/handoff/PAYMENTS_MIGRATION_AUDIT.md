# PAYMENTS MIGRATION AUDIT: PAYLUK TO THE NEW PROTECTED-PAYMENT PROVIDER

Phase 1 of `PROTECTED_PAYMENTS_BUILD.md` section 5. Written 9 November 2026 on
`platform-grade-1-readiness`. Audit only: no code, no SQL, no flag was changed
to produce it. Every statement below was read from the source, the migration
SQL or the docs in this repository. Nothing was read from a live database.

The new provider is named in the SPECS appendix as **EscrowPay** (from its
document "How EscrowPay appears on your platform"). The custodian named in the
approved funds wording is **Rubies Microfinance Bank**. Where this file says
"the new provider" it means EscrowPay.

---

## 0. HOW TO READ THIS

Five classes, from BUILD section 5 and SPECS Part 3:

| Class | Meaning |
|---|---|
| REPLACE | Active code or data whose job must be done by new-provider code. The old file may stay in place until Phase 6, but nothing new is built on it. |
| PRESERVE-SHARED | Provider-neutral payment machinery. Keep it, extend it additively, route the new provider through it. |
| HISTORICAL-LEAVE | A record (applied migration, retired table, vendored doc, decision log). Never edit, never drop. |
| DEAD-REMOVE | Nothing reachable calls it. Remove only in Phase 6, after a fresh check that nothing depends on it. Database objects in this class are listed for the founder's end-of-migration SQL block, never dropped automatically. |
| COMPAT-KEEP | Payluk-specific code that must keep working (or keep failing closed) during the migration, and is retired in Phase 6. |

Line numbers are as of this audit. "Applied" migrations are in
`supabase/migrations/`; rollback snapshots are in
`supabase/migrations/pending/rollback/`.

### Counts

| Class | Rows |
|---|---|
| REPLACE | 45 |
| PRESERVE-SHARED | 90 |
| HISTORICAL-LEAVE | 16 |
| DEAD-REMOVE | 9 |
| COMPAT-KEEP | 31 |
| **Total** | **191** |

A row is one table line in sections 2 to 9; some rows group several files of
the same kind (for example the wallet screens), so the file count is higher.

Scale of the raw search, for context (apps, packages, supabase, docs, .github,
case-insensitive): `payluk` 1,321 lines in 171 files; `escrow` 4,185 lines in
440 files; `arrangement` 834 lines in 114 files; `provider_arrangement` 315
lines in 46 files. The `escrow` hits are mostly the provider-neutral rail name
(`'escrow' | 'direct'`) and the retired September custody design; they are
classified by area below, not line by line.

---

## 1. VERIFYING BUILD SECTION 4 ("WHAT ALREADY EXISTS")

| Row in section 4 | Verdict | What the source says |
|---|---|---|
| Provider abstraction, typed capabilities (`lib/payments/provider.ts`) | **Accurate, with two caveats** | `defineFiatProvider`, `can`, `requireCapability` exist. Capabilities are `split_at_charge`, `hold_in_escrow`, `member_wallet`, plus `refund_without_dispute`, `list_successful_charges`, `charge_saved_card`, `verify_with_record`. Caveat 1: `hold_in_escrow` is `Record<never, never>` (line 110): it unlocks NO methods. The escrow operations live outside the seam, in `lib/payments/providers/payluk-arrangements.ts`. Caveat 2: `FiatProviderId` is the closed union `"paystack" \| "payluk"` (line 34). |
| Rail router (`lib/payments/router.ts`, `private.rail_for_booking`, `private.rail_for_agreement`) | **Accurate** | Latest SQL definitions in `20261013170515_pov03_rail_resolution_honours_the_choice.sql` (lines 187, 211). `public.payment_rail_for_booking` added in pov04. `railGate(answer, opensOn, escrowLive)` takes `escrowLive` from `escrowRailLive()`, which is hardwired to `fiatProvider("payluk")`. |
| Payer's rail choice (`deal_agreements.payer_rail_choice`, `public.payment_rail_choose`) | **Accurate** | Columns in `20261013170244_pov01_payer_rail_choice_columns.sql`; RPC in `20261013170707_pov04_payer_rail_choice_rpcs.sql` line 114. Note: with no choice stored, a choosable deal resolves to `escrow` (pov03 line 203). |
| Arrangement state machine (`lib/money/arrangement-states.ts`) | **Accurate** | Twelve states, step table twinned with `private.provider_arrangement_step_ok`. `valloStateFor` maps Payluk's `state`/`status` pairs. Missing against SPECS Part 6: `refund_pending` and `requires_review` have no equivalent. |
| Arrangements table (`provider_arrangements`) | **Accurate, but Payluk-locked** | `20261007151000_d73b_provider_arrangements.sql`. `provider check (provider in ('payluk'))`; `buyer_customer_id` and `seller_customer_id` are NOT NULL Payluk customer ids; `amount_minor >= 100000`; `who_pays_fee = 'seller'` only. No columns for funding instructions, expiry, category or the timestamps SPECS Part 7 asks for. |
| Webhook route (`app/api/payluk/webhook/route.ts`) | **Accurate** | HMAC-SHA512 over the raw body, header `x-payluk-signature`, raw persistence in `provider_webhook_events`, idempotent on `(provider, event_key)`, `escrow.*` events go through `applyArrangementWebhook`. |
| Reconciliation cron (`/api/cron/arrangements-reconcile`, every 10 minutes) | **Accurate** | `apps/web/vercel.json` schedule `8,18,28,38,48,58 * * * *`. Job `lib/cron/jobs/arrangements-reconcile.ts` reads at most 3 per run (Payluk's 10 requests a minute) and is hardwired to `paylukContext()`; with no Payluk key it no-ops and says `no_partner_key`. |
| Member screens (`agreements/[id]/fund`, `.../held`) | **Accurate** | Payluk-shaped: the fund screen is a money swipe that pays from the member's Payluk-held "Wallet" balance (`FUND_FROM_BALANCE = "From Wallet"`). There are no transfer instructions, no waiting state, no expiry. |
| Payment gate (`transactions_00_payment_gate`, `provider_arrangements_00_payable_gate`) | **Accurate, one extra** | Trigger `transactions_00_payment_gate` from track_a2 (function last redefined in d68d and later). `provider_arrangements_00_payable_gate` from d77 line 440. A second, older trigger `provider_arrangements_00_payable` (d68d line 432, insert only) was never dropped, so both run on insert. Redundant, harmless. |
| Ledger (`ledger_entries`) | **Partly accurate** | `ledger_entries` exists (20260728, settlement rows for card charges). The event ledger is the three-pot b2 design (`ledger_customer_funds`, `ledger_vallo_revenue`, `ledger_marketing_float`). The protected rail posts nothing to any ledger today: the only writer, `recordEscrowCommission` in `lib/ledger/record.ts`, has no caller. The arrangement audit trail is `provider_arrangement_events` (append only). |
| Refund clock (`booking_refunds`, 5 business days) | **Accurate for the card rail only** | `20260929001248_money_v24_refund_clock_to_paystack_initiation_and_success.sql`: `due_by` = fifth Nigerian business day, `processor_submitted_at`, `processor_settled_at`. It measures Paystack refunds. Nothing measures a protected-rail refund. |
| Kill switches (env `PAYMENTS_KILL_PAYLUK`, flag `payments_payluk_on`, `private.rentals_protected_pay_on`) | **Accurate** | `kill-switch.ts` (env then flag, fail closed for Payluk). Flag seeded false in d77 line 354. `private.rentals_protected_pay_on()` reads `payments_payluk_on` since d77 line 348. Two more gates not listed: the Payluk key's presence (`paylukMerchantConfig`) and the code constant `PAYLUK_ESCROW_FLOWS_BUILT = true`. |
| Safety rails | **Mostly accurate** | (a) A card charge that lands while the partner holds is not applied: it becomes refund-due, reason `partner_holds_payment` (`private.settle_booking_charge`, pov04 line 304); `railGate` refuses to open card on a deal whose chosen rail is escrow. (b) `provider_arrangements_02_paid_twice_alert` (pov05 line 380). (c) The two hour cancel of an unfunded arrangement applies to **stay bookings** through the hold sweep (`bookings_00_partner_hold_keeps_the_stay`, pov05 line 327), not to rent agreements, and two hours was sized for instant wallet funding, not a bank transfer. |
| "What does not exist: the HTTP client. There is no provider API call anywhere in the codebase." | **INACCURATE** | A complete Payluk HTTP client exists and calls `fetch`: `lib/payments/providers/payluk-client.ts` (`paylukRequest`, Bearer auth, rate gate, customers, wallet, intents, history), `payluk-arrangements.ts` (escrow create, verify, list, fund, confirm, milestone, delete, dispute, resolve) and `lib/payouts/payluk-merchant.ts` (`GET /v1/merchant/balance`). It was written from Payluk's vendored docs and never run against Payluk itself (its seams are marked `UNVERIFIED against live docs`). What is true: there is no client for the NEW provider. |

Two smaller inaccuracies elsewhere in the BUILD doc:

- Sections 2 and 3 say `apps/web/scripts/check-valuation-words.mjs` polices
  custody words. It does not: it polices the regulated valuation words. Custody
  wording is policed by `apps/web/src/lib/copy/custody-words.test.ts` and, in
  the database, by the event trigger `retired_custody_stays_retired`
  (`private.refuse_custody_objects`).
- Section 9 says `event_space`; SPECS Part 5 says `event_space_booking`. The
  BUILD doc overrides, so `event_space`.

One rule now in conflict: `apps/web/src/lib/copy/provider-name.test.ts`
enforces the founder's 29 October rule that the partner is never named to a
member. The 9 November ruling (BUILD section 3) requires a "Secured by" mark at
the payment step and the provider named in Terms, privacy, help and receipts.
That test must be rewritten, not worked around.

---

## 2. DATABASE OBJECTS

### 2.1 Tables and columns

| Object | Where | What it is | Class | Reason |
|---|---|---|---|---|
| `public.provider_arrangements` | d73b line 55; pause columns d68d line 415 | Vallo's record of a provider-held arrangement | PRESERVE-SHARED | Provider-neutral shape, the one writer is `provider_arrangement_observe`; reuse for the new provider. |
| `provider_arrangements.provider` check `in ('payluk')`, default `'payluk'` | d73b line 58 | Provider column | REPLACE | Must be widened to admit the new provider id (constraint swap, additive in effect). |
| `provider_arrangements.buyer_customer_id`, `seller_customer_id` NOT NULL | d73b lines 72 to 73 | Payluk merchant-customer ids | REPLACE | The new provider's identity reference is unknown; NOT NULL blocks every new row. Relax or add new nullable columns. |
| `provider_arrangements.amount_minor >= 100000` | d73b line 65 | Payluk minimum | COMPAT-KEEP | Keep until the new provider states its own minimum. |
| `provider_arrangements.who_pays_fee = 'seller'` | d73b line 69; D84 ruling 4 | Lister bears Payluk's 2 percent | COMPAT-KEEP | SPECS screen 1 shows a buyer-side "protection fee"; who pays is a founder decision. |
| `provider_arrangements.status` check (12 states) | d73b line 75 | Vallo state | PRESERVE-SHARED | Extend additively with `refund_requested` and `requires_review`. |
| `provider_arrangements.provider_state`, `provider_status` | d73b lines 81 to 82 | Provider's own words, never overwritten | PRESERVE-SHARED | Exactly what SPECS Part 7 asks for ("provider's original state"). |
| `provider_arrangements.provider_payment_token` | d73b line 63 | Payluk payment token | COMPAT-KEEP | Payluk-only concept; leave null for the new provider. |
| `public.provider_arrangement_milestones` | d73b line 105 | Staged releases | PRESERVE-SHARED | Whether the new provider supports staged release is unknown; keep. |
| `public.provider_arrangement_events` | d73b line 128 | Append-only transition log | PRESERVE-SHARED | The audit trail section 8 rule 10 needs. |
| `public.provider_webhook_events` | b6 line 175; check replaced in dojah_1 line 57 | Raw signed webhook log | PRESERVE-SHARED | Reuse; widen the provider check. |
| `public.financial_provider_accounts` | b6 line 37 | A member's customer record at a provider | PRESERVE-SHARED | Candidate home for the new provider's once-per-member identity reference; widen the check. Payluk rows stay. |
| `public.member_funds_reported` | b6 line 71 | Payluk member balance mirror | COMPAT-KEEP | Member wallet has no equivalent at the new provider (SPECS Part 6: no fictional wallet). Retire in Phase 6, never drop. |
| `public.funds_movements`, `public.funds_movement_events` | b6 lines 89, 142 | Payluk wallet deposits, withdrawals, sends | COMPAT-KEEP | Same: wallet rail only. |
| `public.payluk_commission_sweeps` | b3 line 34 | Append-only sweep log | HISTORICAL-LEAVE | A money log; its writer is dead code. Never drop. |
| `public.ledger_customer_funds`, `public.ledger_vallo_revenue` provider checks | b2 lines 130, 148 | Three-pot ledger | PRESERVE-SHARED | Widen the check if the protected rail is to post (it posts nothing today). |
| `public.ledger_entries` | 20260728 line 95 | Settlement rows | PRESERVE-SHARED | Card rail settlement; unchanged. |
| `public.chargebacks` provider check `('paystack','payluk')` | chargebacks migration line 67 | Card disputes | PRESERVE-SHARED | Chargebacks are a card concept; a bank-transfer rail does not need a value here. |
| `public.payment_rail_policy` (+ `payer_may_choose`) | 20261006030027 line 36; pov01 | Routing as dated data | PRESERVE-SHARED | `rail = 'escrow'` is a provider-neutral label. |
| `deal_agreements.payer_rail_choice`, `payer_rail_chosen_at` | pov01 | The payer's choice | PRESERVE-SHARED | Provider-neutral. |
| `transactions.rail`, `rail_policy_id` | 20261006030027 line 166 | Rail frozen at insert | PRESERVE-SHARED | Provider-neutral. |
| `public.booking_refunds` with v24 stamps | 20260805102702; v24 | Card refund clock | PRESERVE-SHARED | Unchanged; a protected refund clock is a gap (section 6). |
| `retired_custody.*` (escrows, escrow_evidence, escrow_rulings, escrow_float_snapshots, wallets, wallet_entries, wallet_pots) | track_a1 | September custody design, retired | HISTORICAL-LEAVE | Kept by retention law; no API role can reach it. |

### 2.2 Functions, triggers and policies

| Object | Where | What it is | Class | Reason |
|---|---|---|---|---|
| `private.rentals_protected_pay_on()` | d73b line 48; body replaced d77 line 348 | DB-side switch, reads `payments_payluk_on` | REPLACE | Repoint (create or replace) to the new provider's flag; the open function calls it. |
| `public.provider_arrangement_open(uuid, text, jsonb)` | d73b line 189; live body pov05 line 50 | Opens an arrangement | REPLACE | Requires both parties to hold an ACTIVE `financial_provider_accounts` row with `provider = 'payluk'` (pov05 lines 104, 109). A provider-aware open is needed; the old one stays for Payluk until Phase 6. |
| `public.provider_arrangement_observe(...)` | d73b line 286 | The one writer of status, locked, idempotent, refuses contradictions | PRESERVE-SHARED | Provider-neutral; route every new-provider observation through it. |
| `private.provider_arrangement_step_ok` | d73b line 168 | Legal transitions, twin of the TS table | PRESERVE-SHARED | Extend for new states; already refuses leaving a final state. |
| `private.provider_arrangement_events_append_only` + triggers `_no_rewrite`, `_no_truncate` | d73b lines 144 to 152 | Append-only guard | PRESERVE-SHARED | Audit integrity. |
| Policies `provider_arrangements_parties_read`, `..._milestones_parties_read`, `..._events_parties_read` | d73b lines 99, 120, 157 | Parties read their own rows | PRESERVE-SHARED | Correct for any provider. |
| `private.provider_arrangements_payable()` + trigger `provider_arrangements_00_payable` | d68d lines 420, 432 | Gate on insert | PRESERVE-SHARED | Redundant with the d77 gate but harmless; do not drop in this build. |
| `private.provider_arrangements_payable_gate()` + trigger `provider_arrangements_00_payable_gate` | d77 lines 422, 440 | Gate on insert and on Vallo-sourced move to `payment_processing` | PRESERVE-SHARED | Keep. Its update branch encodes Payluk's "renter funds from balance" step; on a bank-transfer rail only the insert branch will fire. |
| `private.provider_arrangements_release_not_paused()` + trigger `_01_release_not_paused` | d68d line 436; cbh01 line 128 | Release refused while paused or under chargeback hold | PRESERVE-SHARED | Provider-neutral safety. |
| `private.provider_arrangement_milestones_release_gate()` + trigger | cbh01 lines 148, 170 | Same for milestones | PRESERVE-SHARED | Provider-neutral. |
| `public.chargeback_release_gate(uuid)` | cbh01 line 97 | Release gate read | PRESERVE-SHARED | Provider-neutral. |
| `private.provider_arrangements_paid_twice_alert()` + trigger `_02_paid_twice_alert` | pov05 lines 352, 380 | Both-ways funding alert | PRESERVE-SHARED | Section 8 rule 3. |
| `private.notify_arrangement_change()`, `private.tell_arrangement()` + trigger `provider_arrangements_zz_notify_change` | nt02 lines 190, 240, 285 | In-app notices on state change | PRESERVE-SHARED | Wiring is right (fires on real state changes); the copy is REPLACE (section 7). |
| `public.admin_pause_release`, `public.admin_resume_release` | d68d lines 451, 478 | Staff pause | PRESERVE-SHARED | Needed for Vallo's own dispute process. |
| `private.rail_for_booking`, `private.rail_for_agreement`, `private.rail_base_for_*`, `private.rail_options_for_agreement`, `private.rail_policy_lets_payer_choose` | pov03 | Rail resolution | PRESERVE-SHARED | Provider-neutral. |
| `public.payment_rail_choose`, `public.payment_rail_options`, `public.payment_rail_for_booking`, `private.payer_rail_locked` | pov04 | Payer's choice RPCs | PRESERVE-SHARED | Provider-neutral. |
| `private.booking_partner_payment_live` | pov04 line 33 | Whether a partner holds a booking's money | PRESERVE-SHARED | Provider-neutral. |
| `private.settle_booking_charge` (reason `partner_holds_payment`) | pov04 line 233 | Card settlement refuses to apply a charge while a partner holds | PRESERVE-SHARED | Section 8 rule 3. |
| `private.transactions_payment_gate()` + trigger `transactions_00_payment_gate` | track_a2 line 706; d68d line 287 | Card charge gate | PRESERVE-SHARED | Section 8 rule 7. |
| `private.agreement_payable`, `public.agreement_payable_for` | d68d lines 247, 267 | "No payment before approval" | PRESERVE-SHARED | Section 8 rule 7. |
| `private.booking_partner_position`, `private.booking_is_paid`, `private.in_hold_sweep`, `private.release_stale_booking_holds`, `public.expire_booking_holds` | pov05 lines 160 to 213 | Hold sweep that respects partner money | PRESERVE-SHARED | Keep; the two hour grace needs to follow the provider's real funding expiry. |
| `private.bookings_partner_hold_keeps_the_stay()` + trigger `bookings_00_partner_hold_keeps_the_stay` | pov05 lines 286, 347 | A held stay cannot be cancelled away | PRESERVE-SHARED | Provider-neutral. |
| `public.partner_hold_unwind_cancel`, `public.refund_and_cancel_booking`, `private.rent_split_cancel` | pov05 lines 228 to 389 | Explicit unwind paths | PRESERVE-SHARED | Provider-neutral. |
| `public.account_deletion_blockers` | 20261021104410 line 45 | Deletion waits for partner money | PRESERVE-SHARED | Provider-neutral. |
| `public.ledger_record_payluk_commission(uuid, bigint, text, uuid)` | b2 line 375 | Escrow commission posting | DEAD-REMOVE | No caller anywhere (its TS wrapper is dead). Listed for the founder's end block; never auto-dropped. |
| `public.admin_payluk_commission_sweep()` | b3 line 72 | Desk read of the sweep log | HISTORICAL-LEAVE | Reads a historical log; harmless; dropping a function is not in scope. |
| `private.payluk_sweep_append_only()` + triggers on `payluk_commission_sweeps` | b3 lines 54 to 65 | Append-only guard | HISTORICAL-LEAVE | Protects a historical log. |
| `public.funds_movement_observe`, `private.funds_transition_ok`, `private.funds_movement_events_append_only` | b6 lines 154 to 215 | Wallet movement writer | COMPAT-KEEP | Wallet rail only; retire in Phase 6. |
| `private.chargeback_hold_blocks`, `public.admin_chargeback_hold_override` (name Payluk release in comments) | cbh01, fm02 | Chargeback hold over releases | PRESERVE-SHARED | Applies to any release. |
| `private.refuse_custody_objects()` + event trigger `retired_custody_stays_retired` | track_a1 lines 395, 423 | Refuses any table, view or function named `(^|_)(wallets?\|escrows?\|pots?)(_\|$)` or `^held_payment` in `public`/`private` | PRESERVE-SHARED | Binding naming constraint on every new object (section 6.8). |
| Legacy `public.escrow_*` functions (dropped) | track_a1 lines 243 to 259 and earlier August/September migrations | Retired Vallo-held escrow | HISTORICAL-LEAVE | Already gone; the migration files are history. |

### 2.3 Flag rows

| Flag | Seeded | Class | Reason |
|---|---|---|---|
| `payments_payluk_on` | false (d77 line 354) | COMPAT-KEEP | Stays false; it is Payluk's stop. Never repurpose it for the new provider. |
| `rentals_protected_pay` | false (d73b line 43), superseded and "read by nothing" (d77 line 358) | HISTORICAL-LEAVE | Dated record of the first switch. |
| `payments_paystack_off` | absent (Paystack fails open) | PRESERVE-SHARED | Card rail switch. |
| `wallet`, `held_payments`, `held_payments_payouts` | locked false by the flag guard (track_a1 line 110) | HISTORICAL-LEAVE | Retired custody switches; cannot be set true. |
| `agreement_review_all`, `agreement_staff_review` | false | PRESERVE-SHARED | Agreement gate, provider-neutral. |

### 2.4 Scheduled jobs

| Job | Where | Class | Reason |
|---|---|---|---|
| Vercel cron `/api/cron/arrangements-reconcile` | `apps/web/vercel.json` line 37 | PRESERVE-SHARED | Route and schedule are neutral; the job body is REPLACE (section 4). |
| "payluk-commission-sweep" | named only in a comment in `lib/payouts/commission-sweep-job.ts` line 10 | DEAD-REMOVE | Never scheduled in `vercel.json`, no route exists. |
| pg_cron `vallo_escrow_age_watch`, `vallo_escrow_book_the_float`, `vallo_escrow_invariants`, `vallo_escrow_sweep_timeouts` | unscheduled by track_a1 line 35 | HISTORICAL-LEAVE | Retired custody jobs. |
| Vercel cron `/api/cron/hold-sweep` | `vercel.json` | PRESERVE-SHARED | Calls the partner-aware sweep. |

### 2.5 Migration files, rollback snapshots, probes

| Item | Class | Reason |
|---|---|---|
| Applied migrations naming Payluk (b2_ledger, b3_payluk_commission_sweep, b3_fee_acceptance_record, b4_referral_rewards_engine, b6_member_money_rail, d73b, d68d, d77, d84, pov05, cbh01, chargebacks_record_state_recovery, dojah_1, 20261006030027) | HISTORICAL-LEAVE | Never edit an applied migration. |
| `supabase/migrations/APPLIED.txt` | HISTORICAL-LEAVE | Ledger of applied versions. |
| `pending/rollback/rb03_rail_for_booking_and_agreement.sql`, `rb04_settle_booking_charge.sql`, `rb05_partner_hold_and_sweep.sql` (rb05 holds the Payluk-requiring open body), `nt_notice_triggers_off.sql` | HISTORICAL-LEAVE | Rollback snapshots of live definitions. |
| Legacy escrow migrations (20260809 to 20260925, 12 files named for escrow, plus track_a1 which retired them) | HISTORICAL-LEAVE | September custody design, retired. |

---

## 3. SERVER CODE (`apps/web/src/lib`)

| Path | What it is | Class | Reason |
|---|---|---|---|
| `lib/payments/provider.ts` (whole seam) | Capability-typed provider interface | PRESERVE-SHARED | The right abstraction; SPECS Part 4 says do not duplicate it. |
| `lib/payments/provider.ts:34` `FiatProviderId = "paystack" \| "payluk"` | Provider id union | REPLACE | Add the new provider id. |
| `lib/payments/provider.ts:110` `hold_in_escrow: Record<never, never>` | Empty capability | REPLACE | Give it real methods (create, retrieve, release, refund, funding instructions) so the new adapter is reached through `can()`. |
| `lib/payments/provider.ts:138` `refund_without_dispute` | Capability | PRESERVE-SHARED | The new provider documents a refund endpoint; this capability fits. |
| `lib/payments/providers/index.ts` (`fiatProvider`, `escrowRailLive`, `memberWalletRailLive`) | Registry and rail-live checks | REPLACE | `escrowRailLive` reads `fiatProvider("payluk")` and `PAYLUK_ESCROW_FLOWS_BUILT`; it must read the new provider. |
| `lib/payments/providers/kill-switch.ts` | Env then flag | REPLACE | Binary mapping (`paystack` else `PAYMENTS_KILL_PAYLUK`, `payments_payluk_on`); generalise per provider. The pattern itself is right. |
| `lib/payments/providers/payluk.ts` | Payluk adapter, `PAYLUK_ESCROW_FLOWS_BUILT` | COMPAT-KEEP | Registered, unconfigured, fails closed. Retire in Phase 6. |
| `lib/payments/providers/payluk-client.ts` | Payluk HTTP client | COMPAT-KEEP | Used by wallet and arrangements; dormant with no key. |
| `lib/payments/providers/payluk-arrangements.ts` | Payluk escrow calls | COMPAT-KEEP | Only path for any Payluk row. |
| `lib/payments/providers/payluk-webhook.ts` | Signature and parse | COMPAT-KEEP | Used by the Payluk route. |
| `lib/payments/providers/payluk-fixtures.ts` | Test fixtures | COMPAT-KEEP | Test-only (named in a comment in `payluk.ts`). |
| `lib/payments/router.ts` | Rail router, `railGate`, `RAIL_REFUSAL` | PRESERVE-SHARED | Provider-neutral; only the comment on line 271 names Payluk. |
| `lib/payments/rail-choice.ts`, `rail-choice-read.ts`, `rail-choice-actions.ts` | Payer's choice | PRESERVE-SHARED | Provider-neutral. |
| `lib/payments/split-attempt.ts:92`, `lib/tenancy/share-checkout.ts:144` | `railGate(..., await escrowRailLive())` on card paths | PRESERVE-SHARED | Correct refusal; follows `escrowRailLive`. |
| `lib/money/arrangement-states.ts` `ARRANGEMENT_STATUSES`, `ARRANGEMENT_STEPS`, `stepAllowed`, `FINAL_ARRANGEMENT_STATUSES` | State machine | PRESERVE-SHARED | Extend with new states, in step with the SQL twin. |
| `lib/money/arrangement-states.ts:63` `valloStateFor` | Payluk state/status map | REPLACE | New provider's vocabulary (unknown) goes in the adapter's normaliser. Keep Payluk's map for Payluk rows. |
| `lib/money/arrangement-states.ts:83` `deliveryWindowDays` | Payluk delivery window and CLAIMED rule | COMPAT-KEEP | Payluk-only concept. |
| `lib/money/provider-arrangements.ts` | Open, pay, release, webhook apply, withdraw, staff resolve, reconcile | REPLACE | `ArrangementDeps.ctx: PaylukContext`; `payArrangement` funds from the Payluk balance; `requestRelease` uses the buyer-confirm route; `staffResolve` goes through a Payluk dispute; `PROTECTED_PAY_FLAG = "payments_payluk_on"`. Keep its rules (observe door, release gate, no blind retry) and make it provider-agnostic. |
| `lib/money/arrangement-actions.ts` (`releaseHeldPayment`) | Member release action | REPLACE | Built on `paylukContext()`. |
| `lib/money/fund-actions.ts` (`fundEscrowPayment`) | Member funding action | REPLACE | Pays from the Payluk balance; the new rail creates the arrangement and returns funding instructions. |
| `lib/money/fund-fallback-actions.ts` (`switchEscrowToCard`) | Withdraws an unfunded escrow at Payluk, then stores card | REPLACE | Needs the new provider's cancel route (unknown). |
| `lib/money/fund-model.ts`, `lib/money/fund-view.ts` | Fund screen model and read | REPLACE | Balance-shaped model. |
| `lib/money/held-model.ts`, `lib/money/held-view.ts` | Held screen model and RLS read | PRESERVE-SHARED | Reads `provider_arrangements` under RLS, provider-neutral; the Payluk fee field and copy change. |
| `lib/money/rail-live.ts` (`protectedRailLive`) | Server's "can the protected rail work" | PRESERVE-SHARED | Delegates to `escrowRailLive`; doc comment names Payluk. |
| `lib/money/rails.ts` | Pure rail helpers | PRESERVE-SHARED | Comment names the Payluk switch only. |
| `lib/money/partner-reads.ts` | Partner figures gated on `protectedRailLive` | PRESERVE-SHARED | Neutral. |
| `lib/money/member-wallet.ts`, `member-wallet-actions.ts`, `wallet-provision.ts`, `wallet-view.ts`, `balance-events.ts` | Payluk member wallet | COMPAT-KEEP | No equivalent at the new provider; retire in Phase 6 with a founder decision (the Wallet is in the nav). |
| `lib/money/funds.ts` `paylukPhone`, `paylukCountryIds` | Payluk phone rules | COMPAT-KEEP | Wallet onboarding only. |
| `lib/money/funds.ts` `normalisePhone` (imported by `lib/auth/actions.ts:4` as `paylukLocalPhone`) | Shared phone normaliser | PRESERVE-SHARED | Used by sign-in; only the alias names Payluk. |
| `lib/money/status.ts` `VALLO_STATUSES`, labels | Member status vocabulary (imported only by its test) | PRESERVE-SHARED | Close to the design spec's state identity table; wire it rather than invent another. |
| `lib/money/status.ts:65` `PAYLUK_ESCROW` table | Payluk escrow words | DEAD-REMOVE | Module has no importer outside its test. |
| `lib/money/status.ts:77` `PAYLUK_PAYMENT` table | Payluk payment words | DEAD-REMOVE | Same. |
| `lib/money/errors.ts` (`valloErrorFor`) | Vallo error vocabulary (imported only by a test) | PRESERVE-SHARED | Reuse as the adapter's normalised member-facing errors. |
| `lib/money/chargeback-hold-model.ts` | Chargeback hold over releases | PRESERVE-SHARED | Comment names Payluk only. |
| `lib/ledger/record.ts` `recordLedgerEntry` | Ledger writer | PRESERVE-SHARED | Neutral. |
| `lib/ledger/record.ts:56` `recordEscrowCommission` | Calls `ledger_record_payluk_commission` | DEAD-REMOVE | No caller outside its test. |
| `lib/ledger/events.ts:41` `LedgerProvider` | Provider union for ledger | PRESERVE-SHARED | Add the new provider when the rail posts. |
| `lib/payouts/payluk-merchant.ts` `paylukMerchantConfig`, `nairaToKobo`, `readMerchantBalance` | Payluk key, host and balance read | COMPAT-KEEP | Used by the Payluk adapter, webhook and provider checks. Its "live key only in production" rule is the pattern to copy. |
| `lib/payouts/payluk-merchant.ts:135` `withdrawMerchantWallet` | Always `not_available` | DEAD-REMOVE | Only caller is the dead sweep. |
| `lib/payouts/commission-sweep.ts`, `commission-sweep-job.ts` | Payluk commission sweep | DEAD-REMOVE | No route, no cron imports either file. |
| `lib/admin/reads/money-desk-sweep.ts` | Desk read of the sweep | DEAD-REMOVE | No importer outside its test. |
| `lib/admin/agreements-actions.ts` `pauseRelease`, `resumeRelease` | Staff pause | PRESERVE-SHARED | Neutral. |
| `lib/admin/agreements-actions.ts:180` `resolveHeldPayment` | Staff outcome through `paylukContext` | REPLACE | New provider: Vallo instructs release or refund directly. |
| `lib/admin/provider-checks.ts` | Read-only key checks | REPLACE | Add a new-provider check; the Payluk checks are COMPAT. |
| `lib/admin/reads/chargebacks-model.ts:21`, `chargebacks.ts:183` | Chargeback desk | PRESERVE-SHARED | Historical provider label. |
| `lib/admin/watch-list.ts` | Agreement watch list with release state | PRESERVE-SHARED | Neutral. |
| `lib/admin/reads/jobs.ts:80`, `lib/cron/freshness.ts:122` | Job registry and freshness | PRESERVE-SHARED | Neutral. |
| `lib/cron/jobs/arrangements-reconcile.ts` | Reconcile job body | REPLACE | `paylukContext()` and a limit of 3 sized to Payluk's rate. |
| `lib/bookings/actions.ts:482`, `lib/account-deletion/preconditions.ts` | Read arrangements | PRESERVE-SHARED | Neutral. |
| `lib/trust/claims.ts:124 to 140` | Registered product claim about the protected rail | REPLACE | Text names the Payluk switch and "escrow"; must match the new rail and section 3. |
| `lib/legal/privacy.tsx:293` | Privacy policy names Payluk as wallet provider | REPLACE | Must name the new provider and the custodian (BUILD 3.5). |
| `lib/legal/versions.ts:49` | Policy version note | REPLACE | Bump with the privacy change. |
| `lib/settings/profile-phone.ts`, `lib/subscriptions/checkout.ts` | Comments naming Payluk | PRESERVE-SHARED | Comment only. |
| `lib/supabase/database.types.ts` (8968, 15311, 16635) | Generated types | PRESERVE-SHARED | Regenerate after the SQL lands. |
| `proxy.ts:410` `/api/payluk/webhook` allow entry | Public route allow-list | COMPAT-KEEP | Keep while the route exists; add the new webhook path. |
| `lib/nav/route-parents.ts:777, 807` | Route register | COMPAT-KEEP | Keep; add the new route. |

---

## 4. API ROUTES AND CRONS

| Path | What it is | Class | Reason |
|---|---|---|---|
| `app/api/payluk/webhook/route.ts` | Payluk webhook | REPLACE | A new route at `app/api/<provider>/webhook/route.ts` does this job. The Payluk route stays until Phase 6 (it answers 503 `not_configured` with no key). |
| `app/api/cron/arrangements-reconcile/route.ts` | Cron wrapper | PRESERVE-SHARED | Neutral; delegates to the job. |
| `app/api/dojah/webhook/route.ts` | Shares `provider_webhook_events` | PRESERVE-SHARED | Same raw-event pattern. |
| `app/api/statement/route.ts` | Wallet statement CSV | COMPAT-KEEP | Wallet history; a protected-payments export is a separate gap. |

---

## 5. MEMBER SCREENS AND COMPONENTS

| Path | What it is | Class | Reason |
|---|---|---|---|
| `app/(app)/agreements/[id]/fund/page.tsx` | "Pay into escrow" | REPLACE | Becomes funding instructions and waiting. Title uses "escrow". |
| `app/(app)/agreements/[id]/fund/FundControl.tsx` | Money swipe from Wallet | REPLACE | A transfer rail has no swipe-to-pay; "I've made the transfer" only refreshes status. |
| `app/(app)/agreements/[id]/fund/SwitchToCard.tsx` | Way out to card | PRESERVE-SHARED | Keep the pattern; its action is REPLACE. |
| `app/(app)/agreements/[id]/fund/loading.tsx`, `held/loading.tsx` | Skeletons | PRESERVE-SHARED | Neutral. |
| `app/(app)/agreements/[id]/held/page.tsx` | "Escrow payment" | REPLACE | Rebuild as the PROTECTED hero and its states. |
| `app/(app)/agreements/[id]/held/HeldPaymentBody.tsx`, `held-payment.css` | Held card | REPLACE | Copy and structure differ from SPECS screen 5; CSS header comment says "held by Payluk". |
| `app/(app)/agreements/[id]/held/ReleaseControl.tsx` | Generic release swipe | REPLACE | SPECS screen 6: category-specific milestone with a confirmation sheet. |
| `components/money/fund/FundScreen.tsx`, `fund-payment.css` | Fund screen body | REPLACE | Balance-shaped. |
| `components/money/pay-choice/PayChoiceCard.tsx`, `pay-choice.css` | Escrow vs card | REPLACE | Copy and fees must follow SPECS screen 1; option hidden for unapproved categories. |
| `app/(app)/wallet/*`, `components/money/balance/*` (BalanceScreen, BalanceView, AddMoneyScreen, SendScreen, WithdrawScreen, WalletCard, WalletChrome, WalletRows, WalletSettingsScreen, TransactionsScreen, BalanceOnboarding, MoveKit) | Payluk member wallet | COMPAT-KEEP | No wallet at the new provider; founder decides its retirement in Phase 6. |
| `app/(app)/agreements/[id]/page.tsx`, `components/app/agreements/AgreementBody.tsx`, `AgreementControls.tsx` | Agreement, links to fund/held | PRESERVE-SHARED | Neutral routing; escrow wording is REPLACE under copy. |
| `app/(app)/checkout/[bookingId]/page.tsx` | Card checkout, escrow paused path | PRESERVE-SHARED | Card rail. |
| `app/(app)/refunds/page.tsx`, `components/money/RefundsView.tsx` | Refunds with the 5 day clock | PRESERVE-SHARED | Card rail. |
| `app/(app)/payments/page.tsx`, `components/money/PaymentsView.tsx` | Payments home | PRESERVE-SHARED | Extend for protected rows. |
| `components/money/ReceiptActions.tsx`, `ReceiptVault.tsx`, `components/app/money/receipt-model.ts` | Receipts and print | PRESERVE-SHARED | Extend with custodian and provider reference. |
| `app/(dev)/preview/fund/*`, `preview/held`, `preview/pay`, `preview/balance`, `preview/money/*`, `preview/fixes/providers/page.tsx` | Dev previews with Payluk fixtures | COMPAT-KEEP | Fixture harness; redraw with the new design. |
| `app/(site)/docs/facts.ts`, `chapters.tsx`, `chapters-people.tsx` | Public docs about the protected rail | REPLACE | Must describe the new rail and custodian. |

---

## 6. ADMIN SCREENS

| Path | What it is | Class | Reason |
|---|---|---|---|
| `app/admin/agreements/WatchList.tsx` | Pause, resume, staff outcome | PRESERVE-SHARED | Neutral UI; its resolve action is REPLACE (section 3). |
| `app/admin/operations/providers/page.tsx`, `ProviderCheckList.tsx` | Provider key checks | PRESERVE-SHARED | Add the new provider. |
| `app/admin/chargebacks/ChargebackCase.tsx:120` | Provider label | PRESERVE-SHARED | Historical label. |
| `app/admin/_components/nav.ts:206` | Comment | PRESERVE-SHARED | Comment only. |
| `app/admin/money/*` | Money desk (comments about retired escrow) | PRESERVE-SHARED | No sweep panel is wired. |
| `packages/i18n/src/locales/chargebacks.en.ts:98` `payluk: "Payluk"` | Staff label | PRESERVE-SHARED | Labels historical rows. |

---

## 7. COPY AND DOCS

| Path | What it is | Class | Reason |
|---|---|---|---|
| `lib/money/copy.ts:1014` `HELD_BY_LINE` | Held line | REPLACE | Replace with the approved funds wording (full) from the constants module. |
| `lib/money/copy.ts:1048 to 1110` `FUND_TITLE`, `FUND_BY_LINE`, `FUND_NO_FEE_LINE`, `FUND_STEPS`, `FUND_SWIPE_LABEL`, `FUND_*_LABEL`, `FUND_FROM_BALANCE`, `FUND_TOP_UP`, `FUND_OPEN_BALANCE`, `FUND_CLOSED`, `FUND_REFUSED`, `FUND_STEPS_STAY` | Fund copy | REPLACE | Wallet and swipe copy; "Pay it into escrow". |
| `lib/money/copy.ts:1040 to 1041` `RELEASE_*` | "Swipe to release to the lister" | REPLACE | SPECS screen 6 copy. |
| `lib/money/copy.ts:1117 to 1150` `PAY_CHOICE_*`, `SWITCH_TO_CARD_*` | Choice copy | REPLACE | SPECS screen 1 copy. |
| `lib/money/copy.ts:99` `PROTECTED_SHORT` ("protected through Vallo's transaction infrastructure") | Promise line | REPLACE | Reads as Vallo operating the protection (BUILD 3.6). |
| `lib/money/copy.ts:299` `ESCROW_PROTECTION_WHEN` | Fee policy wording | REPLACE | Ties to Payluk's 2 percent (D61). |
| `ReleaseControl.tsx` inline labels ("Asking our licensed provider to release it") | Inline copy | REPLACE | Move to the constants and SPECS wording. |
| nt02 `private.tell_arrangement` notice texts | In-app notices | REPLACE | Refund notice promises "5 to 10 working days" (SPECS screen 9: no arrival time unless contractual); must use the shared state labels. |
| `packages/i18n/src/locales/en.ts` pay-choice block (around line 6498), `ha.ts`, `ig.ts`, `yo.ts` escrow strings | Choice dictionary | REPLACE | "Escrow" labels; English only for new copy, translations only when verified. |
| `lib/copy/custody-words.test.ts:186 to 205` (Payluk exemptions) | Copy gate exemptions | COMPAT-KEEP | Exempts the Payluk merchant reason; extend the gate for the new rail. |
| `docs/payments/payluk-source/*` (36 files), `docs/payments/PAYLUK_LIVE_DOCS_FINDINGS.md` | Vendored Payluk docs and findings | HISTORICAL-LEAVE | Source record for the Payluk code. |
| `docs/adr/0003-...md`, `docs/adr/0004-...md` | ADRs naming Payluk | HISTORICAL-LEAVE | Write a new ADR that supersedes the provider choice; ADR 0003's principle stands. |
| `docs/RULINGS.md`, `docs/DECISIONS_2026-10-13.md`, `docs/sessions/founder-corpus/*`, `docs/handoff/SURVEY_B_WORKSPACES_BACKEND.md` | Decision logs and snapshots | HISTORICAL-LEAVE | Records. |
| `docs/payments/VALLO_PAYMENTS_ARCHITECTURE.md`, `VALLO_FINANCIAL_LAYER.md`, `VALLO_PRICING.md`, `DIASPORA_PAYMENTS.md`, `RELEASE_RUNBOOK.md`, `docs/MONEY_ARCHITECTURE.md` | Current architecture and runbooks | REPLACE | Describe Payluk as the provider; update in Phase 6. |
| `docs/ENVIRONMENT.md:83 to 84, 130`, `HANDOFF.md`, `docs/README.md`, `docs/NEXT_SESSION_PROMPT.md`, `docs/REMAINING_WORK.md`, `docs/LEGAL_AND_NDPC_READINESS.md`, `docs/PAGE_SWEEP.md`, `docs/schema/NAMES.md`, `docs/identity/DOJAH.md`, `docs/TWILIO_SETUP.md` | Living docs naming Payluk | REPLACE | Update references when the new rail lands. |

---

## 8. TESTS

| Path | Class | Reason |
|---|---|---|
| `lib/payments/providers/payluk-client.test.ts`, `payluk-arrangements.test.ts`, `payluk-provider.test.ts` | COMPAT-KEEP | Test the Payluk adapter while it exists. |
| `app/api/payluk/webhook/route.test.ts` | COMPAT-KEEP | Tests the Payluk route. |
| `lib/money/provider-arrangements.test.ts`, `-lifecycle.test.ts`, `-refund.test.ts` | REPLACE | Rewrite around a provider-agnostic orchestration with a fake adapter; keep their invariants (no blind retry, terminal states, observe door). |
| `lib/money/arrangement-states.test.ts` | PRESERVE-SHARED | Holds TS and SQL step tables equal; extend for new states. |
| `lib/payments/providers/kill-switch.test.ts` | REPLACE | Generalise with the kill switch. |
| `lib/money/fund-model.test.ts`, `fund-fallback-actions.test.ts`, `held-model.test.ts` | REPLACE | Follow their models. |
| `lib/money/member-wallet-actions.test.ts`, `funds.test.ts`, `open-failure.test.ts`, `components/money/balance/BalanceScreen.dom.test.tsx` | COMPAT-KEEP | Wallet rail. |
| `lib/payouts/commission-sweep.test.ts`, `lib/admin/reads/money-desk-sweep.test.ts` | DEAD-REMOVE | Go with the dead code they test. |
| `lib/ledger/record.test.ts` (recordEscrowCommission block), `lib/ledger/events.test.ts` | PRESERVE-SHARED | Ledger rules; drop the escrow block with its function. |
| `lib/money/status.test.ts` | PRESERVE-SHARED | Vocabulary rules (unknown is under review, never success). |
| `lib/copy/provider-name.test.ts` | REPLACE | Conflicts with the 9 November ruling; rewrite to allow the provider's name only through the constants module and the legal pages. |
| `lib/legal/privacy-truth.test.ts:32` | COMPAT-KEEP | Keep the Payluk host rule; add the new host once the base URL is known. |
| `lib/payments/rail-choice.test.ts`, `split-attempt-rail.test.ts`, `split-hotel-room.test.ts`, `lib/tenancy/share-checkout-rail.test.ts`, `router*.test.ts` | PRESERVE-SHARED | Rail invariants. |
| `lib/admin/agreements-actions.test.ts` | REPLACE | Resolve path changes. |
| `proxy.test.ts:423, 571` | COMPAT-KEEP | Add the new webhook path. |
| `supabase/tests/probes/d73b-provider-arrangements.sql`, `d68d-...`, `d77-...`, `pov04-...`, `pov05-...`, `nt02-...`, `cbh01-...`, `chargebacks.sql`, `b2-ledger.sql` | PRESERVE-SHARED | Database invariants run in CI (`db-probes`); extend for new columns and states. |
| `supabase/tests/probes/b6-member-money-rail.sql`, `b3-payluk-sweep.sql` | COMPAT-KEEP | Wallet and sweep invariants. |
| `apps/web/tests/gate.spec.mjs:178` (`/escrow` redirect), `trust-surfaces.spec.mjs:239` | PRESERVE-SHARED | Guard the retired custody design. |

---

## 9. ENV AND CONFIG

| Path | What it is | Class | Reason |
|---|---|---|---|
| `apps/web/.env.example:107` `PAYMENTS_KILL_PAYLUK` | Payluk outage stop | COMPAT-KEEP | Add `PAYMENTS_KILL_<PROVIDER>` beside it. |
| `apps/web/.env.example:112 to 113` `PAYLUK_SECRET_KEY`, `PAYLUK_TEST_SECRET_KEY` | Payluk keys (empty in the example) | COMPAT-KEEP | Keep empty; add the new names. |
| `apps/web/.env.example:473` `PAYLUK_COUNTRY_IDS` | Wallet onboarding | COMPAT-KEEP | Wallet only. |
| `apps/web/.env.example:106` `PAYMENTS_KILL_PAYSTACK` | Card stop | PRESERVE-SHARED | Card rail. |
| `apps/web/vercel.json:37` arrangements-reconcile cron | Schedule | PRESERVE-SHARED | Neutral. |
| `apps/web/next.config.ts:268 to 271` `/escrow`, `/admin/escrow` redirects | Old links | HISTORICAL-LEAVE | Old custody URLs land safely. |
| `.github/workflows/ci.yml` | No Payluk reference; runs `db-probes` | PRESERVE-SHARED | CI is where probes run. |
| `knip.jsonc` | Dead-code report (warn only) | PRESERVE-SHARED | Did not flag the dead sweep as an error; confirm with a knip run before Phase 6 removals. |

Credential-like values: test fixtures carry `sk_test_` and `sk_live_` shaped
strings in `lib/payouts/commission-sweep.test.ts:45` and
`lib/payments/providers/payluk-client.test.ts` (lines 50, 290 to 293). They
are synthetic test keys. No value is copied here. No real credential was found
in the env examples (all values empty).

---

## 10. GAPS AND THE BUILD PLAN

### 10.1 The adapter

`apps/web/src/lib/payments/providers/<provider>/`, server-only, disabled by
default, reached only through `fiatProvider()` and `can()`:

| File | Job | What can be written now |
|---|---|---|
| `config.ts` | Read env, pick environment, refuse a production key outside production | Env names from SPECS: `ESCROWPAY_API_BASE_URL`, `ESCROWPAY_API_KEY`, `ESCROWPAY_WEBHOOK_SECRET`, `ESCROWPAY_ENVIRONMENT` (adapt to repo convention). Copy the rule in `paylukMerchantConfig`: live credentials only when `VERCEL_ENV` is production. The base URL itself: TODO. |
| `types.ts` | Request and response types | Vallo-side types only; provider fields TODO. |
| `schemas.ts` | Runtime validation (zod is already in the app) | Shape TODO; the rule (reject malformed, unknown status is not success) can be written. |
| `client.ts` | HTTP with injected fetch, timeouts, UNKNOWN on no answer, no blind retry | The skeleton, copying `paylukRequest`'s discipline. Auth header: TODO. Idempotency header: TODO. |
| `provider.ts` | `defineFiatProvider([...])` with `hold_in_escrow` and `refund_without_dispute` | Declare only what the docs confirm. |
| `webhooks.ts` | Verify signature over the raw body, constant time | Header name and algorithm: TODO. Until known, verification returns false and the route refuses. |
| `normaliser.ts` | Provider state onto `ArrangementStatus`, null for anything undocumented | Table in 10.3, all provider words TODO. |
| `errors.ts` | Provider errors onto `RailFailureKind` and `lib/money/errors.ts` codes | HTTP-level mapping can be written; provider codes TODO. |

Also needed outside the folder: a provider id in `FiatProviderId`; methods on
`hold_in_escrow`; a per-provider kill switch; `escrowRailLive` reading the new
provider; a provider-agnostic `lib/money/provider-arrangements.ts`; a new
webhook route; the reconcile job choosing the adapter by
`provider_arrangements.provider`.

### 10.2 What the SPECS confirm, and what is unknown

**Confirmed by the SPECS (still to be checked against the official sandbox
documentation before any code relies on it):**

- Provider: EscrowPay. Custodian: Rubies Microfinance Bank, licensed by the
  Central Bank of Nigeria. Funds move only on Vallo's instruction; the provider
  never holds members' money.
- Four endpoint paths: `POST /v1/escrows`, `GET /v1/escrows/:id`,
  `POST /v1/escrows/:id/release`, `POST /v1/escrows/:id/refund`.
- Features: conditional settlement, bank-transfer funding, buyer and seller
  identity verification (once per member), funding instructions, signed
  webhooks, lifecycle events, release and refund instructions, a named
  custodian, third-party identity verification.
- Funding: bank transfer only, no cards, at the time of writing.
- Split: not publicly documented. Wallet: none.
- Presentation: Option 2 ("Secured by" mark at the payment step, standard fees).
- Fees (money in, money out, identity) as in the appendix; to come from one
  config module, never hardcoded in copy.
- Vallo runs its own dispute process; members must be told identity checks and
  holding of funds are done by third parties.

**Unknown. Each must be an explicit TODO in code, never invented:**

1. Sandbox and production base URLs.
2. Authentication header name and scheme.
3. Webhook signature header, algorithm and what it signs (raw body or not);
   whether `ESCROWPAY_WEBHOOK_SECRET` is distinct from the API key.
4. Webhook event names, envelope shape, event id for de-duplication, retry and
   ordering behaviour, environment marker.
5. Request and response bodies for all four endpoints; whether `:id` is the
   provider's id or accepts Vallo's reference; amount unit (kobo or naira).
6. Idempotency header support (if none, the Payluk pattern applies: Vallo's
   reference stored first, read back after any unanswered call).
7. The escrow status vocabulary.
8. Funding instruction structure (account per escrow or shared, reference
   format, whether an expiry is returned).
9. Behaviour on short, over, duplicate or late transfers.
10. How to cancel an unfunded escrow (needed for "switch to card" and expiry).
11. Identity verification: attributes, flow, consent capture, result shape,
    whether an existing Vallo verification can be passed.
12. Rate limits.
13. Refund destination (original account), settlement timing after release,
    per-transaction and per-day limits, maximum hold duration (annual rent),
    dispute handling: all listed as outstanding in BUILD section 0.
14. Whether the provider auto-releases on buyer silence. A founder-corpus note
    (`docs/sessions/founder-corpus/12-never-holds-money.md` line 121) says its
    public model gives the buyer 48 hours and silence releases. That conflicts
    with SPECS screen 6 ("no unexpected automatic release countdown") and must
    be settled in the agreement.
15. Partial release or milestones.
16. The "Secured by" mark asset and its exact text.
17. Who bears the money-in fee (buyer as SPECS screen 1 draws, or lister as the
    database enforces).

### 10.3 State mapping

Vallo states are those of `lib/money/arrangement-states.ts`. Every provider
word is unknown today.

| Lifecycle fact (SPECS Part 6, design screens) | Provider state | Vallo state | Status |
|---|---|---|---|
| Arrangement row made, before any call | (none) | `preparing` | Exists |
| Create sent, no answer | (none) | `unknown` | Exists |
| Escrow created, transfer instructions issued | TODO | `awaiting_payment` | Exists |
| Transfer reported, custody not yet confirmed ("Transfer received") | TODO | `payment_processing` | Exists; relabel for a transfer rail |
| Provider confirms funds held | TODO | `protected` | Exists |
| Vallo instructs release | (Vallo act) | `release_requested` (SPECS `release_pending`) | Exists |
| Provider confirms release | TODO | `released` | Exists |
| Vallo instructs refund | (Vallo act) | **missing**: add `refund_requested` (SPECS `refund_pending`) | Gap |
| Provider confirms refund | TODO | `refunded` | Exists |
| Dispute opened in Vallo's own process | (Vallo act; provider state TODO if any) | `disputed` | Exists; today only a provider report sets it |
| Wrong amount, late transfer, unexpected final state | TODO | **missing**: add `requires_review` | Gap |
| Create refused or failed | TODO | `failed` | Exists |
| Unfunded escrow expired or withdrawn | TODO | `cancelled` | Exists |
| Split outcome | Not documented | `split` | Historical only; never set for the new provider |
| Any provider word not in the docs | any | `null`: recorded, nothing moves | Exists in the pattern; must stay. Never `released`. |

### 10.4 Flags and kill switches

| Switch | Where | Default today | For the new provider |
|---|---|---|---|
| `PAYMENTS_KILL_PAYSTACK` | env | unset (running) | unchanged |
| `PAYMENTS_KILL_PAYLUK` | env | unset | leave; Payluk is off anyway |
| `payments_paystack_off` | flag | absent (fails open) | unchanged |
| `payments_payluk_on` | flag | false (fails closed) | stays false |
| `rentals_protected_pay` | flag | false, superseded | historical |
| `PAYLUK_ESCROW_FLOWS_BUILT` | code constant | true | Payluk only |
| Payluk key presence | env | absent | Payluk only |
| `private.rentals_protected_pay_on()` | SQL | reads `payments_payluk_on` | repoint to the new flag |
| Needed: `PAYMENTS_KILL_<PROVIDER>` | env | unset | stops new arrangements only |
| Needed: `payments_<provider>_on` | flag | **false**, fail closed | the founder's switch |
| Needed: partner mark flag | flag | on (Option 2) | one-line change to white label |
| Needed: category table | SQL | every category `disabled` | section 10.5 |
| Needed: `ESCROWPAY_ENVIRONMENT` guard | env | sandbox | production credentials refused outside production |

Rule carried over from `kill-switch.ts` and section 8 rule 11: the switches
gate only what STARTS money movement. Verify, webhooks and reconciliation are
never gated, so a funded arrangement is never abandoned.

### 10.5 Category eligibility (BUILD section 9)

Nothing like it exists. The nearest thing is `payment_rail_policy`, which
routes by property type, intent and lister kind but records no provider
approval. Needed:

- A table of the eight categories (`residential_rent`, `shortlet`,
  `hotel_booking`, `commercial_rent`, `property_sale`, `land_sale`,
  `event_space`, `other`) with status `approved`, `pending_approval`,
  `not_supported` or `disabled`, seeded all `disabled`.
- Approval recorded with a date, the provider's written approval reference and
  the founder's sign-off; an append-only history; no client write path.
- A server function that maps an agreement to its category, and the open
  function refusing anything not `approved`. The pay-choice screen hides the
  protected option for a category that is not approved.

### 10.6 SQL needed (additive only)

All of it goes to `supabase/migrations/pending/` with a README note. None of it
touches a live money row. Items 1, 2 and 5 replace or relax a constraint on a
money table: they belong in the founder's ordered block, not an automatic
apply. Every name must pass `private.refuse_custody_objects` (no `escrow`,
`wallet` or `pot` as a whole word, nothing starting `held_payment`).

1. Widen `provider_arrangements.provider` check to include the new provider id.
2. Relax NOT NULL on `buyer_customer_id`, `seller_customer_id`, or add nullable
   identity reference columns used by the new provider.
3. Add nullable columns to `provider_arrangements`: `category`,
   `provider_reference`, `environment`, `accepted_agreement_version`,
   `funding_instructions` (jsonb, cleared after expiry), `funding_expires_at`,
   `funded_at`, `release_requested_at`, `release_confirmed_at`,
   `refund_requested_at`, `refund_confirmed_at`, `last_provider_check_at`,
   `last_webhook_at`, `last_reconcile_at`, `last_reconcile_result`,
   `review_reason`.
4. Widen the status check with `refund_requested` and `requires_review`;
   create or replace `private.provider_arrangement_step_ok` to match (with its
   TS twin and probe).
5. Widen `provider_webhook_events.provider` (and `financial_provider_accounts`,
   `ledger_customer_funds`, `ledger_vallo_revenue` if used).
6. The category table, its history table, its read function and a staff RPC
   that records approval with the founder's sign-off.
7. Flag rows: `payments_<provider>_on` false, the partner mark flag.
8. Create or replace `private.rentals_protected_pay_on()` to read the new flag.
9. A provider-aware open function (for example
   `public.protected_payment_open(p_agreement, p_provider)`) that checks the
   flag, the category, the agreement gate and the single live arrangement,
   without requiring Payluk customer records.
10. For BUILD section 6.3: a named payer on `deal_agreements` with consent
    stamps from both parties.
11. Create or replace the stay hold sweep so an unfunded arrangement's grace
    follows the provider's real funding expiry rather than a fixed two hours.

### 10.7 Frontend (BUILD section 7): exists versus missing

| Section 7 item | Exists | Missing |
|---|---|---|
| 7.1 Payment choice | `PayChoiceCard` (escrow or card) | SPECS screen 1 copy, fee comparison from config, hidden on unapproved categories |
| 7.1 What you pay | Card `TransactionCheckout` | Protected breakdown with every fee and who receives what |
| 7.1 Who you are paying | Not at the payment moment | Counterparty, badge, tenure, response record |
| 7.1 Eligibility notice (section 6) | Nothing | Listing line, inspection and agreement reminder, named payer |
| 7.1 Promise line | `HELD_BY_LINE` (Payluk wording) | Funds wording from the constants module |
| SPECS screen 2 Review the protection agreement | Nothing | Separate step, checkbox, stored accepted version |
| 7.2 Funding instructions | Nothing (swipe from Wallet) | Account, bank, reference, amount, expiry, one-tap copy |
| 7.2 Waiting | Nothing | Refresh against our backend, last checked, help |
| 7.2 PROTECTED hero | `held/page.tsx` (partial) | SPECS screen 5 layout, custody card, motion |
| 7.2 Milestone | `ReleaseControl` (generic swipe) | Category-specific confirm with a sheet |
| 7.2 Release in progress, released | Status on the held page | Dedicated states and receipt link |
| 7.2 Dispute | Staff-only resolve | Member dispute flow, evidence, statements, timeline |
| 7.2 Refund in progress, refunded | Notice only | Screens |
| 7.3 Card rail | Checkout, refunds with the 5 day clock | Chargeback rights explainer |
| 7.4 Receipts | `ReceiptVault`, `ReceiptActions` (print) | Custodian, provider reference, release or refund history, help links |
| 7.5 Payments home | `PaymentsView` | Protected rows, filters, search, CSV or PDF export, timeline |
| 7.6 Seller side | Held page lister role | SPECS screen 10, payout account warnings |
| 7.7 Trust surfaces | No protected-payment explainer | "How your money is protected" page, honest limits |
| 7.8 Failure states | Nothing for the transfer rail | Every one listed |
| 7.9 Notifications and email | In-app via nt02 | Email, shared state labels, no arrival promise |
| 7.11 Admin | Watch list pause and resume, provider checks, chargeback desk | Arrangement ops view with provider state beside ours, reconciliation report, dispute desk |
| Partner mark | Nothing | One component behind one flag |

### 10.8 The approved funds wording, verbatim

From `PROTECTED_PAYMENTS_SPECS.md`, appendix. Not to be paraphrased, softened,
translated, split or reordered.

Full, for the confirmation screen and the receipt:

> Your payment is held by Rubies Microfinance Bank, licensed by the Central Bank of Nigeria, and released to the seller once you confirm delivery.

Short, for the payment step:

> Held by Rubies MFB, a CBN licensed bank, until you confirm delivery.

Also approved, as Vallo's own promise (BUILD section 2, SPECS "The Vallo
promise"), separate from the provider's wording:

> Your payment is held by a licensed bank until you confirm check-in. Vallo never holds your money.

Note for the founder: the provider's wording says "confirm delivery". On rent
the milestone is a handover, and the wording may not be altered. Whether the
provider will approve a handover variant is a question for them.

**Where the constants live:** one module,
`apps/web/src/lib/money/protected-wording.ts`, beside `lib/money/copy.ts`,
exporting the two strings, the custodian name as agreed, and the partner mark
text (TODO until supplied). A sibling test,
`apps/web/src/lib/money/protected-wording.test.ts`, scans `apps/web/src` and
`packages/i18n` and fails on any literal that names the custodian or reads as
a near-miss of either string without importing the constant. Fees shown to a
member come from a separate single config module (for example
`apps/web/src/lib/money/protected-fees.ts`). `provider-name.test.ts` is
rewritten so the provider's name is allowed only through that module and the
legal pages.

### 10.9 Recommended build order

1. Founder reads this audit (BUILD Phase 1 asks for that before code).
2. SQL in `pending/`: categories table (all disabled), new flag rows (off), the
   additive columns and states, widened checks, the provider-aware open.
3. Constants module and its near-miss test; fees config; rewrite of
   `provider-name.test.ts`.
4. Seam work: provider id, `hold_in_escrow` methods, per-provider kill switch,
   `escrowRailLive` reading the new provider.
5. Adapter skeleton with every unknown as a TODO, failing closed; normaliser
   with an empty provider vocabulary (everything maps to null).
6. Provider-agnostic orchestration in `provider-arrangements.ts`, tested with a
   fake adapter: open, instructions, observe, release, refund, review.
7. New webhook route (refuses everything until the signature method is known)
   and the reconcile job choosing the adapter per row.
8. Design pass, then screens (section 10.7), then admin views.
9. When the provider's sandbox documentation and credentials arrive: fill the
   TODOs, run every Phase 5 case, keep every switch off, and report ready.
