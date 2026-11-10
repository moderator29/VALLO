/**
 * THE PROTECTED PAYMENT JOURNEY, AS THE SCREENS DRAW IT (PROTECTED_PAYMENTS_SPECS
 * spec two; BUILD section 7.2). Pure and client-safe.
 *
 * Every screen is chosen from Vallo's own recorded state
 * (`provider_arrangements.status`, written only from the provider's signed
 * webhook or a read-back), never from anything the browser did. Pressing
 * "I've made the transfer" only asks for a fresh read; it can never move a
 * payment to protected (spec screen 3).
 *
 * Nothing here is drawn on a live page today: the rail is switched off
 * (`payments_escrowpay_on`, fail closed) and no category is approved.
 */
import type { ArrangementStatus } from "./arrangement-states";
import type { ProtectedCategory } from "./protected-categories";
import type { UiIconName } from "@/design-system/icons/UiIcon";

/** The screens of the journey, in the order a payment meets them. */
export const PROTECTED_STAGES = [
  "awaiting_transfer",
  "confirming",
  "expired",
  "protected",
  "release_processing",
  "released",
  "disputed",
  "refund_processing",
  "refunded",
  "requires_review",
  "failed",
] as const;
export type ProtectedStage = (typeof PROTECTED_STAGES)[number];

export type StageInput = {
  status: ArrangementStatus;
  /** The payer pressed "I've made the transfer" (a request to look again, nothing more). */
  transferReported: boolean;
  /** The provider's genuine funding expiry, or null when it gave none. */
  fundingExpiresAt: string | null;
  now: number;
};

/** The screen for a recorded state. */
export function stageFor({ status, transferReported, fundingExpiresAt, now }: StageInput): ProtectedStage {
  switch (status) {
    case "preparing":
    case "unknown":
      return "confirming";
    case "awaiting_payment": {
      const expiry = fundingExpiresAt ? Date.parse(fundingExpiresAt) : Number.NaN;
      if (Number.isFinite(expiry) && expiry <= now) return "expired";
      return transferReported ? "confirming" : "awaiting_transfer";
    }
    case "payment_processing":
      return "confirming";
    case "protected":
      return "protected";
    case "release_requested":
      return "release_processing";
    case "released":
      return "released";
    case "disputed":
      return "disputed";
    case "refund_requested":
      return "refund_processing";
    case "refunded":
      return "refunded";
    case "requires_review":
      return "requires_review";
    case "cancelled":
      return "expired";
    case "failed":
    case "split":
      return "failed";
  }
}

/**
 * Each state's identity: a written label and an icon, so no financial state
 * is ever told by colour alone (spec, "Every state has its own identity").
 * `tone` only picks the tint behind the label.
 */
export type StageTone = "waiting" | "held" | "done" | "attention" | "problem";

export const STAGE_IDENTITY: Readonly<Record<ProtectedStage, { tone: StageTone; icon: UiIconName }>> = {
  awaiting_transfer: { tone: "waiting", icon: "hourglass" },
  confirming: { tone: "waiting", icon: "clock" },
  expired: { tone: "attention", icon: "alert-triangle" },
  protected: { tone: "held", icon: "shield-check" },
  release_processing: { tone: "waiting", icon: "hand-coins" },
  released: { tone: "done", icon: "circle-check" },
  disputed: { tone: "attention", icon: "scale" },
  refund_processing: { tone: "waiting", icon: "repost-loop" },
  refunded: { tone: "done", icon: "receipt" },
  requires_review: { tone: "attention", icon: "user-check" },
  failed: { tone: "problem", icon: "circle-x" },
};

/* ---------------------------------------------------------------- timeline */

export type TimelineStepKey = "transfer" | "held" | "milestone" | "release";
export type TimelineStepState = "done" | "now" | "next" | "stopped";
export type TimelineStep = { key: TimelineStepKey; state: TimelineStepState; at: string | null };

export type JourneyStamps = {
  fundedAt: string | null;
  releaseRequestedAt: string | null;
  releaseConfirmedAt: string | null;
  refundConfirmedAt: string | null;
};

/**
 * The four-step spine every screen shows (spec screen 11, the persistent
 * timeline): the transfer, the money held, the milestone, the release. A
 * refund or a dispute stops the spine where it stood rather than pretending
 * it went on.
 */
export function journeyTimeline(stage: ProtectedStage, stamps: JourneyStamps): TimelineStep[] {
  const order: TimelineStepKey[] = ["transfer", "held", "milestone", "release"];
  const reached: Record<ProtectedStage, number> = {
    awaiting_transfer: 0,
    confirming: 0,
    expired: 0,
    failed: 0,
    protected: 2,
    disputed: 2,
    requires_review: 2,
    refund_processing: 2,
    refunded: 2,
    release_processing: 3,
    released: 4,
  };
  const stopped = stage === "expired" || stage === "failed" || stage === "refunded" || stage === "refund_processing" || stage === "disputed";
  const at: Record<TimelineStepKey, string | null> = {
    transfer: stamps.fundedAt,
    held: stamps.fundedAt,
    milestone: stamps.releaseRequestedAt,
    release: stamps.releaseConfirmedAt,
  };
  const n = reached[stage];
  return order.map((key, i) => ({
    key,
    at: i < n ? at[key] : null,
    state: i < n ? "done" : i === n ? (stopped ? "stopped" : "now") : "next",
  }));
}

/* --------------------------------------------------------------- countdown */

export type Countdown = { label: string; remainingSeconds: number; fraction: number };

/**
 * The transfer window, ONLY from a genuine provider expiry (spec screen 3).
 * Null when the provider gave none or the window has passed: no invented
 * clock is ever drawn. `fraction` drains from 1 to 0 across `windowSeconds`.
 */
export function transferCountdown(expiresAt: string | null, now: number, windowSeconds = 30 * 60): Countdown | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end)) return null;
  const remaining = Math.floor((end - now) / 1000);
  if (remaining <= 0) return null;
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  const label = hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  return { label, remainingSeconds: remaining, fraction: Math.max(0, Math.min(1, remaining / windowSeconds)) };
}

/* --------------------------------------------------------------- milestone */

/**
 * What the payer confirms, by category (spec screen 6: never one generic
 * button for every transaction). Null where there is no protected flow at
 * all: a sale is never paid on Vallo at any stage (founder rule (c), 9
 * November 2026), and "other" has no defined handover.
 */
export type MilestoneKind = "check_in" | "keys";

export function milestoneFor(category: ProtectedCategory): MilestoneKind | null {
  switch (category) {
    case "shortlet":
    case "hotel_booking":
    case "event_space":
      return "check_in";
    case "residential_rent":
    case "commercial_rent":
      return "keys";
    case "property_sale":
    case "land_sale":
    case "other":
      return null;
  }
}
