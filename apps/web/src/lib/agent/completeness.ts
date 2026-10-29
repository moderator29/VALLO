import { submitRequirements, type SubmitSubject } from "./listings-model";

/**
 * THE COMPLETENESS METER (backlog row 15, 29 October 2026): how far a listing
 * is from being a good one, as steps done out of steps, never a score.
 *
 * `docs/PRODUCT.md` refuses "score" as a word for standing, so this is a
 * count of plain steps the lister can finish, in the order that matters:
 * the five the review gate requires (the same `submitRequirements` the wizard
 * checklist and `submitListing` call, so the meter and the server cannot
 * disagree), then three that make a listing easier to trust and to find in
 * Nigeria (a walkthrough video, how the power and water work, and a landmark).
 *
 * Pure, so every rule is proved in `completeness.test.ts`.
 */

export const COMPLETENESS_STEPS = ["details", "price", "description", "photos", "amenities", "video", "utilities", "landmark"] as const;
export type CompletenessStep = (typeof COMPLETENESS_STEPS)[number];

/** The gate fields that belong to each required step. */
const GATE_FIELDS: Record<"details" | "price" | "description" | "photos" | "amenities", readonly string[]> = {
  details: ["title", "propertyType", "stateCode", "city", "area", "unitShape", "bedrooms", "bathrooms"],
  price: ["salePrice", "tenure", "rent", "rentPeriod", "totalMoveIn", "rate", "ratePeriod"],
  description: ["description"],
  photos: ["photos"],
  amenities: ["amenities"],
};

export type CompletenessFacts = {
  gate: SubmitSubject;
  /** Walkthrough videos on the listing. */
  videoCount: number;
  /** The lister said how the grid, the backup power or the water work. */
  utilitiesAnswered: boolean;
  /** A landmark or a street address a visitor can find it by. */
  hasLandmark: boolean;
};

export type Completeness = {
  done: number;
  total: number;
  /** Which steps are done, in `COMPLETENESS_STEPS` order. */
  steps: Record<CompletenessStep, boolean>;
  /** The first step still open, in order, or null when every step is done. */
  next: CompletenessStep | null;
  /** True when the five steps the review gate asks for are all done. */
  readyForReview: boolean;
};

export function listingCompleteness(facts: CompletenessFacts): Completeness {
  const unmet = new Set(submitRequirements(facts.gate).map((requirement) => requirement.field));
  const open = (step: keyof typeof GATE_FIELDS) => GATE_FIELDS[step].some((field) => unmet.has(field));

  const steps: Record<CompletenessStep, boolean> = {
    details: !open("details"),
    price: !open("price"),
    description: !open("description"),
    photos: !open("photos"),
    amenities: !open("amenities"),
    video: facts.videoCount > 0,
    utilities: facts.utilitiesAnswered,
    landmark: facts.hasLandmark,
  };
  const done = COMPLETENESS_STEPS.filter((step) => steps[step]).length;
  return {
    done,
    total: COMPLETENESS_STEPS.length,
    steps,
    next: COMPLETENESS_STEPS.find((step) => !steps[step]) ?? null,
    readyForReview: (["details", "price", "description", "photos", "amenities"] as const).every((step) => steps[step]),
  };
}
