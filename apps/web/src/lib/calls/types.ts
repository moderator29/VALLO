/**
 * VALLO CALLS: THE SHAPES EVERY LAYER SPEAKS. Client-safe, no imports.
 *
 * The database is the source of truth (`supabase/migrations/pending/vc1_video_calls.sql`);
 * these types are what the server actions hand the screens. Field names are
 * camelCase here and snake_case in the database; `snapshotFromRow` in
 * `lifecycle.ts` is the one place that maps them.
 *
 * Nothing in here can carry a provider token: `JoinCredentials` is returned
 * by one server action to the person joining, held in memory by the call
 * screen, and never written to a URL, a message, a notification or storage.
 */

export const CALL_STATES = [
  "CREATED",
  "INVITATION_PENDING",
  "RINGING",
  "ACCEPTED",
  "CONNECTING",
  "ACTIVE",
  "ENDED",
  "DECLINED",
  "CANCELLED",
  "MISSED",
  "BUSY",
  "FAILED",
  "EXPIRED",
  "INTERRUPTED",
] as const;
export type CallState = (typeof CALL_STATES)[number];

export type CallKind = "AUDIO" | "VIDEO";
export type CallPurpose = "CONVERSATION" | "ADMIN_REVIEW";
export type CallRole = "CALLER" | "CALLEE" | "REVIEWER" | "SUBJECT";
export type ParticipantState =
  | "INVITED"
  | "RINGING"
  | "ACCEPTED"
  | "DECLINED"
  | "JOINED"
  | "LEFT"
  | "MISSED"
  | "REMOVED";

/** One call, as the person looking at it may see it. */
export type CallSnapshot = {
  id: string;
  kind: CallKind;
  purpose: CallPurpose;
  state: CallState;
  /** Bumped on every transition: a screen ignores an update older than what it shows. */
  version: number;
  conversationId: string | null;
  reviewId: string | null;
  role: CallRole | null;
  myState: ParticipantState | null;
  isInitiator: boolean;
  /** The other person's display name, or "Vallo review team" for a review subject. */
  otherName: string | null;
  otherState: ParticipantState | null;
  /** The other person's profile photo (a public URL), when they have one. */
  otherAvatarUrl?: string | null;
  /**
   * True once the other person's own app has the ring on screen
   * (`call_ring_delivered`). Until then the caller reads "Calling", not "Ringing".
   */
  otherRinging?: boolean;
  scheduledFor: string | null;
  createdAt: string;
  ringingAt: string | null;
  ringExpiresAt: string | null;
  acceptedAt: string | null;
  connectedAt: string | null;
  interruptedAt: string | null;
  endedAt: string | null;
  /** A machine token (`hangup`, `no_answer`, `connection_lost`, ...). Words come from `endReasonWords`. */
  endReason: string | null;
  /** Server-measured talk time, from both media connections up to the end. */
  durationSeconds: number | null;
  /** The server's clock when this was read, so a countdown never trusts the device clock. */
  serverNow: string;
  /** Set when `startCall` found the other person already ringing you in this thread. */
  glare?: boolean;
  /** Set when a replayed tap returned the call it had already started. */
  replayed?: boolean;
  /** Set by the heartbeat when the server should read the provider's presence list. */
  presenceCheckDue?: boolean;
};

/** What the call screen needs to connect. Short lived, one room, one identity. */
export type JoinCredentials = {
  callId: string;
  /** The provider's websocket URL, e.g. `wss://vallo.livekit.cloud`. Not a secret. */
  serverUrl: string;
  /** A signed provider token. Memory only. */
  token: string;
  /** ISO time the token stops being accepted for a NEW connection. */
  expiresAt: string;
  kind: CallKind;
  role: CallRole;
  /** False on a voice call: the token cannot publish a camera at all. */
  canPublishVideo: boolean;
};

export const REVIEW_CASE_KINDS = [
  "agent_application",
  "business_verification",
  "identity_verification",
  "listing",
  "support_ticket",
] as const;
export type ReviewCaseKind = (typeof REVIEW_CASE_KINDS)[number];

export type ReviewScope = "kyc_review" | "listing_approval" | "support";

export const REVIEW_STATUSES = [
  "REQUESTED",
  "SCHEDULED",
  "RESCHEDULE_REQUESTED",
  "ACCEPTED",
  "DECLINED",
  "IN_CALL",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_OUTCOMES = [
  "REVIEW_COMPLETED",
  "MORE_INFORMATION_REQUIRED",
  "FOLLOW_UP_REQUIRED",
  "ESCALATED",
  "NO_SHOW",
  "CANCELLED",
] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];
/** The outcomes `completeReviewCall` takes. CANCELLED is `cancelReviewCall`'s alone. */
export type ReviewCompletionOutcome = Exclude<ReviewOutcome, "CANCELLED">;

export type ReviewEntryKind = "NOTE" | "EVIDENCE" | "CORRECTION";

/** What the person being reviewed sees. Never notes, evidence, scope or the staff member. */
export type SubjectReview = {
  id: string;
  kind: CallKind;
  caseKind: ReviewCaseKind;
  caseWords: string;
  purpose: string;
  status: ReviewStatus;
  scheduledFor: string | null;
  proposedFor: string | null;
  respondBy: string;
  createdAt: string;
  requesterLabel: string;
  liveCallId: string | null;
};

/** The staff row, as `call_reviews` holds it (read under the reviewer's scope). */
export type StaffReview = {
  id: string;
  caseKind: ReviewCaseKind;
  caseId: string;
  subjectId: string | null;
  requestedBy: string | null;
  requiredScope: ReviewScope;
  purpose: string;
  kind: CallKind;
  status: ReviewStatus;
  scheduledFor: string | null;
  proposedFor: string | null;
  respondBy: string;
  outcome: ReviewOutcome | null;
  outcomeAt: string | null;
  followUpDueAt: string | null;
  createdAt: string;
};
