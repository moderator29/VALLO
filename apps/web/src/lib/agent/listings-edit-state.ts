/**
 * WHAT /agent/list?id= OPENS, decided before the wizard is drawn.
 *
 * The wizard used to open whatever `readDraft` returned. A listing that is live
 * or with review opened as an editable form, every autosave was refused with
 * "return it to a draft first", and Next (which does not move off a step whose
 * save was refused) stayed where it was: a form that looks editable and is
 * not. An id that named nothing opened a BLANK wizard, whose first autosave
 * inserted a brand new listing while the lister believed they were editing
 * the old one. Both now read as what they are.
 *
 * `EDITABLE_STATUSES` is the same set `guard_owner_write` enforces in the
 * database and `listings-actions` enforces in every write.
 */

import type { ListingStatus } from "./listings-model";

export const EDITABLE_STATUSES: readonly ListingStatus[] = ["DRAFT", "MORE_INFO_REQUIRED", "REJECTED"];

export type WizardOpening =
  | { kind: "edit" }
  | { kind: "missing" }
  | { kind: "failed" }
  | { kind: "locked"; status: ListingStatus };

/**
 * `requestedId` is the `?id=` the page was opened with, or undefined. `draft`
 * is what was read for it (or for the open draft when no id was asked for).
 */
export function wizardOpening(
  requestedId: string | undefined,
  draft: { status: ListingStatus } | null | "read-failed",
): WizardOpening {
  if (draft === "read-failed") return { kind: "failed" };
  if (!draft) return requestedId ? { kind: "missing" } : { kind: "edit" };
  if (!EDITABLE_STATUSES.includes(draft.status)) return { kind: "locked", status: draft.status };
  return { kind: "edit" };
}

/** The sentence a locked listing is opened with, by where it stands. */
export function lockedSentence(status: ListingStatus): string {
  switch (status) {
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "This listing is with our review team, so it cannot be changed while they look at it. We will let you know as soon as it is decided.";
    /* Approved is not live: publishing is the review team's next step, and
       this sentence used to tell the lister their listing was in search. */
    case "APPROVED":
      return "This listing passed review but is not live yet. An agent or firm listing needs the owner's mandate approved, and a stay needs its charges at the door declared; the notice we sent says which. To change it first, take it down from My listings: it returns to your drafts and goes back for review when you send it.";
    case "PUBLISHED":
      return "This listing is live. To change it, take it down from My listings: it returns to your drafts, you edit it there and send it back for review.";
    case "SUSPENDED":
      return "This listing has been suspended by our team, so it cannot be edited. Our message about it explains what happens next.";
    default:
      return "This listing cannot be edited from here. Open it from My listings.";
  }
}

export const MISSING_LISTING_SENTENCE =
  "We could not find that listing on your account. It may have been deleted, or the link belongs to another account.";

export const DRAFT_READ_FAILED_SENTENCE =
  "We could not load this listing just now. Nothing has changed. Please try again in a moment.";

/** Whether a reviewer's note is waiting on the lister, and so is shown on top. */
export function reviewerAsked(draft: { status: ListingStatus; reviewNotes: string | null } | null): boolean {
  if (!draft || !draft.reviewNotes || draft.reviewNotes.trim() === "") return false;
  return draft.status === "MORE_INFO_REQUIRED" || draft.status === "REJECTED";
}
