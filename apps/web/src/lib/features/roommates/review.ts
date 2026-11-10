import { REVIEW_MIN_PHOTOS, type ListingKind, type ListingStatus } from "./model";

/**
 * THE ROOM OFFER REVIEW, AS DATA (pure, safe on both sides). One source of
 * truth: `roommate_listings.status`. `live` means approved and shown in the
 * Roommates feed; the states before it keep a post out of every feed.
 *
 *   draft -> submitted -> in_review -> live
 *                      \-> changes_requested -> submitted
 *                      \-> rejected
 *
 * Only a room offer (a person offering a room in a home) is reviewed; a
 * "roommate wanted" or "find together" post describes people and goes live
 * on its own. The database repeats every rule here (the guard trigger and
 * `admin_roommate_review_decide`); this file lets the screens and the desk
 * say the same thing before the round trip.
 */

export const REVIEW_STATES = ["submitted", "in_review", "changes_requested", "rejected"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

/** Does this kind of post go through staff review before it shows in the feed? */
export function needsReview(kind: ListingKind): boolean {
  return kind === "room_offer";
}

/** Is the post in the review pipeline right now (not yet live, not a plain draft)? */
export function inReview(status: ListingStatus): status is ReviewState {
  return (REVIEW_STATES as readonly string[]).includes(status);
}

/** Only an approved post is drawn in the feed, search, home and campus lists. */
export function showsInFeed(status: ListingStatus): boolean {
  return status === "live";
}

export type TimelineStep = { key: "sent" | "review" | "decision"; state: "done" | "now" | "todo" | "stopped" };

/** The owner's three-step timeline: Submitted, In review, then the decision. */
export function reviewTimeline(status: ListingStatus): TimelineStep[] {
  const at = (sent: TimelineStep["state"], review: TimelineStep["state"], decision: TimelineStep["state"]): TimelineStep[] => [
    { key: "sent", state: sent },
    { key: "review", state: review },
    { key: "decision", state: decision },
  ];
  switch (status) {
    case "submitted":
      return at("done", "now", "todo");
    case "in_review":
      return at("done", "now", "todo");
    case "changes_requested":
      return at("done", "done", "stopped");
    case "rejected":
      return at("done", "done", "stopped");
    case "live":
    case "paused":
    case "filled":
    case "expired":
      return at("done", "done", "done");
    default:
      return at("now", "todo", "todo");
  }
}

export type OwnerMove = "submit" | "withdraw" | "edit" | "pause" | "resume" | "filled";

/** What the owner may do from a state, in the order the screen offers it. */
export function ownerMoves(status: ListingStatus, kind: ListingKind, approved: boolean): OwnerMove[] {
  const review = needsReview(kind);
  switch (status) {
    case "draft":
      return ["edit", "submit"];
    case "submitted":
    case "in_review":
      return review ? ["withdraw"] : [];
    case "changes_requested":
      return ["edit", "submit", "withdraw"];
    case "live":
      return ["edit", "pause", "filled"];
    case "paused":
    case "expired":
      return approved || !review ? ["edit", "resume"] : ["edit", "submit"];
    case "filled":
      return approved || !review ? ["resume"] : ["submit"];
    default:
      return [];
  }
}

export type ReviewDecision = "claim" | "approve" | "changes" | "reject";

export type ReviewSubject = {
  status: ListingStatus;
  authority: string | null;
  declared: boolean;
  rentMinor: number | null;
  photoCount: number;
};

/** The sentence that stops a decision, or null when it may go ahead. */
export function decisionProblem(decision: ReviewDecision, note: string, s: ReviewSubject): string | null {
  const waiting = s.status === "submitted" || s.status === "in_review";
  if (decision === "claim") return s.status === "submitted" ? null : "This post is not waiting to be picked up.";
  if (decision === "approve") {
    if (!waiting) return "This post is not waiting for review.";
    if (!s.authority || !s.declared) return "The owner has not declared the right to offer this home.";
    if (s.rentMinor === null) return "The post has no rent.";
    if (s.photoCount < REVIEW_MIN_PHOTOS) return "A room offer needs at least three photos.";
    return null;
  }
  if (note.trim().length < 5) return decision === "changes" ? "Tell the owner what to fix, at least five characters." : "Say why it is not approved, at least five characters.";
  if (decision === "changes" && !waiting) return "This post is not waiting for review.";
  if (decision === "reject" && !waiting && s.status !== "changes_requested") return "This post is not in review.";
  return null;
}

/** Where a decision leaves the post (the database returns the same word). */
export function statusAfter(decision: ReviewDecision): ListingStatus {
  return decision === "claim" ? "in_review" : decision === "approve" ? "live" : decision === "changes" ? "changes_requested" : "rejected";
}
