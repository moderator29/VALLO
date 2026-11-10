/**
 * STEP 8, FUNDED (D68d, B.3.5): what the renter and the lister read about a
 * protected payment. Pure, so every state is a unit test; the figures come
 * only from the provider's record (`provider_arrangements`), never invented.
 * The words are lib/money/copy.ts's.
 */
import {
  HELD_IF_WRONG,
  HELD_PAUSED,
  HELD_RELEASE_STEPS,
  HELD_RELEASE_STEPS_LISTER,
  HELD_TITLE_LISTER,
  HELD_TITLE_RENTER,
} from "./copy";

export type HeldFacts = {
  role: "renter" | "lister";
  /** Vallo's state (lib/money/arrangement-states.ts). */
  status: string;
  amountMinor: number;
  /** The provider's fee, once it reported it; borne by the lister (VALLO_PRICING section 6). */
  providerFeeMinor: number | null;
  paused: boolean;
  counterpartName: string;
  placeTitle: string;
  moveIn: string | null;
  milestones: { position: number; title: string; amountMinor: number; status: string }[];
};

export type HeldStep = { title: string; body: string; state: "done" | "now" | "next" };

export type HeldModel = {
  /** The one idea of the screen. */
  title: string;
  /** The tone of the badge on the platinum card. */
  badge: { label: string; tone: "held" | "moving" | "done" | "attention" | "waiting" };
  /** The lister's take-home once the provider's fee is known; null until it is. */
  receiveMinor: number | null;
  steps: HeldStep[];
  note: string | null;
  /** The renter's one action: only while it is held, not paused, not a milestone deal. */
  canRelease: boolean;
  /** The next milestone the renter can release, if this is a staged payment. */
  nextMilestone: { position: number; title: string; amountMinor: number } | null;
};

const HELD = new Set(["protected", "release_requested"]);

function badgeFor(status: string, paused: boolean): HeldModel["badge"] {
  if (paused && HELD.has(status)) return { label: "Held, release paused", tone: "attention" };
  switch (status) {
    case "protected":
      return { label: "Held", tone: "held" };
    case "release_requested":
      return { label: "Releasing", tone: "moving" };
    case "released":
      return { label: "Released", tone: "done" };
    case "payment_processing":
      return { label: "On its way to our licensed provider", tone: "moving" };
    case "awaiting_payment":
    case "preparing":
    case "unknown":
      return { label: "Not paid yet", tone: "waiting" };
    case "disputed":
      return { label: "Held while it is looked at", tone: "attention" };
    case "refunded":
      return { label: "Returned to the renter", tone: "done" };
    case "split":
      return { label: "Divided by ruling", tone: "done" };
    default:
      return { label: "Not available", tone: "attention" };
  }
}

/** Where the three release steps stand for this state. */
function stepStates(status: string): HeldStep["state"][] {
  if (status === "released") return ["done", "done", "done"];
  if (status === "release_requested") return ["done", "done", "now"];
  if (status === "protected" || status === "disputed") return ["now", "next", "next"];
  return ["next", "next", "next"];
}

export function heldModel(f: HeldFacts): HeldModel {
  const words = f.role === "renter" ? HELD_RELEASE_STEPS : HELD_RELEASE_STEPS_LISTER;
  const states = stepStates(f.status);
  const steps = words.map((w, i) => ({ ...w, state: states[i] ?? "next" }));
  const pending = f.milestones.filter((m) => m.status === "pending").sort((a, b) => a.position - b.position);
  const isMilestone = f.milestones.length > 0;
  const held = f.status === "protected";
  return {
    title: f.role === "renter" ? HELD_TITLE_RENTER : HELD_TITLE_LISTER,
    badge: badgeFor(f.status, f.paused),
    receiveMinor:
      f.role === "lister" && f.providerFeeMinor !== null && f.providerFeeMinor <= f.amountMinor
        ? f.amountMinor - f.providerFeeMinor
        : null,
    steps,
    note: f.paused && HELD.has(f.status) ? HELD_PAUSED : held && f.role === "renter" ? HELD_IF_WRONG : null,
    canRelease: f.role === "renter" && held && !f.paused && !isMilestone,
    nextMilestone:
      f.role === "renter" && held && !f.paused && isMilestone && pending[0]
        ? { position: pending[0].position, title: pending[0].title, amountMinor: pending[0].amountMinor }
        : null,
  };
}
