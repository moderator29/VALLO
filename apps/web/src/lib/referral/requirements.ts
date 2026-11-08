/**
 * THE QUALIFICATION REGISTRY (D62). A fixed set of named checks, each one SQL
 * function in `b4_referral_campaigns.sql` (`private.referral_req_<key>`),
 * and a campaign stores an ordered array of these keys. Never an expression
 * language. `requirements.test.ts` fails if this list and the migration's
 * registry drift.
 *
 * The copy is what a member reads BEFORE inviting anyone (architecture
 * section 6, rule 2): the conditions are visible up front.
 */

export const REQUIREMENT_KEYS = [
  "phone_verified",
  "email_verified",
  "onboarding_completed",
  "meaningful_activity",
  "business_profile_completed",
  "business_verified",
  "property_owner_verified",
  "space_published",
] as const;

export type RequirementKey = (typeof REQUIREMENT_KEYS)[number];

export function isRequirementKey(value: unknown): value is RequirementKey {
  return typeof value === "string" && (REQUIREMENT_KEYS as readonly string[]).includes(value);
}

/** SW11: source of truth is now `packages/i18n/src/locales/referral.en.ts`. */
import { referralRequirementsEn, referralStepsEn } from "@vallo/i18n/en/referral";
const _ref = { requirements: referralRequirementsEn, steps: referralStepsEn };
export const REQUIREMENT_COPY = _ref.requirements as Record<RequirementKey, string>;

/**
 * The same steps as the end of a sentence about the person invited ("once
 * they ..."), so a member reads what "signs up fully" means under the live
 * campaign, from its keys, before they invite anybody (D85).
 */
export const REQUIREMENT_STEP = _ref.steps as Record<RequirementKey, string>;

/** "a", "a and b", "a, b and c". */
function joinSteps(steps: readonly string[]): string {
  if (steps.length <= 1) return steps[0] ?? "";
  return `${steps.slice(0, -1).join(", ")} and ${steps[steps.length - 1]}`;
}

/**
 * "A friend has signed up fully once they confirm their email address and
 * finish setting up their account." Null when the read named no step, so a
 * screen says nothing rather than guessing.
 */
export function signedUpFullySentence(keys: readonly unknown[]): string | null {
  const steps = keys.filter(isRequirementKey).map((k) => REQUIREMENT_STEP[k]);
  return steps.length === 0 ? null : `A friend has signed up fully once they ${joinSteps(steps)}.`;
}

/** The keys a campaign lists, in its order, dropping anything unknown. */
export function requirementLines(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return keys.filter(isRequirementKey).map((k) => REQUIREMENT_COPY[k]);
}
