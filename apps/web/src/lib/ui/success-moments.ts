import type { Dictionary } from "@vallo/i18n/core";
import type { FeedbackKind } from "@/lib/ui/feedback";
import type { Icon3DName } from "@/components/ui/icon-3d";

/**
 * EVERY "IT WORKED" MOMENT, BY NAME (docs/SUCCESS_MOMENTS.md).
 *
 * One registry so a moment's variant, its feel in the hand and its words are
 * decided once, and a call site only says WHICH moment happened. The words
 * live in `packages/i18n/src/locales/en.ts` under `success.moments`; this file
 * pairs each one with how it looks:
 *
 *   success     it happened and it is done: paid, booked, confirmed
 *   submitted   it was accepted and a person decides next: "in review"
 *   approved    somebody else decided in your favour: listing live, documents
 *               approved, agreement approved
 *
 * A pending or unknown payment is NOT a moment here and cannot be named: it
 * keeps `ResultSheet`'s pending state ("Confirming your payment").
 */

export type SuccessVariant = "success" | "submitted" | "approved";

export type SuccessMomentId = keyof Dictionary["success"]["moments"];

/**
 * The whole `success` namespace, as a server page hands it to a client
 * component (`t.success`). Only a few moments ride in `ClientCopy` on every
 * screen; the rest come down this way, which is the house pattern.
 */
export type SuccessWords = Dictionary["success"];

export const SUCCESS_VARIANT: Readonly<Record<SuccessMomentId, SuccessVariant>> = {
  stayPaid: "success",
  stayPaidRecorded: "success",
  rentPaid: "success",
  sharePaid: "success",
  moveInPaid: "success",
  cryptoPaid: "success",
  inspectionRequested: "submitted",
  inspectionBooked: "success",
  inspectionReportSubmitted: "success",
  inspectionRecorded: "success",
  agreementDrawn: "success",
  agreementConfirmed: "success",
  agreementInReview: "submitted",
  agreementApprovedRenter: "approved",
  agreementApprovedOwner: "approved",
  claimFiled: "submitted",
  refundRequested: "submitted",
  listingSubmitted: "submitted",
  listingApproved: "approved",
  listingLive: "approved",
  agentApplied: "submitted",
  hostApplied: "submitted",
  registrationFiled: "submitted",
  kycSubmitted: "submitted",
  identityMatched: "approved",
  verificationApproved: "approved",
  agentApproved: "approved",
  hostApproved: "approved",
  hostLive: "approved",
  ticketFiled: "submitted",
  contactSent: "submitted",
  reportFiled: "submitted",
  stayRequested: "submitted",
  stayHeld: "success",
  tableRequested: "submitted",
  reviewPosted: "success",
  tenancyReviewSent: "success",
  bankAccountAdded: "success",
  cardSaved: "success",
  payoutAccountAdded: "success",
  accountCreated: "success",
  signedIn: "success",
  signedOut: "success",
  photoAdded: "success",
  checkEmail: "success",
  emailVerified: "success",
  passwordChanged: "success",
  passcodeSet: "success",
  passcodeChanged: "success",
  flatmateInvited: "submitted",
  agentsInvited: "submitted",
};

/**
 * THE OBJECT AT THE CENTRE OF EACH MOMENT (founder reference 54, 30
 * September): one of the founder's 3D objects (components/ui/icon-3d.ts),
 * chosen for what the moment is ABOUT rather than how it feels. The picture
 * never claims more than the words: a submission shows the clock, the
 * calendar with a clock or the folder (it waits on a person), never an
 * object with a tick on it; the seal is kept for a decision somebody else
 * made in your favour.
 *
 * Only names whose files exist may appear here (icon-3d.test.ts checks the
 * files, and the type checks the name).
 */
export const SUCCESS_OBJECT: Readonly<Record<SuccessMomentId, Icon3DName>> = {
  stayPaid: "calendar-booked",
  stayPaidRecorded: "receipt",
  rentPaid: "keys",
  sharePaid: "earnings",
  moveInPaid: "keys",
  cryptoPaid: "coin",
  inspectionRequested: "calendar-pending",
  inspectionBooked: "calendar-booked",
  inspectionReportSubmitted: "checklist",
  inspectionRecorded: "checklist",
  agreementDrawn: "contract",
  agreementConfirmed: "contract",
  agreementInReview: "clock",
  agreementApprovedRenter: "handover",
  agreementApprovedOwner: "handover",
  claimFiled: "folder",
  refundRequested: "receipt",
  listingSubmitted: "list",
  listingApproved: "home-verified",
  listingLive: "home-verified",
  agentApplied: "folder",
  hostApplied: "folder",
  registrationFiled: "folder",
  kycSubmitted: "folder",
  identityMatched: "verified",
  verificationApproved: "verified",
  agentApproved: "verified",
  hostApproved: "verified",
  hostLive: "hotel",
  ticketFiled: "support",
  contactSent: "envelope",
  reportFiled: "report-flag",
  stayRequested: "calendar-pending",
  stayHeld: "calendar-booked",
  tableRequested: "restaurant",
  reviewPosted: "stay-rated",
  tenancyReviewSent: "stay-rated",
  bankAccountAdded: "bank",
  cardSaved: "card-secure",
  payoutAccountAdded: "earnings",
  accountCreated: "celebrate",
  signedIn: "celebrate",
  signedOut: "celebrate",
  photoAdded: "celebrate",
  checkEmail: "envelope",
  emailVerified: "envelope",
  passwordChanged: "shield",
  passcodeSet: "passcode-lock",
  passcodeChanged: "passcode-lock",
  flatmateInvited: "team",
  agentsInvited: "megaphone",
};

