import type { PersonHit } from "@/lib/social/people-hits";

/** Who a search shows: everyone, or one side of the platform. */
export type RoleFilter = "all" | "agent" | "landlord" | "member";

/**
 * The people search's filters, applied to what the search already answered,
 * so nothing is asked of the server twice. "Verified" is the published badge
 * (`person_badge`), never inferred from a role.
 */
export function filterHits(hits: readonly PersonHit[], role: RoleFilter, verifiedOnly: boolean): PersonHit[] {
  return hits.filter((hit) => {
    if (verifiedOnly && hit.tier === "none") return false;
    if (role === "all") return true;
    if (role === "member") return hit.role === null;
    return hit.role === role;
  });
}
