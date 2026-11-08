import { getDictionary } from "@vallo/i18n";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * THE BADGE, AS THIS CODEBASE IS ALLOWED TO KNOW IT.
 *
 * There is one derivation of the verified badge and it is in the database.
 * `public.person_badge` publishes it per person and `public.agent_badges.tier`
 * carries the same answer on the row a listing already joins. Both are computed
 * by `public.badge_tier(is_staff, is_checked)` off
 * `public.is_platform_staff` and `public.is_checked_person`, and each of those
 * three says its thing exactly once. Migration `20260923111950`.
 *
 * WHAT THIS MODULE DOES, AND THE LIST IS SHORT ON PURPOSE. It names the tiers,
 * it READS the published value, and it carries the words a surface prints. It
 * does NOT decide anything. There is no rule in this file that says who gets a
 * badge, because the moment there is one, this codebase has a second derivation
 * and two screens can disagree about a stranger somebody is about to send a
 * deposit to. That has happened once already on this exact badge, and
 * `agent-badge-derivation.test.ts` exists to stop it happening again.
 *
 * SO, CONCRETELY, WHAT MAY NEVER APPEAR HERE OR ANYWHERE IN `src`:
 *   - `isAgent ? "gold" : "none"`, or any other reading off a role marker.
 *     `social_profiles.is_agent` says a person holds an APPROVED agents row.
 *     Approval is not a check of anybody. Its own column comment says so: "a
 *     role marker, not an earned badge".
 *   - `isAdmin ? "platinum" : ...` computed from a session or a claim.
 *   - `verificationTier >= 1 ? "gold" : "none"`. That rule is real and it lives
 *     in the database, where the constraint is.
 *   - any precedence between the two tiers. Platinum beats gold, and that
 *     decision is `public.badge_tier` and nothing else, so that no component
 *     can quietly answer it differently.
 *
 * THE FAILURE DIRECTION IS DECIDED AND IT IS "NO MARK". An unknown value, a
 * missing row, a failed read and a null all come back `none`. A tick that fails
 * to appear costs somebody a second look. A tick that appears with no check
 * behind it is the product lying about a stranger's trustworthiness on the
 * screen where money moves.
 */
export type BadgeTier = "none" | "gold" | "platinum";

/** The published view, keyed by the person. The one door for a name on a screen. */
export const PERSON_BADGE_VIEW = "person_badge";

/**
 * Read a published tier. Anything this function does not recognise is `none`,
 * including a new enum label added to the database and not yet known here:
 * drawing no mark for a tier we cannot name is right, and drawing a guess is
 * not.
 */
export function toBadgeTier(value: unknown): BadgeTier {
  return value === "gold" || value === "platinum" ? value : "none";
}

/** True when this tier draws a mark at all. Never the other way round. */
export function hasBadge(tier: BadgeTier): boolean {
  return tier !== "none";
}

/**
 * What the mark means, in the words the surface is allowed to use. Gold says
 * one thing only, and it is the same sentence the ladder's own first rung uses
 * in `verification.ts`: a person here looked at a government document. It does
 * not claim an inspection, a payout account or anything about a property.
 */
/** SW11: source of truth is now `packages/i18n/src/locales/badge.en.ts`. */
const _b = getDictionary("en").badge;
export const BADGE_TIER_LABEL: Record<BadgeTier, string> = _b.tierLabel as Record<BadgeTier, string>;
export const BADGE_TIER_MEANING: Record<BadgeTier, string> = _b.tierMeaning as Record<BadgeTier, string>;

/**
 * The published badge for a set of people, in one read.
 *
 * Every surface that draws a name uses this rather than asking a different
 * table its own question. A person with no row is not in the map, and the
 * caller reads `none`.
 */
export async function readPersonBadges(
  client: Pick<SupabaseClient, "from">,
  userIds: readonly string[],
): Promise<Map<string, BadgeTier>> {
  const map = new Map<string, BadgeTier>();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return map;
  const { data } = await client.from(PERSON_BADGE_VIEW).select("user_id, tier").in("user_id", ids);
  for (const row of (data ?? []) as { user_id: string; tier: unknown }[]) {
    map.set(row.user_id, toBadgeTier(row.tier));
  }
  return map;
}