/** The object when a caller names no moment: by what kind of news it is. */
export const VARIANT_OBJECT: Readonly<Record<SuccessVariant, Icon3DName>> = {
  success: "verified",
  submitted: "clock",
  approved: "verified",
};

/**
 * What each variant says through the hand (lib/ui/feedback.ts). A submission
 * is an ACCEPTED action ("confirm"), not news that something is finished, so
 * it does not borrow the success pattern a settled payment uses.
 */
export const SUCCESS_FEEL: Readonly<Record<SuccessVariant, FeedbackKind>> = {
  success: "success",
  submitted: "confirm",
  approved: "success",
};

/**
 * THE PAYOFFS: THE ONLY MOMENTS THAT FEEL HEAVY (CRAFT_DOCTRINE 6).
 *
 * "Heavy, rare: a payoff: payment confirmed, escrow released, verification
 * passed, badge earned." The variant decides what a moment LOOKS like (the
 * seal lands on success and approved alike); this list decides what it FEELS
 * like, and the two are not the same question. A saved card, a changed
 * password, a posted review or dates held are done and deserve the seal, but
 * they are housekeeping or a step on the way, and a heavy beat on each of
 * them is the product that buzzes at everything. They feel as the commit
 * they are: `confirm`, the medium beat.
 *
 * What is here: money that settled (every *Paid), a viewing that is booked,
 * the decisions somebody else made in the member's favour (approved, live,
 * matched), and the two arrivals (the account, the confirmed email).
 * `haptic-census.test.ts` holds every moment to this list.
 */
export const PAYOFF_MOMENTS: ReadonlySet<SuccessMomentId> = new Set<SuccessMomentId>([
  "stayPaid",
  "stayPaidRecorded",
  "rentPaid",
  "sharePaid",
  "moveInPaid",
  "cryptoPaid",
  "inspectionBooked",
  "agreementApprovedRenter",
  "agreementApprovedOwner",
  "listingApproved",
  "listingLive",
  "identityMatched",
  "verificationApproved",
  "agentApproved",
  "hostApproved",
  "hostLive",
  "accountCreated",
  "emailVerified",
]);

/** What one moment says through the hand: heavy for a payoff, medium for everything else. */
export function momentFeel(id: SuccessMomentId): FeedbackKind {
  return PAYOFF_MOMENTS.has(id) ? "success" : "confirm";
}

/** `haptic` is the moment's own feel (`momentFeel`): pass it to the sheet. */
export type SuccessCopy = { variant: SuccessVariant; object: Icon3DName; title: string; body: string; haptic: FeedbackKind };

type MomentWords = { title: string; body: string };

/**
 * The words and the variant for one moment, with `{placeholders}` filled.
 *
 * Takes any slice of `success.moments`: the whole dictionary a page hands
 * down, or the few moments `ClientCopy` carries on every screen
 * (lib/i18n/client-copy-of.ts). Asking a slice for a moment it does not
 * carry is a type error, not an empty sheet.
 */
export function successCopy<M extends Partial<Record<SuccessMomentId, MomentWords>>>(
  copy: { moments: M },
  id: keyof M & SuccessMomentId,
  values: Record<string, string> = {},
): SuccessCopy {
  const words = copy.moments[id] as MomentWords;
  const fill = (text: string) =>
    Object.entries(values).reduce((out, [key, value]) => out.split(`{${key}}`).join(value), text);
  return {
    variant: SUCCESS_VARIANT[id],
    object: SUCCESS_OBJECT[id],
    title: fill(words.title),
    body: fill(words.body),
    haptic: momentFeel(id),
  };
}

/* ------------------------------------------------------ the one-shot flag */

/**
 * `?done=<flag>`: a redirect's way of saying "show the success on arrival".
 *
 * The flag only ASKS. The page it lands on checks what the server says (the
 * agreement exists and is yours, the listing really is live) before a sheet
 * opens, and strips the flag with `router.replace` as it opens, so a refresh
 * or a shared link never replays it.
 */
export const DONE_PARAM = "done";

