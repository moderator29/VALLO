# LEGAL PAGES: PRESENTATION CHANGES, FACT FIXES, COUNSEL LIST

November 2026. Presentation only. No obligation, liability, governing law or
dispute term was changed. The legal text in `lib/legal/terms.tsx` and
`privacy.tsx` is untouched except the two fixes below.

## What was built

- `components/legal/LegalPreface.tsx` and `app/css/legal-preface.css`:
  `LegalShortVersion` (summary card, six icon bullets, version and last updated
  read from `lib/legal/versions.ts` and the documents' own updated constants),
  `LegalContents` (collapsible, native `<details>`, sticky on wide screens,
  hidden in print), `LegalGlance` (wrapper that says the sections below govern).
  Tokens only, light and dark from the same rules.
- `lib/legal/glance.tsx`: the summaries. Uses the existing `DocTable` (stacks
  to cards at phone width, no sideways scroll) and `DocFlow` (accessible
  ordered list with `UiIcon` plates). No new flow component was needed.
- Wired into `app/(site)/terms`, `app/(site)/privacy`, `app/(site)/cancellations`
  (the public refund policy) and the in-app `app/(app)/legal/terms` and
  `privacy` (through a new optional `preface` prop on `LegalDocument`, which
  already has its own contents list).

| Page | Short version | Tables | Flows |
|---|---|---|---|
| Terms | 6 bullets | Who does what (roles); What costs what (fees) | If something goes wrong (report, record, person decides, appeal) |
| Privacy | 6 bullets | What we collect / why / who sees it / how long we keep it (8 rows) | Deleting your account with the 30 day restore window (5 steps) |
| Refund policy (/cancellations) | 6 bullets | Refunds by situation: what happens / who decides / how long (6 rows) | Asking for a refund (4 steps) |

Every figure is read from code: `FULL_REFUND_HOURS` (72) in
`lib/trust/cancellation.ts`, `GRACE_WINDOW_DAYS` (30) in
`lib/account-deletion/constants.ts`, `REFUND_ROUTE`, `NO_RENTER_FEES_LINE`,
`NO_INSPECTION_FEE`, `PROCESSOR_FEE_LABEL`, `GOVERNING_SENTENCE` in
`lib/money/copy.ts`, `RESPONSE_COMMITMENTS.standard` in `lib/trust/standards.ts`.
No fee percentage is printed: the Terms do not state one, and the rate is
shown in naira to the lister before they agree. Retention figures (90 days,
five years) restate privacy sections 2 and 7.

## Fact fixes (old to new, with reference)

| Where | Old | New | Reference |
|---|---|---|---|
| Privacy, section 5, Payluk | "where the Vallo wallet is offered, the payment provider that holds and moves that money" (contradicted "Vallo has no wallet" in Terms 4 and Privacy 2) | Payluk is the provider behind the protected payment rail, which is built but switched off, so nothing is sent to it today; Vallo has no wallet; if switched on it would receive name, email, phone | `lib/money/rail-live.ts` (`protectedRailLive`, fails closed), `lib/money/copy.ts` header ("built and switched off"), `lib/payouts/payluk-merchant.ts` |
| Privacy, section 7, deletion | Did not say a reason is asked | New paragraph: we ask why from a short list, you can skip, nothing typed is kept, only the code goes in the audit log | `DELETION_REASONS` in `lib/account-deletion/constants.ts`; `detail.reason` in `lib/account-deletion/actions.ts:214` |

Checked and found current (no change): Guarantee retired 9 November 2026
(Terms 14, Privacy 2 and 7, Disclaimer 5); no custody (`NO_CUSTODY_SENTENCE`
printed by reference); 72 hour and half schedule; 30 day window; card-only
payment.

## For counsel to review (NOT in the legal text)

1. Payluk: the coordinator brief says it is removed, but `lib/payouts/payluk-merchant.ts`,
   `app/api/payluk/webhook` and `lib/payments/providers` still exist and
   `privacy-truth.test.ts` requires the notice to name any processor whose host
   is in the code. If Payluk is really removed from code, delete its line in
   Privacy section 5 and its entry in that test together.
2. Privacy version: the deletion-reason paragraph is a clarification. Decide
   whether it warrants a new `PRIVACY_VERSION` (which re-prompts acceptance);
   it was not bumped.
3. Privacy: no retention period is stated for hosting and database logs or
   crash reports (section 2, Technical data). The table omits that row for this
   reason.
4. Privacy: NDPC (the data protection regulator) is not named as the body to
   complain to, and no complaints route beyond support/contact form is given.
5. Privacy: no named Data Protection Officer or contact for NDPA requests
   beyond the contact form.
6. Privacy: cookie and storage notice is in section 9 only in outline; confirm
   it lists the session cookie and the local storage the app uses.
7. Under-18s: section 10 says adults only; confirm what happens to an account
   found to belong to a minor.
8. Terms: the platform fee rate is not stated in the Terms (only that it is
   shown before the lister agrees). Confirm that is intended.
9. Terms section 4 says payment held by a licensed bank "is not open yet";
   confirm the wording when the protected rail is ever switched on.
10. Refund policy: the support decision time (five Nigerian business days) is
    in `CANCELLATION_STOPS` but not in the Terms section 5; the bank time
    (5 to 10 working days) is `REFUND_ROUTE`. Confirm both are commitments.
11. The in-app Privacy intro says Vallo "protects your personal data"; it
    passes the claims gate but counsel may prefer a named mechanism.

## Not done

EULA (`lib/legal/eula.tsx`), Disclaimer, Host Agreement and AI terms were not
given the preface. Cookies and Safety pages were not found as separate legal
routes. A browser visual check at 360px was not run in this pass.

## 10 November 2026: Payluk removal (founder instruction; for counsel)

The founder said: "Remove Payluk. What is this Payluk naming? We are not using
them in our platform no more." This is a legal-text change he instructed.
`PRIVACY_VERSION` was NOT bumped (still `2026-11-09`); counsel decides whether
removing a named processor warrants a new version and a re-prompt. A
comment-only note was added in `lib/legal/versions.ts`.

| Where | Old | New |
|---|---|---|
| Privacy, section 5 (service providers) | "Payluk (Nigeria): the provider behind the protected payment rail, which is built but switched off, so nothing is sent to it today. Vallo has no wallet. If the rail is ever switched on, Payluk (Nigeria) would receive your name, email address and phone number for that payment." | (bullet removed) |
| `privacy-truth.test.ts`, processor table | `[/api\.payluk\.ng/, "Payluk"]` required the notice to name Payluk while its host was in the code | row removed; the host is no longer in the code, and a new test (`lib/copy/provider-name.test.ts`) fails if the name returns anywhere in the source |

Decisions flagged for counsel:
1. The replacement protected-pay provider (EscrowPay) is switched off, sends
   nothing and is NOT named in the notice, as for any switched-off processor.
   When it is switched on, it must be added to section 5 in the same change
   (name, country, what it receives: name, email, phone, payment reference),
   and the processor table in `privacy-truth.test.ts` gets its host row.
2. The deleted bullet also carried the sentence "Vallo has no wallet." That
   statement is still made in Terms sections 4 and 5 and Privacy section 2,
   which were not touched.
3. Whether to bump `PRIVACY_VERSION` (re-prompts acceptance for every member).
4. The older entries in this file that name the provider are the historical
   record of earlier changes and were left as written.

