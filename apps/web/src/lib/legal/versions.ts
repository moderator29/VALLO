/**
 * WHICH VERSION OF THE LEGAL DOCUMENTS A PERSON IS BEING SHOWN.
 *
 * ONE PLACE, AND THIS IS IT. `public.terms_acceptances` records the version
 * string a person accepted, and that record is only worth keeping if the
 * string means something, so every surface that asks somebody to accept and
 * every write that records that they did reads it from here.
 *
 * THE CONSTANT USED TO LIVE IN A COMPONENT. `components/auth/AcceptTerms.tsx`
 * declared `TERMS_VERSION` beside the tick box and its own comment said the
 * value would be written to `profiles.terms_version`. It moved here on 22
 * September 2026 when the acceptance was given a table of its own, and the
 * component now re-exports it, because a version string that two files can
 * each declare is a version string that will eventually disagree with itself.
 *
 * BUMP THE DATE WHEN THE DOCUMENT CHANGES IN A WAY THAT MATTERS. Fixing a typo
 * is not a new version; changing what a person is agreeing to is. The moment
 * one of these moves, the next acceptance from each person writes a NEW row
 * and the old row stays, which is what an auditor asks to see and what makes
 * the sentence in the terms about continued use after a change mean something
 * rather than being a hope.
 */

/**
 * The date the Terms, the Privacy policy and the Community Rules last changed
 * together. A date rather than a number so a stored row says which text was on
 * screen without anybody keeping a separate table of what version meant what.
 */
/* 2026-10-13: Terms section 6 states the fee position in the product's own words (free to list, nothing added for
   renters and guests, the platform fee comes out of the lister's share only on a completed deal, a fixed fee per
   seated restaurant table) and the Host Agreement applies to hosts. */
/* 2026-11-03: section 7 says what verifying involves, who reviews it, the
   photo holding the ID a reviewer may ask for, and what false documents lead to. */
/* 2026-11-09 (founder): the Vallo Guarantee is retired. Section 14 is now
   "What Vallo does, and what it does not do"; section 4 names Paystack as the
   processor and drops the Guarantee reserve; section 7 no longer points at
   Guarantee claims. Existing members are shown the change once
   (`lib/legal/terms-update.ts`). */
export const TERMS_VERSION = "2026-11-09";

/**
 * The privacy notice moves with them today and has its own constant anyway,
 * because it is the one most likely to change on its own: a new processor or a
 * new retention period is a privacy change and not a terms change.
 */
/* 2026-09-24 (STORE-08 / SEC-13 / STORE-07): processors named, location,
   push tokens, device records, AI and crash data described, the analytics
   claim removed, the deletion section brought to the purge that now runs. */
/* 2026-09-25 (Track A/B): no wallet or balance is held; payment data now
   describes split settlement, agreements and Guarantee claims. */
/* 2026-11-03: verification described as it now runs (ID, selfie, proof of
   address, the reviewer-recorded name, the bank name check, a photo holding
   the ID on request, decided by a person); the selfie's explicit consent; the
   phone-code senders (Termii, Twilio) and the wallet provider named;
   who can open verification documents and how. */
/* 2026-11-09: the Guarantee reserve leg is gone from the payment data and the
   processor list; Guarantee claims are described as made before it retired. */
/* 2026-11-10 (NOT a version bump, flagged for counsel): the retired protected-payment
   provider is no longer named in the processor list; the switched-off
   replacement sends nothing and is not named. See
   docs/handoff/LEGAL_PAGES_CHANGES.md. */
export const PRIVACY_VERSION = "2026-11-09";

/**
 * The Host Agreement (`lib/legal/host-agreement.tsx`, page /host-agreement),
 * agreed with the Terms and the Privacy policy before a host's business is
 * created, and recorded with this version on the business
 * (`consents.agreements`).
 *
 * 2026-10-17: section 4 said a restaurant pays "a fee for each guest seated",
 * at an amount "shown in your host settings". The fee is per seated TABLE
 * (`20261013071048_restaurant_fee_per_seated_table.sql`, `restaurant_seated_fees`)
 * and no host screen shows it; the amount is published at /docs/what-vallo-costs.
 * The basis of a fee is what a host agrees to, so this is a new version and a
 * host ticks the agreement again before their next application is sent.
 */
export const HOST_AGREEMENT_VERSION = "2026-10-17";

/**
 * The founder's statement of 13 October 2026, ticked before any workspace
 * application or setup is sent: "Every payment for a deal I make on Vallo
 * happens inside Vallo." Recorded with this version beside the Terms and the
 * Privacy policy (`lib/legal/workspace-acceptance.ts`).
 */
export const PAY_ON_VALLO_VERSION = "2026-10-13";

/** The two documents a person accepts when they open an account. */
export const ACCEPTED_AT_SIGNUP = [
  { document: "terms" as const, version: TERMS_VERSION },
  { document: "privacy" as const, version: PRIVACY_VERSION },
];

export type LegalDocument = (typeof ACCEPTED_AT_SIGNUP)[number]["document"];

/**
 * THE DATE EACH DOCUMENT SHOWS AS "LAST UPDATED", read from its version, so a
 * page can never again show a date older than the text under it (found 9
 * November 2026: Terms and Privacy both said 25 September after two changes).
 * The Disclaimer forms part of the Terms and moves with them.
 */
export const TERMS_UPDATED_ISO = TERMS_VERSION;
export const PRIVACY_UPDATED_ISO = PRIVACY_VERSION;
export const DISCLAIMER_UPDATED_ISO = TERMS_VERSION;

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
/** "9 November 2026" from "2026-11-09". */
export function longDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : LONG_DATE.format(d);
}