/** Flags a page may be sent with. Kebab case, because they are in a URL. */
export const DONE_FLAGS = {
  "agreement-drawn": "agreementDrawn",
  /* The page picks "confirmed" or "in review" from the agreement's status. */
  "agreement-confirmed": "agreementConfirmed",
  "claim-filed": "claimFiled",
  "listing-submitted": "listingSubmitted",
  "listing-approved": "listingApproved",
  "listing-live": "listingLive",
  /* The owner invited agents to pitch; the portfolio checks the invitation
     is open on that unit of theirs (`listing`). */
  "agents-invited": "agentsInvited",
  "account-created": "accountCreated",
  /* Grade 1 (November 2026): a returning sign-in earns the top banner. */
  "signed-in": "signedIn",
  "signed-out": "signedOut",
  "photo-added": "photoAdded",
  "check-email": "checkEmail",
  "email-verified": "emailVerified",
  "password-changed": "passwordChanged",
  "passcode-set": "passcodeSet",
  "passcode-changed": "passcodeChanged",
} as const satisfies Record<string, SuccessMomentId>;

export type DoneFlag = keyof typeof DONE_FLAGS;

/**
 * The moments that belong to the ACCOUNT rather than to a record on a page,
 * so the root layout's host may show them wherever they land: a sign-up can
 * finish on /home or on the listing somebody started from. Everything else
 * is shown by the page that can check it.
 *
 * THESE NEVER RIDE IN THE ADDRESS. The host has no record to check them
 * against, so a `?done=` link would let anybody say "Password changed" to
 * anybody. They arrive by `rememberSuccess()` (a one-shot cookie a server
 * action sets after it succeeded, lib/ui/success-cookie.ts) or by
 * `showSuccess()` from the client screen that just succeeded.
 */
export const GLOBAL_DONE_FLAGS = [
  "account-created",
  "signed-in",
  "signed-out",
  "photo-added",
  "check-email",
  "email-verified",
  "password-changed",
  "passcode-set",
  "passcode-changed",
] as const satisfies readonly DoneFlag[];

export type GlobalDoneFlag = (typeof GLOBAL_DONE_FLAGS)[number];

/** A flag a page can check against its record: the only kind a URL may carry. */
export type RecordDoneFlag = Exclude<DoneFlag, GlobalDoneFlag>;

export function isGlobalDoneFlag(value: unknown): value is GlobalDoneFlag {
  return typeof value === "string" && (GLOBAL_DONE_FLAGS as readonly string[]).includes(value);
}

/** The one-shot HttpOnly cookie an account moment rides on (lib/ui/success-cookie.ts). */
export const SUCCESS_COOKIE = "nf_done";
/** Its readable companion: "there is something to ask for", and nothing else. */
export const SUCCESS_HINT_COOKIE = "nf_done_hint";

export function isDoneFlag(value: unknown): value is DoneFlag {
  return typeof value === "string" && Object.hasOwn(DONE_FLAGS, value);
}

/**
 * `href` with `?done=<flag>` added, keeping its query and hash.
 *
 * AN ACCOUNT FLAG IS NEVER WRITTEN. It would be a forgeable link (see
 * `GLOBAL_DONE_FLAGS`); those moments ride on the server's one-shot cookie
 * instead, which the actions set themselves (`rememberSuccess`). So for an
 * account flag this returns `href` untouched, and a caller that still passes
 * one, such as the verify screens, navigates cleanly while the cookie carries
 * the moment.
 */
export function withDone(href: string, flag: DoneFlag, extra: Record<string, string> = {}): string {
  if (isGlobalDoneFlag(flag)) return href;
  const hashAt = href.indexOf("#");
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const base = hashAt === -1 ? href : href.slice(0, hashAt);
  const queryAt = base.indexOf("?");
  const path = queryAt === -1 ? base : base.slice(0, queryAt);
  const params = new URLSearchParams(queryAt === -1 ? "" : base.slice(queryAt + 1));
  params.set(DONE_PARAM, flag);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `${path}?${params.toString()}${hash}`;
}

/**
 * The same address with the flag and its companions removed, for
 * `router.replace` once the sheet is up. `also` names the flag's companions
 * (a listing id, a payment reference) so they go with it.
 */
export function withoutDone(href: string, also: readonly string[] = []): string {
  const url = new URL(href, "http://x.invalid");
  url.searchParams.delete(DONE_PARAM);
  for (const key of also) url.searchParams.delete(key);
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}

/** The flag in a `searchParams` value, or null. */
export function readDone(value: string | string[] | undefined | null): DoneFlag | null {
  const one = Array.isArray(value) ? value[0] : value;
  return isDoneFlag(one) ? one : null;
}

/* ------------------------------------------------ the imperative doorway */

export const SUCCESS_EVENT = "nf:success";

export type SuccessEventDetail = { flag: GlobalDoneFlag };

/**
 * Show an ACCOUNT moment from anywhere on the client, with no navigation:
 * the host in the root layout listens. For the passcode and auth screens,
 * whose owners call this rather than render a sheet of their own. Only the
 * global flags are accepted; a record's moment belongs to its page.
 */
export function showSuccess(flag: GlobalDoneFlag): void {
  if (typeof window === "undefined" || !isGlobalDoneFlag(flag)) return;
  window.dispatchEvent(new CustomEvent<SuccessEventDetail>(SUCCESS_EVENT, { detail: { flag } }));
}
