import { fail, type ActionResult } from "../actions/envelope";

/**
 * EACH BRANCH WRITES ONLY ITS OWN THINGS (1 November 2026, the founder: "only
 * the options responsible for restaurant, same as hotel"). A restaurant has
 * no rooms, rates or place to let; a hotel or a shortlet has no tables or
 * menu. The wizard never offers the other branch's steps, and these actions
 * refuse them too, so a stale tab or a hand-made request cannot put rooms on
 * a restaurant or tables on a hotel. A business whose kind is not set yet is
 * not refused: the first step decides it.
 */
export const BRANCH_REFUSAL = {
  stay: "This is a restaurant application. Rooms, rates and places to let are not part of it.",
  restaurant: "This is a stay application. Tables, opening hours and the menu are not part of it.",
} as const;
export function wrongBranch(kind: string | null, wants: "stay" | "restaurant"): ActionResult<never> | null {
  if (!kind) return null;
  const isRestaurant = kind === "restaurant";
  if (wants === "stay" && isRestaurant) return fail(BRANCH_REFUSAL.stay);
  if (wants === "restaurant" && !isRestaurant) return fail(BRANCH_REFUSAL.restaurant);
  return null;
}
