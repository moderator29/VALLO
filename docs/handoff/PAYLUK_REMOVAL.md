# PAYLUK REMOVAL (10 November 2026)

Founder: "Remove Payluk. What is this Payluk naming? We are not using them in
our platform no more." This file is the audit and the record. It is the one
place (with the SQL, the legal log and the decision row) that still says the
name, on purpose.

## Is anything live dependent on it? No.

- The old rail was switched off live (`payments_payluk_on` false, set 9 Nov).
  Zero arrangements were ever opened on it.
- Referral reward payouts (`lib/payouts/referral-*.ts`) are Paystack transfers.
  They never called the Payluk merchant client.
- The member Wallet (/wallet: balance, add money, send, withdraw) had Payluk
  as its ONLY provider and was off with the same switch. It is not deleted:
  the screens and server actions stay, but no provider is registered
  (`walletProvider()` returns null, `memberWalletRailLive()` returns
  "not_configured"), so it reads "not live" exactly as it did. DECISION FOR
  THE FOUNDER: the Wallet needs a new provider to ever work, or its screens
  should be deleted too.

## Audit (what mentioned the name, and what happened)

| Group | Files | Action |
|---|---|---|
| (a) User-visible copy | `lib/legal/privacy.tsx` (section 5 bullet), `lib/money/copy.ts` (comment), held/fund pages comments | Bullet removed (logged in LEGAL_PAGES_CHANGES.md); wording neutral |
| (b) Staff / admin copy | `lib/admin/provider-checks.ts` (two key checks), `app/admin/_components/nav.ts`, `app/admin/chargebacks/ChargebackCase.tsx`, `chargebacks.en.ts`, `lib/admin/reads/chargebacks-model.ts`, `lib/admin/agreements-actions.ts` | Provider check now reports the protected-pay provider's settings only (no network); chargeback provider list is Paystack only; the staff "resolve a held payment" action now answers "partner not configured" (no rail can carry it) |
| (c) Dead old rail code | `app/api/payluk/webhook/**`; `lib/payments/providers/payluk*.ts` (adapter, client, arrangements, webhook, fixtures, 3 test files); `lib/payouts/payluk-merchant.ts`; `lib/money/provider-arrangements.ts` and its 3 test files; `lib/money/fund-actions.ts`, `arrangement-actions.ts`, `fund-fallback-actions.ts` (+test); `FundControl.tsx`, `SwitchToCard.tsx`, `ReleaseControl.tsx`; `components/money/fund/**`; `lib/money/fund-model*.ts` (+2 tests); `HeldPaymentBody.tsx`, `held-payment.css`; previews `(dev)/preview/fund`, `(dev)/preview/held`; probe `supabase/tests/probes/b3-payluk-sweep.sql`; `docs/payments/PAYLUK_LIVE_DOCS_FINDINGS.md` | Deleted. Nothing imports them (grep and build) |
| (d) Generic logic kept | `releaseGate` (extracted to `lib/money/release-gate.ts`, used by `protected-rail.ts`); `lib/money/held-view.ts` / `held-model.ts` (agreement page reads); `fund-view.ts` (now only `readAgreementRail`); `status.ts`, `ledger/events.ts`, `funds.ts` (renamed `providerPhone`), `member-wallet*.ts`, `wallet-provision.ts`; cron `arrangements-reconcile` (EscrowPay only) | Kept; provider-neutral names; the one stored value `'payluk'` in wallet tables is the constant `WALLET_PROVIDER_KEY` (legacy-name) |
| (e) Flags / env / switches | `payments_payluk_on` -> `payments_protected_pay_on`; `PAYMENTS_KILL_PAYLUK` -> `PAYMENTS_KILL_PROTECTED_PAY`; `PAYLUK_SECRET_KEY`, `PAYLUK_TEST_SECRET_KEY`, `PAYLUK_COUNTRY_IDS` (-> `PROVIDER_COUNTRY_IDS`, then unused) | One helper, `lib/money/protected-pay-switch.ts`, reads the new key first and falls back to the old key and old env name (fail closed: both missing = off). The two marked `legacy-name` lines are the only code hits. `.env.example` and `docs/ENVIRONMENT.md` updated |
| (f) Types, tests, docs | `database.types.ts` (1 table, 2 functions removed by hand; they are dropped by the SQL), `FiatProviderId` is `"paystack"`, `status.ts` vocabularies, proxy allow-list, `lib/nav/route-parents.ts`, 27 docs | See below |

Pages `/agreements/[id]/fund` and `/held` are kept (the EscrowPay screens
render on them). The old non-protected branch of each is gone; they redirect to
the agreement when there is no protected payment to show.

## Rename / switch behaviour

`escrowRailLive()` is now: EscrowPay settings present AND the protected-pay
switch on. Both are false today, so every surface behaves as before.

## Pending SQL (NOT APPLIED, destructive)

`supabase/migrations/pending/payluk_removal_2026-11-10.sql`, one transaction,
safe to run twice. Order: (0) pre-check raising if `payluk_commission_sweeps`
holds any row; (1) insert `payments_protected_pay_on` copying the old value;
(2) delete the old flag row only after the new exists; (3) drop table
`payluk_commission_sweeps`; (4) drop `private.payluk_sweep_append_only()`;
(5) drop `public.admin_payluk_commission_sweep()`; (6) closing check. It
leaves CHECK-constraint text values and wallet tables (listed in its header).
Probe `b3-payluk-sweep.sql` was deleted with it; other probes only use the
text value `'payluk'` as data in rolled-back rows, which stays valid.

## After the SQL has run and deploy settings change

- Remove the old env var `PAYMENTS_KILL_PAYLUK` and the Payluk keys from Vercel.
- Delete the two `legacy-name` lines in `lib/money/protected-pay-switch.ts`,
  the fallback in `protectedPaySwitchOn`, the `member-wallet.ts` constant
  (once wallet rows are migrated or the wallet is deleted), and update the
  allow-list count in `lib/copy/provider-name.test.ts`.
- Regenerate `database.types.ts`.
